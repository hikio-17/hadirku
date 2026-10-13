import { z } from "zod";

import { slugSchema } from "@/lib/validations/registry";

/** Skema wizard setup satu-klik (dipakai server action + bisa dipakai ulang di client). */
export const wizardSchema = z.object({
  nama_sekolah: z.string().trim().min(3, "Nama sekolah minimal 3 karakter.").max(120),
  slug: slugSchema,
  nama_admin: z.string().trim().min(3, "Nama admin minimal 3 karakter.").max(120),
  username_admin: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username minimal 3 karakter.")
    .max(32)
    .regex(/^[a-z0-9_.]+$/, "Username hanya boleh huruf kecil, angka, titik, dan garis bawah."),
  password_admin: z.string().min(8, "Password admin minimal 8 karakter.").max(128),
  logo_url: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^https?:\/\/.+/.test(v), "Logo harus berupa URL http(s)."),
  tahun_ajaran_nama: z.string().trim().min(1, "Nama tahun ajaran wajib diisi.").max(32),
  semester: z.enum(["Ganjil", "Genap"]),
  jam_pelajaran: z.string().trim().min(1, "Jam pelajaran wajib diisi.").max(120),
});

export type WizardInput = z.infer<typeof wizardSchema>;
