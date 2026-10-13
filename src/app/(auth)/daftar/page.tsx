import Link from "next/link";

import { isSelfHostMode, selfHostSlug } from "@/lib/selfhost";

const ERRORS: Record<string, string> = {
  ditolak: "Pendaftaran dibatalkan di halaman Google. Klik tombol di bawah untuk mencoba lagi.",
  sesi: "Sesi pendaftaran kedaluwarsa atau tidak valid. Klik tombol di bawah untuk mengulang.",
  gagal: "Pendaftaran gagal. Coba lagi beberapa saat lagi.",
  token:
    "Google tidak menerbitkan izin akses Drive. Ulangi dan pastikan Anda menyetujui semua izin.",
  konfigurasi: "Layanan pendaftaran belum dikonfigurasi oleh pemilik platform.",
  sekolah: "Data sekolah tidak ditemukan. Ulangi pendaftaran dari awal.",
};

export default async function DaftarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; putus?: string }>;
}) {
  const { error, putus } = await searchParams;
  const errorMsg = error ? (ERRORS[error] ?? ERRORS.gagal) : null;

  if (isSelfHostMode()) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Mode mandiri</h1>
        <p className="text-sm leading-6 text-zinc-600">
          Server ini melayani satu sekolah tanpa pendaftaran Google. Langsung masuk ke halaman login
          sekolah:
        </p>
        <Link
          href={`/s/${selfHostSlug()}/login`}
          className="flex h-12 items-center justify-center rounded-full bg-zinc-950 px-5 text-base font-medium text-white"
        >
          Buka halaman login
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div>
        <p className="text-sm font-semibold text-zinc-500">Hadirku</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Daftarkan sekolah Anda</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Satu klik dengan akun Google operator sekolah. Aplikasi akan membuatkan spreadsheet
          absensi di Google Drive milik sekolah Anda.
        </p>
      </div>

      {putus && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Koneksi diputus dan token dihapus. Spreadsheet di Drive Anda tidak ikut terhapus.
        </div>
      )}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMsg}
        </div>
      )}

      <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-700">
        <li>Klik tombol di bawah dan pilih akun Google operator.</li>
        <li>Setujui izin (data profil + pembuatan file di Drive Anda).</li>
        <li>Lengkapi nama sekolah, tahun ajaran, dan akun admin pertama.</li>
      </ol>

      <Link
        href="/api/auth/google/start"
        className="flex h-12 items-center justify-center rounded-full bg-zinc-950 px-5 text-base font-medium text-white transition-colors hover:bg-zinc-800"
      >
        Daftar dengan Google
      </Link>

      <div className="rounded-lg bg-zinc-100 px-4 py-3 text-xs leading-5 text-zinc-600">
        <p className="font-semibold text-zinc-700">Privasi data</p>
        <p>
          Data siswa tersimpan di Google Drive milik sekolah Anda, bukan di server platform.
          Platform hanya menyimpan nama sekolah, email admin, ID spreadsheet, dan token akses
          terenkripsi. Akses dapat dicabut kapan saja lewat pengaturan akun Google Anda
          (myaccount.google.com/permissions). Selengkapnya:{" "}
          <Link href="/kebijakan-privasi" className="underline">
            Kebijakan Privasi
          </Link>{" "}
          dan{" "}
          <Link href="/syarat-ketentuan" className="underline">
            Syarat Penggunaan
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
