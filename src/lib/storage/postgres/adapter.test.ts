import { describe, expect, it, vi } from "vitest";

import { PostgresTable, type PgPoolLike } from "./adapter";

interface Siswa {
  id: string;
  nama: string;
  aktif: boolean;
}

/** Fake pool: simpan baris di memori, catat query terakhir. */
function makePool(seed: Record<string, unknown>[] = []) {
  const rows: Record<string, unknown>[] = [...seed];
  const queries: { text: string; params?: unknown[] }[] = [];
  const pool: PgPoolLike = {
    async query(text, params) {
      queries.push({ text, params });
      if (text.startsWith("SELECT")) {
        const idParam = params?.[0];
        const out =
          params && params.length > 0 ? rows.filter((r) => r["id"] === idParam) : [...rows];
        return { rows: out.map((r) => ({ ...r })), rowCount: out.length };
      }
      if (text.startsWith("INSERT")) {
        const cols = ["id", "nama", "aktif"];
        const n = rows.length;
        const inserted: Record<string, unknown>[] = [];
        // params berurutan per baris
        for (let i = 0; i < (params?.length ?? 0); i += cols.length) {
          const row: Record<string, unknown> = {};
          cols.forEach((c, j) => {
            row[c] = params![i + j];
          });
          rows.push(row);
          inserted.push({ ...row });
        }
        void n;
        return { rows: inserted, rowCount: inserted.length };
      }
      if (text.startsWith("UPDATE")) {
        const id = params?.[params.length - 1];
        const row = rows.find((r) => r["id"] === id);
        if (!row) return { rows: [], rowCount: 0 };
        // parse SET "col" = $i berurutan
        const sets = [...text.matchAll(/"([a-z_]+)" = \$\d+/g)].map((m) => m[1]);
        sets.forEach((c, i) => {
          row[c] = params![i];
        });
        return { rows: [{ ...row }], rowCount: 1 };
      }
      if (text.startsWith("DELETE")) {
        const id = params?.[0];
        const idx = rows.findIndex((r) => r["id"] === id);
        if (idx >= 0) rows.splice(idx, 1);
        return { rows: [], rowCount: idx >= 0 ? 1 : 0 };
      }
      throw new Error(`Query tak dikenal: ${text}`);
    },
  };
  return { pool, queries, rows };
}

function makeTable(pool: PgPoolLike) {
  return new PostgresTable<Siswa>(pool, "school_x", "siswa", ["id", "nama", "aktif"]);
}

describe("PostgresTable", () => {
  it("findAll/findById/findWhere + decode Date", async () => {
    const { pool } = makePool([
      { id: "s1", nama: "Ani", aktif: true, dibuat_pada: new Date("2026-01-01T00:00:00Z") },
    ]);
    const t = new PostgresTable<Record<string, unknown>>(pool, "school_x", "users", [
      "id",
      "nama",
      "aktif",
      "dibuat_pada",
    ]);
    expect(await t.findAll()).toHaveLength(1);
    expect(await t.findById("s1")).toMatchObject({ nama: "Ani" });
    expect(await t.findById("xx")).toBeNull();
    expect(await t.findWhere((r) => r["aktif"] === true)).toHaveLength(1);
    expect((await t.findById("s1"))?.["dibuat_pada"]).toBe("2026-01-01T00:00:00.000Z");
  });

  it("insertMany satu query berparameter", async () => {
    const { pool, queries, rows } = makePool();
    const t = makeTable(pool);
    const out = await t.insertMany([
      { id: "a", nama: "A", aktif: true },
      { id: "b", nama: "B", aktif: false },
    ]);
    expect(out).toHaveLength(2);
    expect(rows).toHaveLength(2);
    expect(queries).toHaveLength(1);
    const [q] = queries;
    expect(q.text).toContain("INSERT INTO");
    expect(q.text).toContain('"school_x"."siswa"');
    expect(q.params).toEqual(["a", "A", true, "b", "B", false]);
  });

  it("update + updateMany + softDelete", async () => {
    const { pool, queries } = makePool([
      { id: "s1", nama: "Lama", aktif: true },
      { id: "s2", nama: "Tetap", aktif: true },
    ]);
    const t = makeTable(pool);
    expect(await t.update("s1", { nama: "Baru" })).toMatchObject({ nama: "Baru" });
    expect(await t.update("xx", { nama: "X" })).toBeNull();
    expect(await t.updateMany(["s1", "s2"], { nama: "Z" })).toBe(2);
    await t.softDelete("s1");
    expect(await t.findById("s1")).toMatchObject({ aktif: false });
    const lastUpdate = queries.filter((x) => x.text.startsWith("UPDATE")).pop()!;
    expect(lastUpdate.params).toEqual([false, "s1"]); // nilai selalu via parameter
  });

  it("identifier tidak valid ditolak (anti SQL injection)", async () => {
    const { pool } = makePool();
    const evil = new PostgresTable(pool, 'x"; DROP TABLE--', "siswa", ["id"]);
    await expect(evil.findAll()).rejects.toThrow(/identifier/);
  });

  it("vi tersedia untuk mock lanjutan", () => {
    expect(vi.fn()).toBeDefined();
  });
});
