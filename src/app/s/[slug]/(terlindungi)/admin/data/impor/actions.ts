"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { getCache } from "@/lib/redis";
import {
  MAX_IMPORT_BYTES,
  confirmImport,
  parseImportBuffer,
  stashImportBatch,
  takeImportBatch,
  type ImportJenis,
} from "@/lib/services/impor";

const SEG = "impor";
const base = (slug: string) => `/s/${slug}/admin/data/${SEG}`;

function fail(slug: string, message: unknown): never {
  redirect(
    `${base(slug)}?error=${encodeURIComponent(message instanceof Error ? message.message : "Operasi gagal.")}`
  );
}

/** Langkah 1: unggah → parse → pratinjau (atau error per baris). */
export async function uploadAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  const jenis = (String(formData.get("jenis") ?? "") === "siswa" ? "siswa" : "guru") as ImportJenis;
  const file = formData.get("file");
  let batchId = "";
  let info: { parsed: number; perhatian?: string } | null = null;
  try {
    if (!(file instanceof File) || file.size === 0) throw new Error("Pilih file Excel dulu.");
    if (file.size > MAX_IMPORT_BYTES) throw new Error("File maksimal 5 MB.");
    if (!/\.xlsx$/i.test(file.name)) throw new Error("File harus berekstensi .xlsx.");
    const { rows, errors } = await parseImportBuffer(jenis, Buffer.from(await file.arrayBuffer()));
    if (rows.length === 0 && errors.length > 0) {
      throw new Error(
        `Semua baris bermasalah. Contoh: baris ${errors[0].baris} — ${errors[0].pesan}`
      );
    }
    batchId = await stashImportBatch(getCache(), { jenis, rows });
    info = { parsed: rows.length };
    if (errors.length > 0) {
      info.perhatian = `${errors.length} baris dilewati (${errors
        .slice(0, 3)
        .map((e) => `baris ${e.baris}: ${e.pesan}`)
        .join("; ")}${errors.length > 3 ? "; …" : ""})`;
    }
  } catch (err) {
    fail(slug, err);
  }
  const params = new URLSearchParams({ batch: batchId, parsed: String(info?.parsed ?? 0) });
  if (info?.perhatian) params.set("perhatian", info.perhatian);
  redirect(`${base(slug)}?${params.toString()}`);
}

/** Langkah 2: konfirmasi pratinjau → tulis ke Sheets (sekali pakai). */
export async function confirmAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  try {
    const batch = await takeImportBatch(getCache(), String(formData.get("batch") ?? ""));
    if (!batch) throw new Error("Sesi impor kedaluwarsa. Unggah ulang file-nya.");
    const out = await confirmImport(ctx.sheets, ctx.context.spreadsheetId, batch.jenis, batch.rows);
    redirect(
      `${base(slug)}?ok=${encodeURIComponent(`Impor selesai: ${out.akun} akun + ${out.profil} profil ${batch.jenis}.`)}`
    );
  } catch (err) {
    fail(slug, err);
  }
}
