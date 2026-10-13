"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { savePengaturan } from "@/lib/services/master";
import { PENGATURAN_KNOWN } from "@/lib/validations/admin";

const SEG = "pengaturan";
const base = (slug: string) => `/s/${slug}/admin/data/${SEG}`;

export async function saveAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  try {
    const values: Record<string, string> = {};
    for (const { kunci } of PENGATURAN_KNOWN) {
      const v = formData.get(kunci);
      values[kunci] = typeof v === "string" ? v : "";
    }
    await savePengaturan(ctx.sheets, ctx.context.spreadsheetId, values);
  } catch (err) {
    redirect(
      `${base(slug)}?error=${encodeURIComponent(err instanceof Error ? err.message : "Gagal menyimpan.")}`
    );
  }
  redirect(`${base(slug)}?ok=${encodeURIComponent("Pengaturan disimpan.")}`);
}
