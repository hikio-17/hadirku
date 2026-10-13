import "server-only";

import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";

import type { RekapRow } from "@/lib/services/guru";
import { periodeLabel, type KopSekolah, type LaporanMeta } from "./kop";

export interface RekapPdf {
  buffer: Buffer;
  pages: number;
}

/**
 * PDF rekap kehadiran A4: kop sekolah + tabel + nomor halaman.
 * compress:false agar teks bisa diverifikasi di unit test.
 */
export function buildRekapPdf(kop: KopSekolah, rows: RekapRow[], meta: LaporanMeta): RekapPdf {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  const W = 210;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(kop.nama.toUpperCase(), W / 2, 16, { align: "center" });
  let y = 22;
  if (kop.alamat) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(kop.alamat, W / 2, y, { align: "center" });
    y += 6;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("REKAP KEHADIRAN SISWA", W / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(periodeLabel(meta), W / 2, y, { align: "center" });
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["No", "Nama", "Kelas", "H", "I", "S", "A", "Total", "%"]],
    body: rows.map((r, i) => [
      i + 1,
      r.nama,
      r.kelas_nama,
      r.hadir,
      r.izin,
      r.sakit,
      r.alpha,
      r.total,
      r.total === 0 ? "-" : `${r.persen}%`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [9, 9, 11] },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Halaman ${p} dari ${pages}`, W / 2, 290, { align: "center" });
    doc.text(`Dicetak oleh ${meta.dicetakOleh} pada ${meta.dicetakPada}`, 14, 290);
  }
  return { buffer: Buffer.from(doc.output("arraybuffer")), pages };
}
