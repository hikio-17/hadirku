import Link from "next/link";

import { requireGuru } from "@/lib/admin-guard";
import { getDashboardGuru, listPenugasanGuru, todayWIB } from "@/lib/services/guru";
import { Notice } from "@/components/admin/ui";
import { approveAction } from "./actions";
import { TrenChart } from "./tren-chart";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        {label}
        {sub ? ` · ${sub}` : ""}
      </p>
    </div>
  );
}

export default async function GuruDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string; kelas?: string; mapel?: string }>;
}) {
  const { slug } = await params;
  const { ok = "", error = "", kelas = "", mapel = "" } = await searchParams;
  const tanggal = todayWIB();

  let data: Awaited<ReturnType<typeof getDashboardGuru>> | null = null;
  let tugas: Awaited<ReturnType<typeof listPenugasanGuru>> = [];
  let loadError = "";
  let guruNama = "";
  try {
    const g = await requireGuru();
    guruNama = g.guru.nama;
    const sid = g.ctx.context.spreadsheetId;
    [data, tugas] = await Promise.all([
      getDashboardGuru(g.ctx.sheets, sid, g.guru, tanggal, {
        kelasId: kelas || undefined,
        mapelId: mapel || undefined,
      }),
      listPenugasanGuru(g.ctx.sheets, sid, g.guru.id),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat dashboard.";
  }

  const kelasList = [...new Map(tugas.map((t) => [t.kelas_id, t.kelas_nama])).entries()];
  const mapelList = [...new Map(tugas.map((t) => [t.mapel_id, t.mapel_nama])).entries()];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Halo, {guruNama || "Bapak/Ibu Guru"}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Ringkasan hari ini · {tanggal}
          {data && (kelas || mapel) ? " (terfilter)" : ""}
        </p>
      </div>
      <Notice ok={ok} error={error} />
      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {loadError}
        </div>
      )}
      {data && (
        <>
          {(tugas.length > 1 || kelas || mapel) && (
            <form method="get" className="flex flex-wrap gap-2">
              <select
                name="kelas"
                defaultValue={kelas}
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              >
                <option value="">Semua kelas</option>
                {kelasList.map(([id, nama]) => (
                  <option key={id} value={id}>
                    {nama}
                  </option>
                ))}
              </select>
              <select
                name="mapel"
                defaultValue={mapel}
                className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
              >
                <option value="">Semua mapel</option>
                {mapelList.map(([id, nama]) => (
                  <option key={id} value={id}>
                    {nama}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-10 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white"
              >
                Tampilkan
              </button>
            </form>
          )}

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Stat label="Total siswa" value={String(data.statistik.total)} />
            <Stat label="Hadir" value={String(data.statistik.hadir)} />
            <Stat label="Izin" value={String(data.statistik.izin)} />
            <Stat label="Sakit" value={String(data.statistik.sakit)} />
            <Stat label="Alpha" value={String(data.statistik.alpha)} />
            <Stat label="Belum absen" value={String(data.statistik.belum)} />
          </div>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Jadwal hari ini</h2>
            {data.jadwal.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                Tidak ada jadwal hari ini. Nikmati harinya.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-100">
                {data.jadwal.map((j) => (
                  <li key={j.id} className="flex items-center gap-3 py-3">
                    <span className="w-11 shrink-0 font-mono text-xs">{j.jam_mulai}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {j.kelas_nama} · {j.mapel_nama}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {j.sudah_diabsen}/{j.total_siswa} sudah diabsen
                      </p>
                    </div>
                    <Link
                      href={`/s/${slug}/guru/absensi?jadwal=${j.id}&tanggal=${tanggal}`}
                      className="shrink-0 rounded-full bg-zinc-950 px-4 py-2 text-xs font-medium text-white"
                    >
                      {j.sudah_diabsen > 0 ? "Lanjut" : "Mulai Absen"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Tren kehadiran 7 hari</h2>
            <p className="text-xs text-zinc-500">Persentase hadir per hari (%).</p>
            <div className="mt-2">
              <TrenChart data={data.tren} />
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-semibold">Kehadiran rendah</h2>
              {data.rendah.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Semua siswa di atas ambang. Bagus.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.rendah.map((r) => (
                    <li key={r.siswa_id}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{r.nama}</span>
                        <span className="text-red-700">{r.persen}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-100">
                        <div
                          className="h-1.5 rounded-full bg-red-500"
                          style={{ width: `${r.persen}%` }}
                        />
                      </div>
                      <p className="text-xs text-zinc-500">{r.kelas_nama}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="text-sm font-semibold">
                Pengajuan izin{" "}
                {data.izinPending.length > 0 && (
                  <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    {data.izinPending.length} menunggu
                  </span>
                )}
              </h2>
              {data.izinPending.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">Tidak ada pengajuan menunggu.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {data.izinPending.map((p) => (
                    <li key={p.id} className="rounded-lg bg-zinc-50 p-3">
                      <p className="text-sm font-medium">
                        {p.siswa_nama} · {p.jenis}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {p.tanggal} · {p.kelas_nama}
                      </p>
                      <p className="mt-1 text-sm">{p.alasan}</p>
                      {p.bisaSetujui ? (
                        <div className="mt-2 flex gap-2">
                          <form action={approveAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="setuju" value="true" />
                            <button
                              type="submit"
                              className="rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-medium text-white"
                            >
                              Setujui
                            </button>
                          </form>
                          <form action={approveAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="setuju" value="false" />
                            <button
                              type="submit"
                              className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-medium"
                            >
                              Tolak
                            </button>
                          </form>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-zinc-500">
                          Menunggu persetujuan wali kelas.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
