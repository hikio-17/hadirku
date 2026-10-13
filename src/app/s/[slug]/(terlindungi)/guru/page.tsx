import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function GuruHome() {
  const session = await auth();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Halo, {session?.user.name ?? "Bapak/Ibu Guru"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Mulai absensi hari ini, pantau tren kehadiran, dan setujui pengajuan izin.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <p className="text-sm font-semibold">Berikutnya di Hadirku</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600">
          <li>Jadwal hari ini + tombol “Mulai Absen” (Tahap 5).</li>
          <li>Input absensi 1 ketuk per status (Tahap 5).</li>
          <li>Rekap, riwayat & export laporan (Tahap 5–6).</li>
        </ul>
      </div>
    </div>
  );
}
