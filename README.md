# Hadirku — Absensi Siswa (multi-tenant, open source)

Aplikasi web absensi siswa multi-tenant: satu deployment melayani banyak sekolah.
Data tiap sekolah tersimpan di Google Spreadsheet milik sekolah itu sendiri;
platform hanya menyimpan registry (nama sekolah, email admin, ID sheet, token
terenkripsi). Bahasa antarmuka: Bahasa Indonesia. Mobile-first.

> Status: **Tahap 2** — registrasi sekolah satu-klik (Google OAuth, provisioning
> spreadsheet otomatis, tenant-client + cache/lock token, wizard setup).
> Modul Auth Credentials/RBAC, Guru, Siswa, dan Export menyusul di Tahap 3–9.

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
