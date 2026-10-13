import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { makeSheetsStore, seedTab } from "@/test/fakes/sheets-store";
import { PENGATURAN_COLUMNS } from "@/lib/storage/sheets/columns";
import type { RekapRow } from "@/lib/services/guru";
import { getKop, periodeLabel } from "./kop";
import { buildRekapWorkbook } from "./rekap-xlsx";
import { buildRekapPdf } from "./rekap-pdf";
import { buildBackupWorkbook } from "./backup";

const KOP = { nama: "SMPN 1 Bandung", alamat: "Jl. Merdeka No. 1" };
const META = {
  dari: "2026-10-01",
  sampai: "2026-10-31",
  kelasLabel: "VII-A",
  mapelLabel: "Matematika",
  dicetakOleh: "Guru Satu",
  dicetakPada: "13 Okt 2026",
};
const ROWS: RekapRow[] = [
  {
    siswa_id: "s1",
    nama: "Ani",
    kelas_nama: "VII-A",
    hadir: 18,
    izin: 1,
    sakit: 1,
    alpha: 0,
    total: 20,
    persen: 90,
    rendah: false,
  },
  {
    siswa_id: "s2",
    nama: "Budi",
    kelas_nama: "VII-A",
    hadir: 0,
    izin: 0,
    sakit: 0,
    alpha: 0,
    total: 0,
    persen: 100,
    rendah: false,
  },
];

describe("getKop", () => {
  it("dari pengaturan; fallback bila kosong", async () => {
    const { client } = makeSheetsStore({
      pengaturan: seedTab(
        [...PENGATURAN_COLUMNS],
        [
          { kunci: "nama_sekolah", nilai: "SMPN 1" },
          { kunci: "alamat", nilai: "Jl. A" },
        ]
      ),
    });
    expect(await getKop(client, "s1")).toEqual({ nama: "SMPN 1", alamat: "Jl. A" });
    const kosong = makeSheetsStore({ pengaturan: seedTab([...PENGATURAN_COLUMNS], []) });
    expect(await getKop(kosong.client, "s1", "Slug School")).toEqual({
      nama: "Slug School",
      alamat: "",
    });
  });
});

describe("periodeLabel", () => {
  it("periode + scope", () => {
    expect(periodeLabel(META)).toBe("Periode 2026-10-01 s.d. 2026-10-31 · VII-A · Matematika");
    expect(periodeLabel({ ...META, kelasLabel: "", mapelLabel: "" })).toBe(
      "Periode 2026-10-01 s.d. 2026-10-31"
    );
  });
});

describe("buildRekapWorkbook", () => {
  it("kop + header + data bisa dibaca balik", async () => {
    const buf = await buildRekapWorkbook(KOP, ROWS, META);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    const texts: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => texts.push(String(c.value ?? ""))));
    expect(texts).toContain("SMPN 1 BANDUNG");
    expect(texts).toContain("REKAP KEHADIRAN SISWA");
    expect(texts).toContain("Periode 2026-10-01 s.d. 2026-10-31 · VII-A · Matematika");
    expect(texts).toContain("Ani");
    expect(texts).toContain("Budi");
    // baris data Ani: H=18 dan %=90
    const aniRow = ws.getRow(findDataRow(ws, "Ani"));
    expect(String(aniRow.getCell(4).value)).toBe("18");
    expect(String(aniRow.getCell(9).value)).toBe("90");
  });
});

function findDataRow(ws: ExcelJS.Worksheet, nama: string): number {
  let found = -1;
  ws.eachRow((row, n) => {
    if (String(row.getCell(2).value) === nama) found = n;
  });
  return found;
}

describe("buildRekapPdf", () => {
  it("PDF valid, ada kop + tabel", () => {
    const { buffer, pages } = buildRekapPdf(KOP, ROWS, META);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pages).toBeGreaterThanOrEqual(1);
    const text = buffer.toString("latin1");
    expect(text).toContain("SMPN 1 BANDUNG");
    expect(text).toContain("REKAP KEHADIRAN SISWA");
    expect(text).toContain("Ani");
    expect(text).toContain("Dicetak oleh Guru Satu");
  });
});

describe("buildBackupWorkbook", () => {
  it("12 tab via SATU batchGet; header fallback bila tab kosong", async () => {
    const ranges: string[] = [];
    const fake = {
      async batchGet(_id: string, rs: string[]) {
        ranges.push(...rs);
        return rs.map((range) => {
          const sheet = range.split("!")[0];
          if (sheet === "users") {
            return {
              range,
              values: [
                ["id", "nama"],
                ["u1", "Admin"],
              ],
            };
          }
          return { range, values: [] };
        });
      },
      async batchUpdate() {},
      async append() {},
    };
    const buf = await buildBackupWorkbook(fake, "spread-1");
    expect(ranges).toHaveLength(12); // SATU batchGet 12 ranges
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toContain("absensi");
    expect(wb.worksheets).toHaveLength(12);
    const users = wb.getWorksheet("users")!;
    expect(users.rowCount).toBe(2);
    const absensi = wb.getWorksheet("absensi")!;
    expect(String(absensi.getRow(1).getCell(1).value)).toBe("id"); // header skema
  });
});
