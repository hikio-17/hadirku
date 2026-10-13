// Shim "server-only" khusus unit test (Vitest, environment node).
// Di Next.js, package asli melempar error bila di-import dari Client Component;
// di test semua import adalah server-side, jadi modul kosong sudah cukup.
export {};
