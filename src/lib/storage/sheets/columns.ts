/**
 * Urutan kolom tiap tab spreadsheet sekolah — SATU-SATUNYA sumber kebenaran.
 * Dipakai provisioning (header baris 1) dan semua repository/service.
 * Harus sama persis dengan skema §4.
 */
export const USERS_COLUMNS = [
  "id",
  "nama",
  "username",
  "password_hash",
  "role",
  "aktif",
  "wajib_ganti_password",
  "dibuat_pada",
] as const;

export const GURU_COLUMNS = [
  "id",
  "user_id",
  "nip",
  "nama",
  "is_wali_kelas",
  "kelas_wali_id",
  "aktif",
] as const;

export const SISWA_COLUMNS = [
  "id",
  "user_id",
  "nis",
  "nama",
  "kelas_id",
  "jenis_kelamin",
  "aktif",
] as const;

export const KELAS_COLUMNS = ["id", "nama", "tingkat", "tahun_ajaran_id"] as const;

export const MAPEL_COLUMNS = ["id", "nama", "kode"] as const;

export const PENUGASAN_COLUMNS = [
  "id",
  "guru_id",
  "kelas_id",
  "mapel_id",
  "tahun_ajaran_id",
] as const;

export const JADWAL_COLUMNS = ["id", "penugasan_id", "hari", "jam_mulai", "jam_selesai"] as const;

export const ABSENSI_COLUMNS = [
  "id",
  "tanggal",
  "jadwal_id",
  "siswa_id",
  "status",
  "catatan",
  "diinput_oleh",
  "diinput_pada",
  "diubah_pada",
] as const;

export const PENGAJUAN_IZIN_COLUMNS = [
  "id",
  "siswa_id",
  "tanggal",
  "jenis",
  "alasan",
  "url_bukti",
  "status",
  "diproses_oleh",
] as const;

export const LOG_PERUBAHAN_COLUMNS = [
  "id",
  "tabel",
  "record_id",
  "aksi",
  "data_lama",
  "data_baru",
  "oleh",
  "waktu",
] as const;

export const TAHUN_AJARAN_COLUMNS = ["id", "nama", "semester", "aktif"] as const;

export const PENGATURAN_COLUMNS = ["kunci", "nilai"] as const;
