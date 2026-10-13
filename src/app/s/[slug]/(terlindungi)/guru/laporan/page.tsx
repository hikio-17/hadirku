import { requireGuru } from "@/lib/admin-guard";
import { getKop } from "@/lib/export/kop";
import { getRekap, listPenugasanGuru, todayWIB, tambahHari } from "@/lib/services/guru";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Pratinjau persis isi unduhan + tombol Excel/PDF. */
export default async function LaporanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ kelas?: string; mapel?: string; dari?: string; sampai?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const sampai = sp.sampai || todayWIB();
  const dari = sp.dari || tambahHari(sampai, -29);
  const kelas = sp.kelas ?? "";
  const mapel = sp.mapel ?? "";

  let rekap: Awaited<ReturnType<typeof getRekap>> | null = null;
  let tugas: Awaited<ReturnType<typeof listPenugasanGuru>> = [];
  let kop = { nama: slug, alamat: "" };
  let loadError = "";
  try {
    const g = await requireGuru();
    const sid = g.ctx.context.spreadsheetId;
    [rekap, tugas, kop] = await Promise.all([
      getRekap(g.ctx.sheets, sid, g.guru.id, { kelasId: kelas, mapelId: mapel, dari, sampai }),
      listPenugasanGuru(g.ctx.sheets, sid, g.guru.id),
      getKop(g.ctx.sheets, sid, g.ctx.school.nama_sekolah),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  const kelasList = [...new Map(tugas.map((t) => [t.kelas_id, t.kelas_nama])).entries()];
  const mapelList = [...new Map(tugas.map((t) => [t.mapel_id, t.mapel_nama])).entries()];
  const dl = (format: string) =>
    `/api/laporan/rekap?slug=${slug}&format=${format}&dari=${dari}&sampai=${sampai}&kelas=${kelas}&mapel=${mapel}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Export laporan"
        subtitle="Pratinjau di bawah ini persis dengan isi file unduhan."
      />
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
        className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-5"
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
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="h-10 flex-1 rounded-lg bg-zinc-950 text-sm font-medium text-white"
          >
            Tampilkan
          </button>
        </div>
      </form>

      {rekap && (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-5 text-center">
            <p className="text-lg font-bold uppercase">{kop.nama}</p>
            {kop.alamat && <p className="text-xs text-zinc-500">{kop.alamat}</p>}
            <p className="mt-2 text-sm font-bold">REKAP KEHADIRAN SISWA</p>
            <p className="text-xs text-zinc-500">
              Periode {dari} s.d. {sampai}
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-2 pr-2">No</th>
                    <th className="py-2 pr-2">Nama</th>
                    <th className="py-2 pr-2">Kelas</th>
                    <th className="py-2 pr-2">H</th>
                    <th className="py-2 pr-2">I</th>
                    <th className="py-2 pr-2">S</th>
                    <th className="py-2 pr-2">A</th>
                    <th className="py-2 pr-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {rekap.rows.map((r, i) => (
                    <tr key={r.siswa_id} className="border-b border-zinc-100 last:border-0">
                      <td className="py-2 pr-2">{i + 1}</td>
                      <td className="py-2 pr-2 font-medium">{r.nama}</td>
                      <td className="py-2 pr-2">{r.kelas_nama}</td>
                      <td className="py-2 pr-2">{r.hadir}</td>
                      <td className="py-2 pr-2">{r.izin}</td>
                      <td className="py-2 pr-2">{r.sakit}</td>
                      <td className="py-2 pr-2">{r.alpha}</td>
                      <td className="py-2 pr-2 font-semibold">
                        {r.total === 0 ? "—" : `${r.persen}%`}
                      </td>
                    </tr>
                  ))}
                  {rekap.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-sm text-zinc-500">
                        Tidak ada data pada filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex gap-2">
            <a
              href={dl("xlsx")}
              className="flex h-12 flex-1 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white"
            >
              Unduh Excel
            </a>
            <a
              href={dl("pdf")}
              className="flex h-12 flex-1 items-center justify-center rounded-full border border-zinc-950 px-5 text-sm font-medium"
            >
              Unduh PDF
            </a>
          </div>
        </>
      )}
    </div>
  );
}
