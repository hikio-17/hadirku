import { z } from "zod";

const tanggalSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD.");

export const statusKehadiranSchema = z.enum(["H", "I", "S", "A"]);

export const absensiEntrySchema = z.object({
  siswaId: z.string().min(1),
  status: statusKehadiranSchema,
  catatan: z.string().max(280, "Catatan maksimal 280 karakter.").default(""),
});

export const saveAbsensiSchema = z.object({
  jadwalId: z.string().min(1),
  tanggal: tanggalSchema,
  entries: z.array(absensiEntrySchema).min(1, "Minimal satu siswa.").max(200),
});

export const editAbsensiSchema = z.object({
  id: z.string().min(1),
  status: statusKehadiranSchema,
  catatan: z.string().max(280).default(""),
});

export const approveIzinSchema = z.object({
  id: z.string().min(1),
  setuju: z.boolean(),
});

export const rekapFilterSchema = z.object({
  kelasId: z.string().optional().default(""),
  mapelId: z.string().optional().default(""),
  dari: tanggalSchema,
  sampai: tanggalSchema,
  status: z.enum(["", "H", "I", "S", "A"]).optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
});
