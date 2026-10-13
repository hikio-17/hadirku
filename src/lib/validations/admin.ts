import { z } from "zod";

const namaSchema = z.string().trim().min(1, "Nama wajib diisi.").max(120);
const idSchema = z.string().min(1);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username minimal 3 karakter.")
  .max(32)
  .regex(/^[a-z0-9_.]+$/, "Username hanya boleh huruf kecil, angka, titik, garis bawah.");

export const passwordSchema = z.string().min(8, "Password minimal 8 karakter.").max(128);

// --- Pengguna (tab users) ---
export const createUserSchema = z.object({
  nama: namaSchema,
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(["admin", "guru", "siswa"]),
});

export const updateUserSchema = z.object({
  id: idSchema,
  nama: namaSchema,
  role: z.enum(["admin", "guru", "siswa"]),
  aktif: z.boolean(),
});

export const resetPasswordSchema = z.object({
  id: idSchema,
  tempPassword: passwordSchema,
});

// --- Guru ---
export const upsertGuruSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().min(1, "Akun login wajib dipilih."),
  nip: z.string().trim().max(32).default(""),
  nama: namaSchema,
  is_wali_kelas: z.boolean().default(false),
  kelas_wali_id: z.string().trim().default(""),
});

// --- Siswa ---
export const upsertSiswaSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().min(1, "Akun login wajib dipilih."),
  nis: z.string().trim().max(32).default(""),
  nama: namaSchema,
  kelas_id: z.string().min(1, "Kelas wajib dipilih."),
  jenis_kelamin: z.enum(["L", "P"]),
});

// --- Kelas / Mapel / Tahun ajaran ---
export const upsertKelasSchema = z.object({
  id: z.string().optional(),
  nama: z.string().trim().min(1, "Nama kelas wajib diisi.").max(64),
  tingkat: z.string().trim().max(32).default(""),
  tahun_ajaran_id: z.string().min(1, "Tahun ajaran wajib dipilih."),
});

export const upsertMapelSchema = z.object({
  id: z.string().optional(),
  nama: namaSchema,
  kode: z.string().trim().max(16).default(""),
});

export const upsertTahunAjaranSchema = z.object({
  id: z.string().optional(),
  nama: z.string().trim().min(1, "Nama tahun ajaran wajib diisi.").max(32),
  semester: z.enum(["Ganjil", "Genap"]),
  aktif: z.boolean().default(false),
});

// --- Penugasan & jadwal ---
export const upsertPenugasanSchema = z.object({
  id: z.string().optional(),
  guru_id: z.string().min(1, "Guru wajib dipilih."),
  kelas_id: z.string().min(1, "Kelas wajib dipilih."),
  mapel_id: z.string().min(1, "Mapel wajib dipilih."),
  tahun_ajaran_id: z.string().min(1, "Tahun ajaran wajib dipilih."),
});

export const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

const jamSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Jam harus format JJ:MM.");

export const upsertJadwalSchema = z
  .object({
    id: z.string().optional(),
    penugasan_id: z.string().min(1, "Penugasan wajib dipilih."),
    hari: z.enum(HARI),
    jam_mulai: jamSchema,
    jam_selesai: jamSchema,
  })
  .refine((v) => v.jam_mulai < v.jam_selesai, {
    message: "Jam selesai harus setelah jam mulai.",
    path: ["jam_selesai"],
  });

// --- Pengaturan ---
export const PENGATURAN_KNOWN = [
  { kunci: "nama_sekolah", label: "Nama sekolah", type: "text" },
  { kunci: "logo_url", label: "URL logo", type: "url" },
  { kunci: "alamat", label: "Alamat", type: "text" },
  { kunci: "kop_surat", label: "Teks kop surat", type: "text" },
  { kunci: "ambang_kehadiran_rendah", label: "Ambang kehadiran rendah (%)", type: "number" },
  { kunci: "jam_pelajaran", label: "Jam pelajaran", type: "text" },
] as const;

export const pengaturanSchema = z.record(z.string(), z.string().max(500));
