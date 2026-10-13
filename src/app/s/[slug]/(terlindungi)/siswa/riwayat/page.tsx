import { requireSiswa } from "@/lib/admin-guard";
import { getBerandaSiswa } from "@/lib/services/siswa";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const WARNA: Record<string, string> = {
  H: "bg-green-100 text-green-800",
  I: "bg-amber-100 text-amber-800",
  S: "bg-sky-100 text-sky-800",
  A: "bg-red-100 text-red-800",
};
const NAMA: Record<string, string> = { H: "Hadir", I: "Izin", S: "Sakit", A: "Alpha" };

export default async function RiwayatPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bulan?: string }>;
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
  let loadError = "";
  try {
    const s = await requireSiswa();
    beranda = await getBerandaSiswa(s.ctx.sheets, s.ctx.context.spreadsheetId, s.siswa, bulan);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  return (
    <div>
      <PageHeader
        title="Riwayat kehadiran"
        subtitle="Per mapel + 20 catatan terakhir."
        backHref={`/s/${slug}/siswa`}
      />
      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {loadError}
        </div>
      )}
      {beranda && (
        <>
          <section className="mb-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="px-4 py-3">Mapel</th>
                  <th className="px-4 py-3">Hadir</th>
                  <th className="px-4 py-3">%</th>
                </tr>
              </thead>
              <tbody>
                {beranda.perMapel.map((m) => (
                  <tr key={m.mapel_id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-medium">{m.mapel_nama}</td>
                    <td className="px-4 py-3">{m.total} pertemuan</td>
                    <td className="px-4 py-3 font-semibold">{m.persen}%</td>
                  </tr>
                ))}
                {beranda.perMapel.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500">
                      Belum ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Terakhir dicatat</h2>
            <ul className="mt-2 divide-y divide-zinc-100">
              {beranda.riwayat.map((r, i) => (
                <li
                  key={`${r.tanggal}-${i}`}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>
                    {r.mapel_nama} · <span className="font-mono text-xs">{r.tanggal}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${WARNA[r.status]}`}
                  >
                    {NAMA[r.status]}
                  </span>
                </li>
              ))}
              {beranda.riwayat.length === 0 && (
                <li className="py-4 text-center text-sm text-zinc-500">Belum ada catatan.</li>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
