import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function SiswaHome() {
  const session = await auth();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Halo, {session?.user.name ?? "Siswa"}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Lihat persentase kehadiranmu dan ajukan izin atau sakit bila perlu.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <p className="text-sm font-semibold">Berikutnya di Hadirku</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600">
          <li>Persentase + kalender kehadiran (Tahap 7).</li>
          <li>Form izin/sakit dengan bukti foto (Tahap 7).</li>
          <li>Riwayat per mapel (Tahap 7).</li>
        </ul>
      </div>
    </div>
  );
}
