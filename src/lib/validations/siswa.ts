import { z } from "zod";

export const ajukanIzinSchema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD."),
  jenis: z.enum(["izin", "sakit"]),
  alasan: z
    .string()
    .trim()
    .min(10, "Alasan minimal 10 karakter.")
    .max(500, "Alasan maksimal 500 karakter."),
});

export type AjukanIzinInput = z.infer<typeof ajukanIzinSchema>;

export const bulanSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Bulan harus format YYYY-MM.")
  .refine(
    (v) => {
      const m = Number(v.slice(5));
      return m >= 1 && m <= 12;
    },
    { message: "Bulan tidak valid." }
  );

/** Bukti: jpg/png/pdf, maks 2 MB. */
export const BUKTI_MAX_BYTES = 2 * 1024 * 1024;
export const BUKTI_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
export const BUKTI_EXT = ["jpg", "jpeg", "png", "pdf"] as const;
