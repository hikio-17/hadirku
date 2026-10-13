import Link from "next/link";

import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AdminHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Dashboard, {session?.user.name ?? "Admin"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Kelola data sekolah, pantau kehadiran, dan atur koneksi Google.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/s/${slug}/admin/data`}
          className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-950"
        >
          <p className="text-sm font-semibold">Manajemen data</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Akun, guru, siswa, kelas, mapel, penugasan, jadwal, impor Excel.
          </p>
        </Link>
        <Link
          href={`/s/${slug}/admin/data/pengaturan`}
          className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-950"
        >
          <p className="text-sm font-semibold">Pengaturan sekolah</p>
          <p className="mt-0.5 text-xs text-zinc-500">Profil, kop laporan, ambang kehadiran.</p>
        </Link>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <p className="text-sm font-semibold">Berikutnya di Hadirku</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600">
          <li>Rekap seluruh sekolah + status koneksi Google (Tahap 7–8).</li>
          <li>Backup unduh Excel seluruh data (Tahap 8).</li>
        </ul>
      </div>
    </div>
  );
}
