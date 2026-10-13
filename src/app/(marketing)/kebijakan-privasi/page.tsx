import Link from "next/link";

export default function KebijakanPrivasiPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 text-sm leading-7 text-zinc-700">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Hadirku</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Kebijakan Privasi</h1>
      <p className="mt-1 text-xs text-zinc-500">Terakhir diperbarui: Oktober 2026.</p>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-950">1. Di mana data tersimpan</h2>
        <p>
          Data operasional sekolah — termasuk data guru dan siswa (nama, NIS/NIP, kelas, kehadiran,
          pengajuan izin) — tersimpan di{" "}
          <strong>Google Spreadsheet dan Google Drive milik sekolah Anda sendiri</strong>, yaitu
          akun Google yang dipakai saat mendaftarkan sekolah. Data tersebut{" "}
          <strong>tidak tersimpan di server platform Hadirku</strong>.
        </p>
        <p>
          Platform hanya menyimpan data registry: nama sekolah, email admin, ID spreadsheet, dan
          token akses Google yang terenkripsi (AES-256-GCM). Token dipakai semata-mata untuk
          membaca/menulis spreadsheet milik sekolah Anda atas izin yang telah diberikan.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-950">2. Pengendali data</h2>
        <p>
          Sekolah bertindak sebagai <strong>pengendali data</strong> atas data siswa dan guru,
          sesuai Undang-Undang Pelindungan Data Pribadi (UU PDP). Hal ini terutama penting karena
          sebagian data adalah <strong>data anak</strong>. Sekolah wajib memiliki dasar pemrosesan
          yang sah (misalnya persetujuan orang tua/wali murid) sebelum mengimpor data siswa ke
          aplikasi. Persetujuan ini diminta secara eksplisit saat pendaftaran sekolah.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-950">3. Izin Google yang diminta</h2>
        <p>
          Saat pendaftaran, aplikasi meminta izin <code>drive.file</code>: aplikasi hanya dapat
          mengakses file yang dibuat atau dipilih oleh aplikasi itu sendiri —{" "}
          <strong>bukan seluruh isi Google Drive Anda</strong>. Aplikasi juga membaca profil dasar
          (nama dan email) untuk keperluan pendaftaran.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-950">4. Mencabut akses & menghapus data</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Cabut akses kapan saja lewat akun Google Anda di{" "}
            <span className="font-mono text-xs">myaccount.google.com/permissions</span>, atau lewat
            tombol “Putuskan koneksi & hapus token saya” di dashboard admin (token di-revoke ke
            Google lalu dihapus dari registry).
          </li>
          <li>
            Menghapus spreadsheet di Google Drive sekolah akan menghapus seluruh data operasional
            sekolah tersebut.
          </li>
        </ul>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-950">5. Keamanan & analitik</h2>
        <p>
          Kata sandi tersimpan sebagai hash bcrypt dan tidak pernah dikirim ke peramban. Aplikasi
          menerapkan header keamanan (CSP, HSTS), pembatasan laju login, dan refresh token tidak
          pernah masuk ke log. <strong>Tidak ada analitik pihak ketiga</strong> yang aktif secara
          default.
        </p>
      </section>

      <p className="mt-8">
        <Link href="/daftar" className="font-medium underline">
          ← Kembali ke pendaftaran
        </Link>
      </p>
    </main>
  );
}
