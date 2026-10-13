import { describe, expect, it } from "vitest";

import { createMemoryCache } from "@/lib/redis";
import { makeSheetsStore, seedTab } from "@/test/fakes/sheets-store";
import {
  GURU_COLUMNS,
  KELAS_COLUMNS,
  SISWA_COLUMNS,
  USERS_COLUMNS,
} from "@/lib/storage/sheets/columns";
import {
  buildTemplateWorkbook,
  confirmImport,
  parseImportBuffer,
  stashImportBatch,
  takeImportBatch,
} from "./impor";

const fakeHash = async (pw: string) => `hash:${pw}`;

function makeStore() {
  return makeSheetsStore({
    users: seedTab(
      [...USERS_COLUMNS],
      [
        {
          id: "u0",
          nama: "Ada",
          username: "sudah.ada",
          password_hash: "hash:x",
          role: "guru",
          aktif: "TRUE",
          wajib_ganti_password: "FALSE",
          dibuat_pada: "2026-01-01",
        },
      ]
    ),
    guru: seedTab([...GURU_COLUMNS], []),
    siswa: seedTab([...SISWA_COLUMNS], []),
    kelas: seedTab(
      [...KELAS_COLUMNS],
      [{ id: "k1", nama: "VII-A", tingkat: "7", tahun_ajaran_id: "ta1" }]
    ),
  });
}

describe("template + parse", () => {
  it("template guru bisa di-parse balik (1 baris contoh)", async () => {
    const buf = await buildTemplateWorkbook("guru");
    const { rows, errors } = await parseImportBuffer("guru", buf);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["username"]).toBe("budi.santoso");
  });

  it("template siswa bisa di-parse balik", async () => {
    const buf = await buildTemplateWorkbook("siswa");
    const { rows, errors } = await parseImportBuffer("siswa", buf);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ kelas: "VII-A", jenis_kelamin: "P" });
  });

  it("kolom hilang → error jelas", async () => {
    const buf = await buildTemplateWorkbook("guru");
    // bangun file rusak: header tanpa username
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    wb.worksheets[0].getRow(1).getCell(3).value = "bukan-username";
    const rusak = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(parseImportBuffer("guru", rusak)).rejects.toThrow(/username/);
  });

  it("baris buruk dilaporkan dengan nomor baris", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Guru");
    ws.addRow(["nama", "nip", "username", "password"]);
    ws.addRow(["Bagus", "", "bagus_a", "rahasia123"]);
    ws.addRow(["Jelek", "", "jelek_a", "pendek"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const { rows, errors } = await parseImportBuffer("guru", buf);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ baris: 3 });
  });
});

describe("confirmImport", () => {
  it("guru: username bentrok existing ditolak; sukses 2 baris (2 append)", async () => {
    const { client, store, calls } = makeStore();
    await expect(
      confirmImport(
        client,
        "s1",
        "guru",
        [{ nama: "X", nip: "", username: "SUDAH.ADA", password: "rahasia123" }],
        { hash: fakeHash }
      )
    ).rejects.toThrow(/sudah dipakai/);
    const out = await confirmImport(
      client,
      "s1",
      "guru",
      [
        { nama: "A", nip: "N1", username: "a1", password: "rahasia123" },
        { nama: "B", nip: "", username: "b1", password: "rahasia123" },
      ],
      { hash: fakeHash }
    );
    expect(out).toEqual({ akun: 2, profil: 2 });
    expect(calls.append).toBe(2); // 1 users + 1 guru
    expect(store.get("guru")).toHaveLength(3);
  });

  it("siswa: kelas tak dikenal ditolak; sukses terhubung kelas", async () => {
    const { client, store } = makeStore();
    await expect(
      confirmImport(
        client,
        "s1",
        "siswa",
        [
          {
            nama: "S",
            nis: "1",
            username: "s1",
            password: "rahasia123",
            kelas: "TAK-ADA",
            jenis_kelamin: "L",
          },
        ],
        { hash: fakeHash }
      )
    ).rejects.toThrow(/kelas/);
    // case-insensitive + JK panjang
    const { rows } = await parseImportBuffer(
      "siswa",
      await (async () => {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Siswa");
        ws.addRow(["nama", "nis", "username", "password", "kelas", "jenis_kelamin"]);
        ws.addRow(["S", "101", "s101", "rahasia123", "vii-a", "Laki-laki"]);
        return Buffer.from(await wb.xlsx.writeBuffer());
      })()
    );
    const out = await confirmImport(client, "s1", "siswa", rows, { hash: fakeHash });
    expect(out).toEqual({ akun: 1, profil: 1 });
    expect(store.get("siswa")![1][4]).toBe("k1");
    expect(store.get("siswa")![1][5]).toBe("L");
  });
});

describe("stash/take batch", () => {
  it("sekali pakai + TTL", async () => {
    const cache = createMemoryCache();
    const id = await stashImportBatch(cache, { jenis: "guru", rows: [{ nama: "A" }] });
    expect((await takeImportBatch(cache, id))?.jenis).toBe("guru");
    expect(await takeImportBatch(cache, id)).toBeNull();
  });
});
