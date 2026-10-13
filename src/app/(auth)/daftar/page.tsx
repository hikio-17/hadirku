import Link from "next/link";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMsg = error ? (ERRORS[error] ?? ERRORS.gagal) : null;

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
          (myaccount.google.com/permissions). Kebijakan privasi lengkap menyusul di Tahap 8.
        </p>
      </div>
    </main>
  );
}
