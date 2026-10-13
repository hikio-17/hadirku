# Hadirku — Absensi Siswa (multi-tenant, open source)

Aplikasi web absensi siswa multi-tenant: satu deployment melayani banyak sekolah.
Data tiap sekolah tersimpan di Google Spreadsheet milik sekolah itu sendiri;
platform hanya menyimpan registry (nama sekolah, email admin, ID sheet, token
terenkripsi). Bahasa antarmuka: Bahasa Indonesia. Mobile-first.

> Status: **selesai Tahap 1–9** — fondasi, registrasi satu-klik, auth+RBAC,
> modul Admin, modul Guru, export Excel/PDF, modul Siswa, privasi+backup,
> self-host + Postgres.

## Fitur per peran

- **Guru**: dashboard (statistik, jadwal + Mulai Absen, tren 7 hari, kehadiran
  rendah, izin menunggu), input absensi 1-ketuk + draft offline, rekap &
  riwayat + ubah + log, export Excel/PDF berkop, setujui/tolak izin (wali).
- **Siswa**: beranda %, kalender bulanan, riwayat per mapel, form izin/sakit
  - bukti Drive, batalkan selagi menunggu.
- **Admin sekolah**: CRUD akun/guru/siswa/kelas/mapel/tahun ajaran/penugasan/
  jadwal/pengaturan, impor Excel + template, reset password, backup Excel,
  status + hubung-ulang + putus koneksi Google.

## Tech stack

Next.js 15 (App Router) + TypeScript strict · Tailwind + shadcn pola +
lucide-react · Auth.js v5 (Credentials+JWT) · googleapis (Sheets v4, Drive v3)
· Upstash Redis (cache, lock, rate limit) · Zod · exceljs · jspdf · bcryptjs ·
nanoid · Vitest · MIT.

## Mulai cepat

```bash
nvm use            # Node 22 (lihat .nvmrc)
corepack enable
pnpm install
cp .env.example .env.local   # isi variabel di bawah

pnpm dev           # http://localhost:3000
pnpm test          # unit test
pnpm lint          # eslint
pnpm build         # production build
```

Tanpa kredensial Google/Upstash, test tetap hijau (mock + fallback memory).

## Environment

