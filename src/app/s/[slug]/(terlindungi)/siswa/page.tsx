import Link from "next/link";

import { requireSiswa } from "@/lib/admin-guard";
import { getBerandaSiswa } from "@/lib/services/siswa";
import { Notice } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const WARNA: Record<string, string> = {
  H: "bg-green-600 text-white",
  I: "bg-amber-500 text-white",
  S: "bg-sky-600 text-white",
  A: "bg-red-600 text-white",
};
const NAMA_STATUS: Record<string, string> = { H: "Hadir", I: "Izin", S: "Sakit", A: "Alpha" };

function bulanLain(bulan: string, delta: number): string {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function SiswaHome({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bulan?: string; ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const bulan =
    sp.bulan && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.bulan)
      ? sp.bulan
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
        })
          .format(new Date())
          .slice(0, 7);

  let beranda: Awaited<ReturnType<typeof getBerandaSiswa>> | null = null;
  let nama = "";
  let loadError = "";
  try {
    const s = await requireSiswa();
    nama = s.siswa.nama;
    beranda = await getBerandaSiswa(s.ctx.sheets, s.ctx.context.spreadsheetId, s.siswa, bulan);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  const offset = beranda ? new Date(`${beranda.bulan}-01T12:00:00`).getDay() : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Halo, {nama || "Siswa"}</h1>
        <p className="mt-1 text-sm text-zinc-600">Kehadiranmu semester berjalan.</p>
      </div>
      <Notice ok={sp.ok ?? ""} error={sp.error ?? ""} />
      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {loadError}
        </div>
      )}
      {beranda && (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-5 text-center">
            <p className="text-5xl font-bold">{beranda.persen}%</p>
            <p className="mt-1 text-xs text-zinc-500">kehadiran keseluruhan</p>
            <div className="mx-auto mt-3 grid max-w-xs grid-cols-4 gap-2 text-center">
              {(["H", "I", "S", "A"] as const).map((st) => (
                <div key={st} className="rounded-lg bg-zinc-50 p-2">
                  <p className="text-lg font-bold">
                    {
                      beranda!.counts[
                        st === "H" ? "hadir" : st === "I" ? "izin" : st === "S" ? "sakit" : "alpha"
                      ]
                    }
                  </p>
                  <p className="text-[11px] text-zinc-500">{NAMA_STATUS[st]}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Kalender {beranda.bulan}</h2>
              <div className="flex gap-2 text-xs">
                <Link
                  href={`/s/${slug}/siswa?bulan=${bulanLain(beranda.bulan, -1)}`}
                  className="rounded-lg border border-zinc-300 px-2 py-1"
                >
                  ←
                </Link>
                <Link
                  href={`/s/${slug}/siswa?bulan=${bulanLain(beranda.bulan, 1)}`}
                  className="rounded-lg border border-zinc-300 px-2 py-1"
                >
                  →
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-500">
              {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((h) => (
                <span key={h} className="py-1 font-medium">
                  {h}
                </span>
              ))}
              {Array.from({ length: offset }).map((_, i) => (
                <span key={`k${i}`} />
              ))}
              {beranda.kalender.map((k) => (
                <span
                  key={k.tanggal}
                  title={k.status ? `${k.tanggal}: ${NAMA_STATUS[k.status]}` : k.tanggal}
                  className={`flex aspect-square items-center justify-center rounded-lg font-semibold ${
                    k.status ? WARNA[k.status] : "bg-zinc-50 text-zinc-700"
                  }`}
                >
                  {Number(k.tanggal.slice(8))}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Per mapel</h2>
            {beranda.perMapel.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">Belum ada data kehadiran.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {beranda.perMapel.map((m) => (
                  <li key={m.mapel_id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{m.mapel_nama}</span>
                    <span className="text-zinc-500">
                      {m.persen}% · {m.total} pertemuan
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/s/${slug}/siswa/riwayat`}
              className="mt-3 inline-block text-xs font-medium underline"
            >
              Lihat riwayat lengkap
            </Link>
          </section>

          <Link
            href={`/s/${slug}/siswa/izin`}
            className="flex h-12 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white"
          >
            Ajukan izin / sakit
          </Link>
        </>
      )}
    </div>
  );
}
