"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { bool, str } from "@/lib/form";
import { countPemakaianTA } from "@/lib/services/akademik";
import { deleteTahunAjaran, saveTahunAjaran } from "@/lib/services/master";

const SEG = "tahun-ajaran";
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
    await saveTahunAjaran(ctx.sheets, ctx.context.spreadsheetId, {
      id: str(formData, "id") || undefined,
      nama: str(formData, "nama"),
      semester: str(formData, "semester"),
      aktif: bool(formData, "aktif"),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Tahun ajaran disimpan.");
}

export async function deleteAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  const sid = ctx.context.spreadsheetId;
  try {
    await deleteTahunAjaran(ctx.sheets, sid, str(formData, "id"), {
      usedCount: (taId) => countPemakaianTA(ctx.sheets, sid, taId),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Tahun ajaran dihapus.");
}
