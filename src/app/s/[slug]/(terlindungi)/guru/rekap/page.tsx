import Link from "next/link";

import { requireGuru } from "@/lib/admin-guard";
import {
  getRekap,
  listPenugasanGuru,
  listRiwayat,
  todayWIB,
  tambahHari,
} from "@/lib/services/guru";
import { Notice, PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { H: "Hadir", I: "Izin", S: "Sakit", A: "Alpha" };

export default async function RekapPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    kelas?: string;
    mapel?: string;
    dari?: string;
    sampai?: string;
    status?: string;
    page?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sampai = sp.sampai || todayWIB();
  const dari = sp.dari || tambahHari(sampai, -29);
  const kelas = sp.kelas ?? "";
  const mapel = sp.mapel ?? "";
  const status = sp.status ?? "";
  const page = Number(sp.page) || 1;

  let rekap: Awaited<ReturnType<typeof getRekap>> | null = null;
  let riwayat: Awaited<ReturnType<typeof listRiwayat>> | null = null;
  let tugas: Awaited<ReturnType<typeof listPenugasanGuru>> = [];
  let loadError = "";
  try {
    const g = await requireGuru();
    const sid = g.ctx.context.spreadsheetId;
    const filter = { kelasId: kelas, mapelId: mapel, dari, sampai, status, page };
    [rekap, riwayat, tugas] = await Promise.all([
      getRekap(g.ctx.sheets, sid, g.guru.id, filter),
      listRiwayat(g.ctx.sheets, sid, g.guru.id, filter),
      listPenugasanGuru(g.ctx.sheets, sid, g.guru.id),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  const kelasList = [...new Map(tugas.map((t) => [t.kelas_id, t.kelas_nama])).entries()];
  const mapelList = [...new Map(tugas.map((t) => [t.mapel_id, t.mapel_nama])).entries()];
  const base = `/s/${slug}/guru/rekap`;

  return (
    <div className="space-y-5">
      <PageHeader title="Rekap & riwayat" subtitle="Filter periode, kelas, mapel, dan status." />
      <Notice ok={sp.ok ?? ""} error={sp.error ?? ""} />
      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {loadError}
        </div>
      )}

      <form
        method="get"
        className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-6"
      >
        <label className="text-xs">
          Dari
          <input
            name="dari"
            type="date"
            defaultValue={dari}
            required
            className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs">
          Sampai
          <input
            name="sampai"
            type="date"
            defaultValue={sampai}
            required
            className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm"
          />
        </label>
        <label className="text-xs">
          Kelas
          <select
            name="kelas"
            defaultValue={kelas}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm"
          >
            <option value="">Semua</option>
            {kelasList.map(([id, nama]) => (
              <option key={id} value={id}>
                {nama}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Mapel
          <select
            name="mapel"
            defaultValue={mapel}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm"
          >
            <option value="">Semua</option>
            {mapelList.map(([id, nama]) => (
              <option key={id} value={id}>
                {nama}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Status
          <select
            name="status"
            defaultValue={status}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm"
          >
            <option value="">Semua</option>
            <option value="H">Hadir</option>
            <option value="I">Izin</option>
            <option value="S">Sakit</option>
            <option value="A">Alpha</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="h-10 w-full rounded-lg bg-zinc-950 text-sm font-medium text-white"
          >
            Tampilkan
          </button>
        </div>
      </form>

      {rekap && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">
            Rekap per siswa · {rekap.dari} – {rekap.sampai}
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-2">Siswa</th>
                  <th className="py-2 pr-2">H</th>
                  <th className="py-2 pr-2">I</th>
                  <th className="py-2 pr-2">S</th>
                  <th className="py-2 pr-2">A</th>
                  <th className="py-2 pr-2">%</th>
                </tr>
              </thead>
              <tbody>
                {rekap.rows.map((r) => (
                  <tr key={r.siswa_id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-2">
                      <span className="font-medium">{r.nama}</span>
                      <span className="block text-xs text-zinc-500">{r.kelas_nama}</span>
                    </td>
                    <td className="py-2 pr-2">{r.hadir}</td>
                    <td className="py-2 pr-2">{r.izin}</td>
                    <td className="py-2 pr-2">{r.sakit}</td>
                    <td className="py-2 pr-2">{r.alpha}</td>
                    <td className={`py-2 pr-2 font-semibold ${r.rendah ? "text-red-700" : ""}`}>
                      {r.total === 0 ? "—" : `${r.persen}%`}
                    </td>
                  </tr>
                ))}
                {rekap.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-zinc-500">
                      Tidak ada data pada filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {riwayat && (
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Riwayat ({riwayat.total})</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-2">Tanggal</th>
                  <th className="py-2 pr-2">Siswa</th>
                  <th className="py-2 pr-2">Mapel</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2 pr-2 font-mono text-xs">{r.tanggal}</td>
                    <td className="py-2 pr-2">
                      <span className="font-medium">{r.siswa_nama}</span>
                      <span className="block text-xs text-zinc-500">
                        {r.kelas_nama}
                        {r.catatan ? ` · ${r.catatan}` : ""}
                      </span>
                    </td>
                    <td className="py-2 pr-2">{r.mapel_nama}</td>
                    <td className="py-2 pr-2">{STATUS_LABEL[r.status]}</td>
                    <td className="py-2 pr-2">
                      <Link href={`${base}/ubah/${r.id}`} className="text-xs font-medium underline">
                        Ubah
                      </Link>
                    </td>
                  </tr>
                ))}
                {riwayat.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-zinc-500">
                      Tidak ada riwayat pada filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {riwayat.pages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-zinc-500">
                Halaman {riwayat.page} dari {riwayat.pages}
              </span>
              <div className="flex gap-2">
                {riwayat.page > 1 && (
                  <Link
                    href={`${base}?dari=${dari}&sampai=${sampai}&kelas=${kelas}&mapel=${mapel}&status=${status}&page=${riwayat.page - 1}`}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5"
                  >
                    ←
                  </Link>
                )}
                {riwayat.page < riwayat.pages && (
                  <Link
                    href={`${base}?dari=${dari}&sampai=${sampai}&kelas=${kelas}&mapel=${mapel}&status=${status}&page=${riwayat.page + 1}`}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5"
                  >
                    →
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
