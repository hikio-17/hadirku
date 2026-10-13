"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { str } from "@/lib/form";
import { countPenugasan } from "@/lib/services/akademik";
import { deleteMapel, saveMapel } from "@/lib/services/master";

const SEG = "mapel";
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
    await saveMapel(ctx.sheets, ctx.context.spreadsheetId, {
      id: str(formData, "id") || undefined,
      nama: str(formData, "nama"),
      kode: str(formData, "kode"),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Mapel disimpan.");
}

export async function deleteAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  const sid = ctx.context.spreadsheetId;
  try {
    await deleteMapel(ctx.sheets, sid, str(formData, "id"), {
      penugasanCount: (mapelId) => countPenugasan(ctx.sheets, sid, "mapel_id", mapelId),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Mapel dihapus.");
}
