import Link from "next/link";

import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "pengguna", title: "Akun pengguna", desc: "Akun login, reset password, aktif/nonaktif." },
  { href: "guru", title: "Data guru", desc: "Profil guru, NIP, wali kelas." },
  { href: "siswa", title: "Data siswa", desc: "Profil siswa, NIS, kelas." },
  { href: "kelas", title: "Kelas", desc: "Rombel per tahun ajaran." },
  { href: "mapel", title: "Mapel", desc: "Mata pelajaran + kode." },
  { href: "tahun-ajaran", title: "Tahun ajaran", desc: "Periode aktif (satu aktif)." },
  { href: "penugasan", title: "Penugasan", desc: "Guru × kelas × mapel." },
  { href: "jadwal", title: "Jadwal", desc: "Jam mengajar per hari." },
  { href: "impor", title: "Impor Excel", desc: "Guru & siswa massal + template." },
  { href: "pengaturan", title: "Pengaturan", desc: "Profil sekolah, kop, ambang." },
];

export default async function DataHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = `/s/${slug}/admin/data`;
  return (
    <div>
      <PageHeader
        title="Manajemen data"
        subtitle="Master data sekolah. Hapus diblok bila masih dipakai data lain."
        backHref={`/s/${slug}/admin`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={`${base}/${s.href}`}
            className="rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-950"
          >
            <p className="text-sm font-semibold">{s.title}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
