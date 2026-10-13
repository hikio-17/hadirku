import { describe, expect, it, vi } from "vitest";

import { createMemoryCache, createMemoryLocker } from "@/lib/redis";
import {
  a1,
  booleanCodec,
  SheetsTable,
  type SheetsBatchUpdateItem,
  type SheetsValuesClient,
} from "./SheetsTable";

interface Siswa {
  id: string;
  nama: string;
  aktif: boolean;
}

/** Fake client Sheets: header sengaja diacak untuk membuktikan mapping by nama. */
function makeFake(initialRows: string[][] = []) {
  const calls = { batchGet: 0, batchUpdate: 0, append: 0 };
  const header = ["nama", "id", "aktif"];
  const data: string[][] = [...initialRows];
  const client: SheetsValuesClient = {
    async batchGet() {
      calls.batchGet += 1;
      return [{ range: "siswa!A1:ZZ", values: [header, ...data] }];
    },
    async batchUpdate(_id, updates: SheetsBatchUpdateItem[]) {
      calls.batchUpdate += 1;
      for (const u of updates) {
        const m = u.range.match(/A(\d+):/);
        const rowNumber = Number(m?.[1]);
        // Tabel meng-encode baris sesuai urutan `columns` = ["id", "nama", "aktif"];
        // kembalikan ke urutan header ["nama", "id", "aktif"].
        const byHeader = { nama: 0, id: 1, aktif: 2 };
        const row = ["", "", ""];
        const cols = ["id", "nama", "aktif"];
        u.values[0].forEach((v, i) => {
          row[byHeader[cols[i] as keyof typeof byHeader]] = String(v);
        });
        data[rowNumber - 2] = row;
      }
    },
    async append(_id, _range, values) {
      calls.append += 1;
      for (const v of values) {
        const row = ["", "", ""];
        const cols = ["id", "nama", "aktif"]; // urutan columns di tabel
        const byHeader = { nama: 0, id: 1, aktif: 2 };
        v.forEach((cell, i) => {
          row[byHeader[cols[i] as keyof typeof byHeader]] = String(cell);
        });
        data.push(row);
      }
    },
  };
  return { client, calls, getData: () => data };
}

function makeTable(fake: ReturnType<typeof makeFake>, cache = createMemoryCache()) {
  return new SheetsTable<Siswa>(fake.client, "sheet-1", "siswa", {
    columns: ["id", "nama", "aktif"],
    codecs: { aktif: booleanCodec },
    cache,
    locker: createMemoryLocker(),
  });
}

describe("SheetsTable", () => {
  it("mapping kolom by nama header, bukan indeks", async () => {
    const fake = makeFake([["Budi", "s1", "TRUE"]]);
    const rows = await makeTable(fake).findAll();
    expect(rows).toEqual([{ id: "s1", nama: "Budi", aktif: true }]);
  });

  it("findById dan findWhere", async () => {
    const fake = makeFake([
      ["Budi", "s1", "TRUE"],
      ["Ani", "s2", "FALSE"],
    ]);
    const t = makeTable(fake);
    expect(await t.findById("s2")).toEqual({ id: "s2", nama: "Ani", aktif: false });
    expect(await t.findById("xx")).toBeNull();
    expect(await t.findWhere((r) => r.aktif)).toHaveLength(1);
  });

  it("insertMany hanya memakai SATU append call dan memberi nanoid", async () => {
    const fake = makeFake();
    const t = makeTable(fake);
    const rows = await t.insertMany([
      { id: "", nama: "A", aktif: true },
      { id: "", nama: "B", aktif: true },
    ]);
    expect(fake.calls.append).toBe(1);
    expect(rows[0].id).not.toBe("");
    expect(rows[0].id).not.toBe(rows[1].id);
    expect(await t.findAll()).toHaveLength(2);
  });

  it("updateMany hanya memakai SATU batchUpdate call", async () => {
    const fake = makeFake([
      ["A", "s1", "TRUE"],
      ["B", "s2", "TRUE"],
    ]);
    const t = makeTable(fake);
    const n = await t.updateMany(["s1", "s2"], { nama: "X" });
    expect(n).toBe(2);
    expect(fake.calls.batchUpdate).toBe(1);
    expect(await t.findById("s1")).toMatchObject({ nama: "X" });
  });

  it("softDelete men-set aktif=false", async () => {
    const fake = makeFake([["A", "s1", "TRUE"]]);
    const t = makeTable(fake);
    await t.softDelete("s1");
    expect(await t.findById("s1")).toMatchObject({ aktif: false });
  });

  it("cache: baca kedua tidak memanggil batchGet lagi; write invalidate", async () => {
    const fake = makeFake([["A", "s1", "TRUE"]]);
    const t = makeTable(fake);
    await t.findAll();
    await t.findAll();
    expect(fake.calls.batchGet).toBe(1);
    await t.insert({ id: "s2", nama: "B", aktif: true });
    await t.findAll();
    expect(fake.calls.batchGet).toBe(2);
  });

  it("retry saat 429 lalu sukses", async () => {
    const fake = makeFake([["A", "s1", "TRUE"]]);
    let attempts = 0;
    const flaky: SheetsValuesClient = {
      ...fake.client,
      async batchGet(...args) {
        attempts += 1;
        if (attempts === 1) throw Object.assign(new Error("rateLimitExceeded"), { code: 429 });
        return fake.client.batchGet(...args);
      },
    };
    const t = new SheetsTable<Siswa>(flaky, "sheet-1", "siswa", {
      columns: ["id", "nama", "aktif"],
      codecs: { aktif: booleanCodec },
      maxAttempts: 3,
    });
    expect(await t.findAll()).toHaveLength(1);
    expect(attempts).toBe(2);
  });

  it("error ramah setelah retry habis, tanpa bocor ke crash", async () => {
    const failing: SheetsValuesClient = {
      async batchGet() {
        throw Object.assign(new Error("Backend error"), { code: 503 });
      },
      async batchUpdate() {
        throw Object.assign(new Error("Backend error"), { code: 503 });
      },
      async append() {
        throw Object.assign(new Error("Backend error"), { code: 503 });
      },
    };
    const t = new SheetsTable<Siswa>(failing, "sheet-1", "siswa", {
      columns: ["id", "nama", "aktif"],
      maxAttempts: 2,
    });
    await expect(t.findAll()).rejects.toThrow("Server sibuk, coba lagi.");
  });

  it("error non-retryable (400) langsung dilempar", async () => {
    const bad: SheetsValuesClient = {
      async batchGet() {
        throw Object.assign(new Error("Invalid range"), { code: 400 });
      },
      async batchUpdate() {},
      async append() {},
    };
    const t = new SheetsTable<Siswa>(bad, "sheet-1", "siswa", { columns: ["id", "nama", "aktif"] });
    await expect(t.findAll()).rejects.toThrow("Invalid range");
  });

  it("a1() meng-quote nama sheet ber-spasi", () => {
    expect(a1("pengajuan_izin", "A1:ZZ")).toBe("pengajuan_izin!A1:ZZ");
    expect(a1("Rekap Absensi", "A1:ZZ")).toBe("'Rekap Absensi'!A1:ZZ");
    expect(vi.fn()).toBeDefined();
  });
});
