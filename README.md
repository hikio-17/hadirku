# Hadirku — Absensi Siswa (multi-tenant, open source)

Aplikasi web absensi siswa multi-tenant: satu deployment melayani banyak sekolah.
Data tiap sekolah tersimpan di Google Spreadsheet milik sekolah itu sendiri;
platform hanya menyimpan registry (nama sekolah, email admin, ID sheet, token
terenkripsi). Bahasa antarmuka: Bahasa Indonesia. Mobile-first.

> Status: **Tahap 5** — modul Guru (dashboard, input absensi, rekap &
> riwayat, ubah + log, persetujuan izin wali). Export Excel/PDF, modul Siswa,
> dan mode self-host menyusul di Tahap 6–9.

## Tech stack

Next.js 15 (App Router) + TypeScript strict, Tailwind CSS + shadcn/ui,
Auth.js v5, googleapis (Sheets v4 + Drive v3), Upstash Redis, Zod, Vitest.
Lihat `package.json` untuk daftar lengkap per tahap.

## Mulai cepat

```bash
# Node 22 + pnpm
nvm use # atau sesuaikan versi Node ke 22.x
corepack enable
pnpm install

cp .env.example .env.local
# isi variabel di .env.local (lihat komentar di .env.example)

pnpm dev     # development
pnpm test    # unit test (Vitest)
pnpm lint    # ESLint
pnpm build   # production build
```

Tanpa kredensial Google/Upstash, aplikasi tetap bisa di-test: Redis memakai
fallback memory lokal dan client Google di-mock di unit test.

## Registrasi sekolah (Tahap 2)

1. Operator buka `/daftar` → "Daftar dengan Google" (scope: `openid email
profile` + `drive.file` saja, `access_type=offline`, `prompt=consent`).
2. Callback tukar code → refresh token (terenkripsi AES-256-GCM) → sesi setup
   30 menit (cookie hanya berisi ID acak).
3. Wizard `/setup/wizard`: nama + slug sekolah, tahun ajaran, jam pelajaran,
   dan akun admin pertama → aplikasi membuat spreadsheet di Drive operator
   (12 tab + header), seed data awal, dan mencatat di registry.
4. Selesai → alamat login `/s/[slug]/login` untuk dibagikan ke guru.
5. Koneksi terputus (`invalid_grant`) → status `perlu_hubungkan_ulang`;
   hubungkan ulang via `/api/auth/google/reconnect?slug=...` memakai
   spreadsheet yang sama.

Semua baca data sekolah wajib lewat `getTenantContext(slug)` di
`src/lib/google/tenant-client.ts` (cache token = expires_in − 5 mnt,
lock Redis saat refresh).

## Login & akses (Tahap 3)

- Login di `/s/[slug]/login` (username unik per sekolah, password bcrypt).
  Rate limit per slug+username+IP dicek sebelum verifikasi.
- Sesi JWT Auth.js v5 (12 jam): `{ id, username, role, schoolId, slug,
mustChange }` — tanpa `password_hash`. Google OAuth tidak lewat Auth.js
  (butuh refresh token persisten + scope drive.file, lihat Tahap 2).
- `middleware.ts` (Edge, via `next-auth/jwt`) + layout `(terlindungi)`
  (Node) menegakkan: wajib login, slug URL == slug sesi (anti lintas
  sekolah), role per segmen (`admin|guru|siswa`), dan wajib ganti password.
- Ganti password: `/s/[slug]/ganti-password` (wajib saat login pertama /
  setelah reset admin), dilanjutkan login ulang agar klaim sesi segar.
- Reset password oleh admin: `resetPasswordByAdmin()` di
  `src/lib/services/auth.ts` (UI admin menyusul Tahap 4).

## Modul admin (Tahap 4)

- `/s/[slug]/admin/data`: akun pengguna (buat, ubah, aktif/nonaktif, reset
  password), profil guru & siswa (terhubung akun login), kelas, mapel,
  tahun ajaran (satu aktif), penugasan guru×kelas×mapel, jadwal, pengaturan.
- Username unik per sekolah; NIP/NIS unik bila diisi. Hapus diblok bila
  masih dirujuk (kelas→siswa/penugasan, guru→penugasan, dst); akun hanya
  dinonaktifkan (tak bisa menonaktifkan diri sendiri).
- Impor Excel: unduh template (`/api/admin/template/guru|siswa`) → unggah
  (maks 5 MB) → pratinjau + error per nomor baris → konfirmasi (1 append
  akun + 1 append profil). Batch sementara 10 menit, sekali pakai.

## Modul guru (Tahap 5)

- Dashboard `/s/[slug]/guru`: statistik hari ini, jadwal + tombol Mulai
  Absen, filter kelas/mapel, tren 7 hari (grafik), kehadiran rendah
  (< ambang pengaturan), izin menunggu + setujui/tolak (khusus wali).
- Input `/s/[slug]/guru/absensi`: ketuk H/I/S/A, semua-hadir, catatan,
  cari, progres; draft localStorage + kirim ulang; simpan hemat
  (1 batchUpdate + append seperlunya).
- Rekap `/s/[slug]/guru/rekap`: filter periode/kelas/mapel/status, tabel
  per siswa + %, riwayat 20/halaman, ubah + `log_perubahan`.
- Semua tulis diverifikasi milik penugasan guru (anti lintas kelas).

## Rotasi kunci enkripsi

```bash
export OLD_TOKEN_ENCRYPTION_KEY="<kunci lama>"
export TOKEN_ENCRYPTION_KEY="<kunci baru>"  # openssl rand -base64 32
export GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
export GOOGLE_PRIVATE_KEY="..."
export REGISTRY_SHEET_ID="..."
pnpm keys:rotate
```

## Struktur folder

```
src/
  app/                  # routes (marketing, auth, s/[slug], api)
  components/           # komponen UI (shadcn/ui)
  lib/
    crypto/token.ts     # AES-256-GCM untuk refresh token + redact log
    redis.ts            # cache, lock (SET NX EX), fallback memory
    ratelimit.ts        # rate limit login (Upstash, fallback memory)
    registry/           # RegistryRepo (tab `schools` via Service Account)
    google/             # oauth, tenant-client, provision (Tahap 2)
    storage/
      types.ts          # interface Repository<T> + tipe baris (storage-agnostic)
      sheets/           # SheetsTable<T> + repository per entitas
      postgres/         # stub migrasi Supabase (Tahap 9)
      index.ts          # factory adapter per sekolah
    services/           # logika bisnis (Tahap 5+)
    validations/        # skema Zod
    export/             # generator xlsx & pdf (Tahap 6)
  types/                # tipe bersama
```

Aturan keras: UI tidak boleh memanggil Google API langsung. Alurnya
Server Action/Route Handler → service → repository → adapter.

## Environment

Lihat `.env.example`. Kunci enkripsi dibuat dengan:

```bash
openssl rand -base64 32
```

## Lisensi

MIT — lihat `LICENSE`.
