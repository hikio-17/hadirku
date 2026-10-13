import "server-only";

import type { Role, StatusIzin, StatusKehadiran, StatusSekolah, StorageAdapter } from "@/types";

/**
 * Interface repository storage-agnostic.
 * Repository bergantung pada interface ini, bukan pada Sheets, supaya satu
 * sekolah bisa dimigrasikan ke Supabase/PostgreSQL hanya dengan mengganti adapter.
 */
export interface Repository<T extends Record<string, unknown>> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findWhere(predicate: (row: T) => boolean): Promise<T[]>;
  insert(row: T): Promise<T>;
  insertMany(rows: T[]): Promise<T[]>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  updateMany(ids: string[], patch: Partial<T>): Promise<number>;
  /** Soft delete: set kolom aktif=false. Tabel tanpa kolom aktif → baris dikosongkan. */
  softDelete(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Baris REGISTRY (milik platform, tab `schools`)
// ---------------------------------------------------------------------------

export interface SchoolRow extends Record<string, unknown> {
  school_id: string;
  slug: string;
  nama_sekolah: string;
  owner_email: string;
  sheet_id: string;
  refresh_token_enc: string;
  status: StatusSekolah;
  storage_adapter: StorageAdapter;
  dibuat_pada: string;
  terakhir_aktif: string;
}

// ---------------------------------------------------------------------------
// Baris DATA SEKOLAH (satu spreadsheet per sekolah)
// ---------------------------------------------------------------------------

export interface UserRow extends Record<string, unknown> {
  id: string;
  nama: string;
  username: string;
  password_hash: string;
  role: Role;
  aktif: boolean;
  wajib_ganti_password: boolean;
  dibuat_pada: string;
}

export interface GuruRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  nip: string;
  nama: string;
  is_wali_kelas: boolean;
  kelas_wali_id: string;
  aktif: boolean;
}

export interface SiswaRow extends Record<string, unknown> {
  id: string;
  user_id: string;
  nis: string;
  nama: string;
  kelas_id: string;
  jenis_kelamin: string;
  aktif: boolean;
}

export interface KelasRow extends Record<string, unknown> {
  id: string;
  nama: string;
  tingkat: string;
  tahun_ajaran_id: string;
}

export interface MapelRow extends Record<string, unknown> {
  id: string;
  nama: string;
  kode: string;
}

export interface PenugasanRow extends Record<string, unknown> {
  id: string;
  guru_id: string;
  kelas_id: string;
  mapel_id: string;
  tahun_ajaran_id: string;
}

export interface JadwalRow extends Record<string, unknown> {
  id: string;
  penugasan_id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
}

export interface AbsensiRow extends Record<string, unknown> {
  id: string;
  tanggal: string;
  jadwal_id: string;
  siswa_id: string;
  status: StatusKehadiran;
  catatan: string;
  diinput_oleh: string;
  diinput_pada: string;
  diubah_pada: string;
}

export interface PengajuanIzinRow extends Record<string, unknown> {
  id: string;
  siswa_id: string;
  tanggal: string;
  jenis: "izin" | "sakit";
  alasan: string;
  url_bukti: string;
  status: StatusIzin;
  diproses_oleh: string;
}

export interface LogPerubahanRow extends Record<string, unknown> {
  id: string;
  tabel: string;
  record_id: string;
  aksi: string;
  data_lama: string;
  data_baru: string;
  oleh: string;
  waktu: string;
}

export interface TahunAjaranRow extends Record<string, unknown> {
  id: string;
  nama: string;
  semester: string;
  aktif: boolean;
}

/** Tab pengaturan memakai `kunci` sebagai identitas (bukan `id`). */
export interface PengaturanRow extends Record<string, unknown> {
  kunci: string;
  nilai: string;
}
