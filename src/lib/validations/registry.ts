import { z } from "zod";

/** Slug sekolah: huruf kecil, angka, strip. Dipakai di URL /s/[slug]. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug minimal 3 karakter.")
  .max(48, "Slug maksimal 48 karakter.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh huruf kecil, angka, dan strip.");

export const schoolStatusSchema = z.enum(["aktif", "perlu_hubungkan_ulang", "nonaktif"]);

export const storageAdapterSchema = z.enum(["sheets", "postgres"]);

export const schoolRowSchema = z.object({
  school_id: z.string().min(1),
  slug: slugSchema,
  nama_sekolah: z.string().min(1, "Nama sekolah wajib diisi.").max(120),
  owner_email: z.string().email("Email admin tidak valid."),
  sheet_id: z.string().min(1),
  refresh_token_enc: z.string(),
  status: schoolStatusSchema,
  storage_adapter: storageAdapterSchema,
  dibuat_pada: z.string(),
  terakhir_aktif: z.string(),
});

export const registerSchoolSchema = z.object({
  slug: slugSchema,
  nama_sekolah: z.string().min(1, "Nama sekolah wajib diisi.").max(120),
  owner_email: z.string().email("Email admin tidak valid."),
  sheet_id: z.string().min(1),
  refresh_token_enc: z.string().min(1),
});
