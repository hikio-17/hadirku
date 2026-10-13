"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { str } from "@/lib/form";
import { deleteSiswa, saveSiswa } from "@/lib/services/akademik";

const SEG = "siswa";
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
    await saveSiswa(ctx.sheets, ctx.context.spreadsheetId, {
      id: str(formData, "id") || undefined,
      user_id: str(formData, "user_id"),
      nis: str(formData, "nis"),
      nama: str(formData, "nama"),
      kelas_id: str(formData, "kelas_id"),
      jenis_kelamin: str(formData, "jenis_kelamin"),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Data siswa disimpan.");
}

export async function deleteAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  try {
    await deleteSiswa(ctx.sheets, ctx.context.spreadsheetId, str(formData, "id"));
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Data siswa dihapus.");
}
