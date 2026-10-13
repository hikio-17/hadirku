"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { str } from "@/lib/form";
import { deletePenugasan, savePenugasan } from "@/lib/services/akademik";

const SEG = "penugasan";
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
    await savePenugasan(ctx.sheets, ctx.context.spreadsheetId, {
      guru_id: str(formData, "guru_id"),
      kelas_id: str(formData, "kelas_id"),
      mapel_id: str(formData, "mapel_id"),
      tahun_ajaran_id: str(formData, "tahun_ajaran_id"),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Penugasan disimpan.");
}

export async function deleteAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  try {
    await deletePenugasan(ctx.sheets, ctx.context.spreadsheetId, str(formData, "id"));
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Penugasan dihapus.");
}
