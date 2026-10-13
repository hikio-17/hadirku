"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { bool, str } from "@/lib/form";
import { deleteGuru, saveGuru } from "@/lib/services/akademik";

const SEG = "guru";
const base = (slug: string) => `/s/${slug}/admin/data/${SEG}`;

function fail(slug: string, message: unknown): never {
  redirect(
    `${base(slug)}?error=${encodeURIComponent(message instanceof Error ? message.message : "Operasi gagal.")}`
  );
}

function done(slug: string, msg: string): never {
  redirect(`${base(slug)}?ok=${encodeURIComponent(msg)}`);
}

export async function saveAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  try {
    await saveGuru(ctx.sheets, ctx.context.spreadsheetId, {
      id: str(formData, "id") || undefined,
      user_id: str(formData, "user_id"),
      nip: str(formData, "nip"),
      nama: str(formData, "nama"),
      is_wali_kelas: bool(formData, "is_wali_kelas"),
      kelas_wali_id: str(formData, "kelas_wali_id"),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Data guru disimpan.");
}

export async function deleteAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  try {
    await deleteGuru(ctx.sheets, ctx.context.spreadsheetId, str(formData, "id"));
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Data guru dihapus.");
}
