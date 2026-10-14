import Link from "next/link";

const FITUR = [
  {
    peran: "Guru",
    judul: "Absensi 1 ketuk",
    desc: "Mulai dari jadwal hari ini, tandai H/I/S/A per siswa, tersimpan otomatis dengan draft offline.",
  },
  {
    peran: "Siswa",
    judul: "Pantau & izin mandiri",
    desc: "Persentase kehadiran, kalender bulanan, dan form izin/sakit dengan bukti foto.",
  },
  {
    peran: "Admin",
    judul: "Kelola satu pintu",
    desc: "Master data, penugasan, impor Excel, rekap, backup, dan koneksi Google.",
  },
];

const LANGKAH = [
  { no: "1", judul: "Daftar dengan Google", desc: "Satu klik oleh operator sekolah." },
  { no: "2", judul: "Spreadsheet dibuat otomatis", desc: "Di Drive milik sekolah, bukan server kami." },
  { no: "3", judul: "Bagikan link login", desc: "Guru dan siswa masuk di /s/[sekolah]." },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
        <p className="text-lg font-bold text-brand-700">Hadirku</p>
        <nav className="flex gap-2 text-sm">
          <Link
            href="/daftar"
            className="rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            Daftarkan sekolah
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5">
        <section className="py-14 text-center sm:py-20">
          <p className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Gratis · Multi-tenant · Data milik sekolah
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
            Absensi siswa tanpa kertas, tanpa server mahal
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-zinc-600">
            Satu aplikasi untuk banyak sekolah. Data tersimpan di Google Drive
            milik sekolah Anda — platform hanya menyimpan data pendaftaran.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/daftar"
              className="flex h-12 items-center justify-center rounded-full bg-brand-600 px-6 text-base font-medium text-white hover:bg-brand-700"
            >
              Daftarkan sekolah gratis
            </Link>
            <Link
              href="/kebijakan-privasi"
              className="flex h-12 items-center justify-center rounded-full border border-zinc-300 px-6 text-base font-medium text-zinc-700 hover:border-zinc-950"
            >
              Kebijakan privasi
            </Link>
          </div>
        </section>

        <section className="grid gap-3 pb-12 sm:grid-cols-3">
          {FITUR.map((f) => (
            <div key={f.peran} className="rounded-2xl border border-zinc-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">{f.peran}</p>
              <p className="mt-1 text-base font-bold">{f.judul}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-brand-950 px-6 py-10 text-white sm:px-10">
          <h2 className="text-center text-2xl font-bold">Mulai dalam 3 langkah</h2>
          <ol className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-3">
            {LANGKAH.map((l) => (
              <li key={l.no} className="rounded-xl bg-white/10 p-4">
                <p className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-500 text-sm font-bold">
                  {l.no}
                </p>
                <p className="mt-2 text-sm font-semibold">{l.judul}</p>
                <p className="mt-0.5 text-xs text-white/70">{l.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="flex flex-col items-center justify-between gap-2 py-10 text-xs text-zinc-500 sm:flex-row">
          <p>Hadirku · open source (MIT)</p>
          <p className="flex gap-4">
            <Link href="/kebijakan-privasi" className="underline">
              Kebijakan Privasi
            </Link>
            <Link href="/syarat-ketentuan" className="underline">
              Syarat Penggunaan
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
