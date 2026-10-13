"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { str } from "@/lib/form";
import { countPenugasan, countSiswaDiKelas } from "@/lib/services/akademik";
import { deleteKelas, saveKelas } from "@/lib/services/master";

const SEG = "kelas";
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
    await saveKelas(ctx.sheets, ctx.context.spreadsheetId, {
      id: str(formData, "id") || undefined,
      nama: str(formData, "nama"),
      tingkat: str(formData, "tingkat"),
      tahun_ajaran_id: str(formData, "tahun_ajaran_id"),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Kelas disimpan.");
}

export async function deleteAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  const sid = ctx.context.spreadsheetId;
  try {
    await deleteKelas(ctx.sheets, sid, str(formData, "id"), {
      siswaCount: (kelasId) => countSiswaDiKelas(ctx.sheets, sid, kelasId),
      penugasanCount: (kelasId) => countPenugasan(ctx.sheets, sid, "kelas_id", kelasId),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Kelas dihapus.");
}
