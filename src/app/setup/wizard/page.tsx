import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSetupSession, SETUP_COOKIE } from "@/lib/setup-session";
import { submitWizard } from "./actions";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base outline-none focus:border-zinc-950";

export default async function WizardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const setupId = (await cookies()).get(SETUP_COOKIE)?.value;
  if (!setupId) redirect("/daftar?error=sesi");
  const session = await getSetupSession(setupId);
  if (!session) redirect("/daftar?error=sesi");
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <p className="text-sm font-semibold text-zinc-500">Hadirku · Langkah terakhir</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Lengkapi data sekolah</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Terdaftar sebagai <span className="font-medium text-zinc-900">{session.email}</span>.
        Setelah simpan, spreadsheet absensi dibuat di Drive Anda.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <form action={submitWizard} className="mt-6 space-y-5">
        <Field label="Nama sekolah">
          <input
            name="nama_sekolah"
            required
            minLength={3}
            maxLength={120}
            placeholder="cth: SMPN 1 Bandung"
            className={inputCls}
          />
        </Field>

        <Field
          label="Slug (alamat login)"
          hint="Huruf kecil, angka, strip. Contoh: smpn-1-bandung → login di /s/smpn-1-bandung"
        >
          <input
            name="slug"
            required
            minLength={3}
            maxLength={48}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="smpn-1-bandung"
            className={inputCls}
          />
        </Field>

        <Field label="Tahun ajaran aktif" hint="Contoh: 2026/2027">
          <input
            name="tahun_ajaran_nama"
            required
            maxLength={32}
            placeholder="2026/2027"
            className={inputCls}
          />
        </Field>

        <Field label="Semester">
          <select name="semester" required className={inputCls} defaultValue="Ganjil">
            <option value="Ganjil">Ganjil</option>
            <option value="Genap">Genap</option>
          </select>
        </Field>

        <Field label="Jam pelajaran" hint="Contoh: Senin–Jumat 07:00–12:00, 6 JP">
          <input
            name="jam_pelajaran"
            required
            maxLength={120}
            placeholder="Senin–Jumat 07:00–12:00"
            className={inputCls}
          />
        </Field>

        <Field label="Logo sekolah (URL, opsional)">
          <input name="logo_url" type="url" placeholder="https://…" className={inputCls} />
        </Field>

        <div className="rounded-lg bg-zinc-100 px-4 py-3">
          <p className="text-sm font-semibold">Akun admin pertama</p>
          <p className="text-xs text-zinc-500">
            Dipakai login di halaman sekolah. Wajib ganti password saat login pertama.
          </p>
          <div className="mt-3 space-y-4">
            <Field label="Nama admin">
              <input
                name="nama_admin"
                required
                minLength={3}
                maxLength={120}
                placeholder="Nama operator"
                className={inputCls}
              />
            </Field>
            <Field label="Username admin">
              <input
                name="username_admin"
                required
                minLength={3}
                maxLength={32}
                pattern="[a-z0-9_.]+"
                placeholder="admin"
                className={inputCls}
              />
            </Field>
            <Field label="Password admin" hint="Minimal 8 karakter.">
              <input
                name="password_admin"
                type="password"
                required
                minLength={8}
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-base font-medium text-white transition-colors hover:bg-zinc-800"
        >
          Buat spreadsheet & selesaikan
        </button>
      </form>
    </main>
  );
}