| Variabel                                              | Wajib       | Keterangan                           |
| ----------------------------------------------------- | ----------- | ------------------------------------ |
| `AUTH_SECRET`                                         | prod        | `npx auth secret`                    |
| `NEXT_PUBLIC_APP_URL`                                 | ya          | Tanpa trailing slash                 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`           | multitenant | OAuth pendaftaran                    |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` | ya          | Akses registry (+ self-host)         |
| `REGISTRY_SHEET_ID`                                   | multitenant | Spreadsheet registry, share ke SA    |
| `TOKEN_ENCRYPTION_KEY`                                | multitenant | `openssl rand -base64 32`            |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`                   | prod        | Kosong = memory lokal (dev)          |
| `DEPLOY_MODE`                                         | —           | `multitenant` (default) / `selfhost` |
| `SELFHOST_SPREADSHEET_ID` / `_SLUG` / `_SCHOOL_NAME`  | selfhost    | Lihat bawah                          |
| `DATABASE_URL`                                        | migrasi     | Postgres tujuan migrasi              |

Registry: satu spreadsheet dengan tab `schools` (`school_id, slug,
nama_sekolah, owner_email, sheet_id, refresh_token_enc, status,
storage_adapter, dibuat_pada, terakhir_aktif`), di-share hanya ke email SA.

## Alur pendaftaran sekolah (multitenant)

`/daftar` → Daftar dengan Google (scope `drive.file` saja) → wizard
(nama, slug, tahun ajaran, admin pertama + persetujuan pengendali data) →
spreadsheet dibuat di Drive operator → URL login `/s/[slug]/login`.

## Deploy ke Vercel (gratis)

1. Push repo ke GitHub, import di Vercel (preset Next.js).
2. Set **Node.js 22.x** (Settings → General → Node Version).
3. Isi Environment Variables sesuai tabel (Production + Preview).
   `GOOGLE_PRIVATE_KEY`: tempel isi penuh termasuk `-----BEGIN...`
   (Vercel menangani newline `\n` otomatis; kode juga menormalisasi).
4. Deploy. Buka `/daftar` untuk sekolah pertama.
5. (Opsional) Upstash Redis gratis via Vercel Marketplace → tempel URL+token.
   Tanpa ini, cache memakai memory (tidak disarankan multi-instance).

## Jalur self-host (satu sekolah)

1. Di Google Cloud Console: buat project → aktifkan **Sheets API + Drive API**
   → buat **Service Account** → buat key JSON → catat email + private key.
2. Siapkan spreadsheet:
   ```bash
   export GOOGLE_SERVICE_ACCOUNT_EMAIL="sa@...iam.gserviceaccount.com"
   export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
   pnpm seed:selfhost --title="Hadirku - SDN 1"
   # catat ID yang dicetak; buat akun admin pertama manual:
   # tab users ← id bebas, nama, username, password_hash (bcrypt), role=admin,
   # aktif=TRUE, wajib_ganti_password=TRUE, dibuat_pada=now
   ```
   Hash bcrypt bisa dibuat dengan `node -e "console.log(require('bcryptjs').hashSync('rahasia123', 12))"`.
   Alternatif: bagikan spreadsheet kosong ke email SA (Editor), lalu buat
   header manual sesuai `src/lib/storage/sheets/columns.ts`.
3. Env: `DEPLOY_MODE=selfhost`, `SELFHOST_SPREADSHEET_ID`, opsional
   `SELFHOST_SLUG` (default `sekolah`), `SELFHOST_SCHOOL_NAME`, `AUTH_SECRET`.
4. Jalankan (`pnpm dev` / `pnpm build && pnpm start` / Docker sendiri) dan
   buka `/s/[slug]/login`. Rute `/daftar` dan OAuth Google nonaktif otomatis.

## Struktur folder

```
src/
  app/                  # (marketing) landing-teks, (auth) daftar, s/[slug], api
  components/           # app-shell, admin/ui
  lib/
    crypto/token.ts     # AES-256-GCM + redact
    redis.ts            # cache, lock NX EX, fallback memory
    ratelimit.ts        # login 10/10 mnt (+memory)
    registry/           # RegistryRepo + rotasi kunci
    google/             # oauth, tenant-client, provision, sheets-adapter
    storage/            # Repository<T>, sheets/, postgres/
    services/           # master, pengguna, akademik, guru, siswa, setup, impor, auth
    validations/        # zod per modul
    export/             # kop, rekap xlsx/pdf, backup
    selfhost.ts admin-guard.ts nav.ts route-guard.ts security-headers.ts
  types/  scripts/  docs/  .env.example
```

Aturan keras: UI → Server Action/Route Handler → service → repository →
adapter. Semua baca data sekolah lewat `getTenantContext()`.

## Skrip operasional

```bash
pnpm keys:rotate        # rotasi TOKEN_ENCRYPTION_KEY (butuh OLD_TOKEN_ENCRYPTION_KEY)
pnpm migrate:sheets-pg --slug=smpn-1 [--schema=school_smpn1] [--set-adapter]
pnpm seed:selfhost --title="..."   # siapkan spreadsheet self-host
```

Migrasi Postgres: buat database → terapkan `docs/postgres-schema.sql` per
sekolah (satu schema per sekolah) → jalankan migrasi → verifikasi jumlah
baris → `--set-adapter` bila runtime Postgres sudah siap (lihat catatan di
`docs/postgres-schema.sql`).

## Keamanan & privasi

Header CSP/HSTS/DENY, bcrypt cost 12, rate limit login, JWT 12 jam tanpa
hash, token tak pernah ke client/log, lock refresh, banner hubung-ulang.
Detail: `/kebijakan-privasi`, `/syarat-ketentuan`.

## Lisensi

MIT — lihat `LICENSE`. Kontribusi: baca `CONTRIBUTING.md`.
