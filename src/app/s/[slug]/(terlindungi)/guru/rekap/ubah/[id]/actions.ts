"use server";

import { redirect } from "next/navigation";

import { requireGuru } from "@/lib/admin-guard";
import { str } from "@/lib/form";
import { editAbsensi } from "@/lib/services/guru";

const base = (slug: string) => `/s/${slug}/guru/rekap`;

export async function editAction(formData: FormData): Promise<never> {
  const g = await requireGuru().catch(() => null);
  if (!g) redirect("/");
  const slug = g.ctx.context.slug;
  try {
    await editAbsensi(
      g.ctx.sheets,
      g.ctx.context.spreadsheetId,
      {
        id: str(formData, "id"),
        status: str(formData, "status"),
        catatan: str(formData, "catatan"),
      },
      { guruId: g.guru.id, olehUserId: g.userId }
    );
  } catch (err) {
    redirect(
      `${base(slug)}?error=${encodeURIComponent(err instanceof Error ? err.message : "Gagal menyimpan.")}`
    );
  }
  redirect(`${base(slug)}?ok=${encodeURIComponent("Perubahan disimpan dan tercatat di log.")}`);
}
