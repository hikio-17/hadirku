import { requireGuru } from "@/lib/admin-guard";
import {
  getAbsensiForm,
  listJadwalGuru,
  todayWIB,
  type AbsensiFormData,
} from "@/lib/services/guru";
import { AbsensiForm } from "./absensi-form";

export const dynamic = "force-dynamic";

export default async function AbsensiPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ jadwal?: string; tanggal?: string }>;
}) {
  const { slug } = await params;
  const { jadwal = "", tanggal = todayWIB() } = await searchParams;

  let options: Awaited<ReturnType<typeof listJadwalGuru>> = [];
  let form: AbsensiFormData | null = null;
  let loadError = "";
  try {
    const g = await requireGuru();
    const sid = g.ctx.context.spreadsheetId;
    options = await listJadwalGuru(g.ctx.sheets, sid, g.guru.id);
    if (jadwal) {
      form = await getAbsensiForm(g.ctx.sheets, sid, g.guru.id, jadwal, tanggal);
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Input absensi</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Pilih jadwal dan tanggal, ketuk status tiap siswa.
      </p>
      {loadError && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {loadError}
        </div>
      )}

      <form method="get" className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
        <select
          name="jadwal"
          defaultValue={jadwal}
          required
          className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
        >
          <option value="" disabled>
            Pilih jadwal…
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.hari} {o.jam_mulai} · {o.kelas_nama} · {o.mapel_nama}
            </option>
          ))}
        </select>
        <input
          name="tanggal"
          type="date"
          defaultValue={tanggal}
          required
          className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm"
        />
        <button
          type="submit"
          className="h-11 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white"
        >
          Buka
        </button>
      </form>

      {options.length === 0 && !loadError && (
        <p className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
          Belum ada jadwal untuk Anda. Hubungi admin untuk penugasan.
        </p>
      )}

      {form && (
        <div className="mt-5">
          <div className="mb-3 rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm font-semibold">
              {form.jadwal?.kelas_nama} · {form.jadwal?.mapel_nama}
            </p>
            <p className="text-xs text-zinc-500">
              {form.tanggal} · {form.siswa.length} siswa
            </p>
          </div>
          <AbsensiForm jadwalId={jadwal} tanggal={tanggal} initial={form.siswa} />
          <p className="mt-3 text-xs text-zinc-500">
            Kembali ke{" "}
            <a href={`/s/${slug}/guru`} className="underline">
              dashboard
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
