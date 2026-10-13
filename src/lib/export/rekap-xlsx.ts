import "server-only";

import ExcelJS from "exceljs";

import type { RekapRow } from "@/lib/services/guru";
import { periodeLabel, type KopSekolah, type LaporanMeta } from "./kop";

const HEADER = ["No", "Nama", "Kelas", "H", "I", "S", "A", "Total", "%"] as const;
const N_COLS = HEADER.length;

/**
 * Workbook rekap kehadiran: kop sekolah + judul + tabel + keterangan cetak.
 * Satu sheet "Rekap", siap unduh.
 */
export async function buildRekapWorkbook(
  kop: KopSekolah,
  rows: RekapRow[],
  meta: LaporanMeta
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hadirku";
  wb.created = new Date();
  const ws = wb.addWorksheet("Rekap");

  const judul = (text: string, size: number, bold = true) => {
    const row = ws.addRow([text]);
    row.font = { bold, size };
    row.alignment = { horizontal: "center", vertical: "middle" };
    ws.mergeCells(row.number, 1, row.number, N_COLS);
  };

  judul(kop.nama.toUpperCase(), 14);
  if (kop.alamat) judul(kop.alamat, 10, false);
  judul("REKAP KEHADIRAN SISWA", 12);
  judul(periodeLabel(meta), 10, false);

  const head = ws.addRow([...HEADER]);
  head.font = { bold: true };
  head.alignment = { horizontal: "center", vertical: "middle" };
  head.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
    cell.border = border();
  });

  rows.forEach((r, i) => {
    const row = ws.addRow([
      i + 1,
      r.nama,
      r.kelas_nama,
      r.hadir,
      r.izin,
      r.sakit,
      r.alpha,
      r.total,
      r.total === 0 ? "-" : r.persen,
    ]);
    row.eachCell((cell, col) => {
      cell.border = border();
      if (col >= 4) cell.alignment = { horizontal: "center" };
    });
  });

  ws.addRow([]);
  const kaki = ws.addRow([`Dicetak oleh ${meta.dicetakOleh} pada ${meta.dicetakPada}`]);
  kaki.font = { italic: true, size: 9 };
  ws.mergeCells(kaki.number, 1, kaki.number, N_COLS);

  ws.columns = [
    { width: 5 },
    { width: 30 },
    { width: 15 },
    { width: 6 },
    { width: 6 },
    { width: 6 },
    { width: 6 },
    { width: 8 },
    { width: 8 },
  ];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function border(): Partial<ExcelJS.Borders> {
  const side = { style: "thin" as const, color: { argb: "FFD4D4D8" } };
  return { top: side, left: side, bottom: side, right: side };
}
