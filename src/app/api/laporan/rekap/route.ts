import { requireGuru } from "@/lib/admin-guard";
import { getKop } from "@/lib/export/kop";
import { buildRekapPdf } from "@/lib/export/rekap-pdf";
import { buildRekapWorkbook } from "@/lib/export/rekap-xlsx";
import { getRekap, listPenugasanGuru, todayWIB, tambahHari } from "@/lib/services/guru";

/**
 * Unduh rekap kehadiran (guru saja di Tahap 6; admin menyusul Tahap 8).
 * Contoh: /api/laporan/rekap?slug=smpn-1&format=xlsx&dari=2026-10-01&sampai=2026-10-31
 */
export async function GET(req: Request): Promise<Response> {
  const g = await requireGuru().catch(() => null);
  if (!g) return new Response("Belum login.", { status: 401 });
  const sid = g.ctx.context.spreadsheetId;
  const slug = g.ctx.context.slug;

  const q = new URL(req.url).searchParams;
  if ((q.get("slug") ?? slug) !== slug) {
    return new Response("Slug tidak cocok dengan sesi.", { status: 403 });
  }
  const format = q.get("format") === "pdf" ? "pdf" : "xlsx";
  const sampai = q.get("sampai") || todayWIB();
  const dari = q.get("dari") || tambahHari(sampai, -29);
  const kelasId = q.get("kelas") ?? "";
  const mapelId = q.get("mapel") ?? "";

  try {
    const [rekap, tugas, kop] = await Promise.all([
      getRekap(g.ctx.sheets, sid, g.guru.id, { kelasId, mapelId, dari, sampai }),
      listPenugasanGuru(g.ctx.sheets, sid, g.guru.id),
      getKop(g.ctx.sheets, sid, g.ctx.school.nama_sekolah),
    ]);
    const kelasLabel = kelasId ? (tugas.find((t) => t.kelas_id === kelasId)?.kelas_nama ?? "") : "";
    const mapelLabel = mapelId ? (tugas.find((t) => t.mapel_id === mapelId)?.mapel_nama ?? "") : "";
    const meta = {
      dari,
      sampai,
      kelasLabel,
      mapelLabel,
      dicetakOleh: g.guru.nama,
      dicetakPada: new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    };
    const filename = `rekap-${slug}-${dari}-${sampai}.${format}`;
    if (format === "pdf") {
      const { buffer } = buildRekapPdf(kop, rekap.rows, meta);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
    const buf = await buildRekapWorkbook(kop, rekap.rows, meta);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "Gagal membuat laporan.", {
      status: 400,
    });
  }
}
