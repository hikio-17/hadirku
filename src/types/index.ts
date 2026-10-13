/**
 * Tipe bersama yang bebas dari detail storage.
 * File ini hanya berisi tipe (type-only), jadi aman di-import dari mana saja.
 * Implementasi repository ada di `src/lib/storage/`.
 */

export type Role = "admin" | "guru" | "siswa";

export type StatusKehadiran = "H" | "I" | "S" | "A";

export type StatusIzin = "menunggu" | "disetujui" | "ditolak";

export type JenisIzin = "izin" | "sakit";

export type StatusSekolah = "aktif" | "perlu_hubungkan_ulang" | "nonaktif";

export type StorageAdapter = "sheets" | "postgres";

export interface TenantContext {
  schoolId: string;
  slug: string;
  spreadsheetId: string;
  storageAdapter: StorageAdapter;
}
