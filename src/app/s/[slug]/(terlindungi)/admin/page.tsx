import { auth } from "@/auth";

export const dynamic = "force-dynamic";

function HomeCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: string[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <p className="text-sm font-semibold">Berikutnya di Hadirku</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default async function AdminHome() {
  const session = await auth();
  return (
    <HomeCard
      title={`Dashboard, ${session?.user.name ?? "Admin"}`}
      subtitle="Kelola data sekolah, pantau kehadiran, dan atur koneksi Google."
      items={[
        "Manajemen data guru, siswa, kelas & penugasan (Tahap 4).",
        "Rekap seluruh sekolah + status koneksi Google (Tahap 7–8).",
        "Impor guru/siswa dari Excel (Tahap 4).",
      ]}
    />
  );
}
