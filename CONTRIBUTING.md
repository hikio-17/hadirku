# Berkontribusi ke Hadirku

Terima kasih ingin berkontribusi. Baca dulu README (arsitektur + setup).

## Bahasa

Bahasa Indonesia untuk UI, pesan error, komentar penting, dan diskusi.
Kode (nama variabel/fungsi) memakai Bahasa Inggris.

## Alur kerja

1. Fork + branch dari `main`: `feat/...`, `fix/...`, `docs/...`, `test/...`,
   `refactor/...`, `chore/...`.
2. Satu PR = satu topik. Jaga perubahan kecil dan terfokus.
3. Pesan commit gaya umum: `feat: ...`, `fix: ...`, dst. Contoh:
   `feat: filter tanggal di rekap guru`.
4. Sebelum push, wajib hijau semua:
   ```bash
   pnpm test && pnpm lint && pnpm build
   pnpm exec prettier --check "src/**/*.ts" "src/**/*.tsx"
   ```

## Aturan arsitektur (keras)

- UI tidak memanggil Google API langsung. Alur wajib:
  Server Action/Route Handler → service (`src/lib/services`) → repository
  (`Repository<T>`) → adapter (`sheets/` / `postgres/`).
- Semua file di `lib/google`, `lib/registry`, `lib/crypto`, `lib/storage`
  diawali `import "server-only"`.
- Semua baca data sekolah lewat `getTenantContext()` (multitenant) atau
  konteks self-host. Tidak ada akses lintas tenant.
- Semua mutasi divalidasi Zod di server. Pesan error Bahasa Indonesia.
- `password_hash` dan token tidak pernah ke client/log (pakai `redactForLog`).
- Test: logika baru wajib unit test (fake client, tanpa panggil Google).
  Lihat `src/test/fakes/sheets-store.ts`.

## Cakupan gratis

Ketergantungan baru harus berjalan di free tier (Vercel Hobby, Upstash
free, Google API) kecuali dirancang opsional (mis. Postgres). Jangan
tambah analitik pihak ketiga default.

## Melapor bug / usul fitur

Buka issue dengan: langkah reproduksi, yang diharapkan vs yang terjadi,
dan (bila relevan) `slug` + waktu kejadian — tanpa password/token.
