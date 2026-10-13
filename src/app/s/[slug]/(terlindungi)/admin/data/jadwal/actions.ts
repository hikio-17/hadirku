"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { str } from "@/lib/form";
import { deleteJadwal, saveJadwal } from "@/lib/services/akademik";

const SEG = "jadwal";
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
    await saveJadwal(ctx.sheets, ctx.context.spreadsheetId, {
      penugasan_id: str(formData, "penugasan_id"),
      hari: str(formData, "hari"),
      jam_mulai: str(formData, "jam_mulai"),
      jam_selesai: str(formData, "jam_selesai"),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Jadwal disimpan.");
}

export async function deleteAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  try {
    await deleteJadwal(ctx.sheets, ctx.context.spreadsheetId, str(formData, "id"));
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Jadwal dihapus.");
}
