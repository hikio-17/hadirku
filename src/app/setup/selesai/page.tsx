import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SelesaiPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const { slug } = await searchParams;
  if (!slug) redirect("/daftar");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const loginUrl = `${appUrl}/s/${slug}/login`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-5 px-5 py-10">
      <p className="text-4xl">🎉</p>
      <h1 className="text-3xl font-bold tracking-tight">Sekolah siap digunakan</h1>
      <p className="text-sm leading-6 text-zinc-600">
        Spreadsheet absensi sudah dibuat di Google Drive Anda dan akun admin pertama sudah aktif.
        Bagikan alamat login berikut ke guru dan siswa:
      </p>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-xs text-zinc-500">Alamat login sekolah</p>
        <p className="break-all font-mono text-base font-semibold">{loginUrl}</p>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-700">
        <li>Login sebagai admin dengan username + password yang baru dibuat.</li>
        <li>Impor data guru dan siswa dari Excel (tersedia di dashboard admin, Tahap 4).</li>
        <li>Bagikan alamat login ke guru dan siswa.</li>
      </ol>

      <Link
        href={`/s/${slug}/login`}
        className="flex h-12 items-center justify-center rounded-full bg-zinc-950 px-5 text-base font-medium text-white transition-colors hover:bg-zinc-800"
      >
        Buka halaman login
      </Link>
      <p className="text-xs text-zinc-500">
        Koneksi Google terputus di kemudian hari? Admin bisa klik “Hubungkan ulang” di dashboard
        tanpa membuat spreadsheet baru.
      </p>
    </main>
  );
}
