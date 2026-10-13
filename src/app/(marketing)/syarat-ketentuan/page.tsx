import Link from "next/link";

export default function SyaratPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 text-sm leading-7 text-zinc-700">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Hadirku</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">Syarat Penggunaan</h1>
      <p className="mt-1 text-xs text-zinc-500">Terakhir diperbarui: Oktober 2026.</p>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-950">1. Layanan</h2>
        <p>
          Hadirku adalah aplikasi absensi siswa sumber terbuka (lisensi MIT) yang berjalan di atas
          Google Spreadsheet dan Google Drive milik masing-masing sekolah. Layanan disediakan
          “sebagaimana adanya” tanpa jaminan ketersediaan, mengikuti batas kuota gratis Google dan
          platform hosting yang dipakai.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-950">2. Tanggung jawab sekolah</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Menjaga kerahasiaan akun admin, guru, dan siswa.</li>
          <li>Memastikan dasar hukum pemrosesan data siswa (terutama data anak).</li>
          <li>Mencadangkan data secara berkala (tersedia tombol backup Excel).</li>
          <li>Tidak menyalahgunakan layanan untuk data di luar keperluan absensi sekolah.</li>
        </ul>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-950">3. Akun</h2>
        <p>
          Admin sekolah bertanggung jawab atas akun yang dibuatnya, termasuk me-reset kata sandi
          bila diperlukan. Pengguna wajib mengganti kata sandi saat login pertama. Akses yang
          melanggar (misalnya mencoba membuka data sekolah lain) akan ditolak sistem.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-base font-bold text-zinc-950">4. Penghentian</h2>
        <p>
          Sekolah dapat berhenti kapan saja dengan mencabut akses Google dan menghapus
          spreadsheet-nya; token platform ikut terhapus. Pelanggaran syarat dapat mengakibatkan
          penonaktifan pendaftaran sekolah di registry.
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
