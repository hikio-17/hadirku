"use server";

import { redirect } from "next/navigation";

import { requireGuru } from "@/lib/admin-guard";
import { bool, str } from "@/lib/form";
import { approveIzin } from "@/lib/services/guru";

const base = (slug: string) => `/s/${slug}/guru`;

export async function approveAction(formData: FormData): Promise<never> {
  const g = await requireGuru().catch(() => null);
  if (!g) redirect("/");
  const slug = g.ctx.context.slug;
  try {
    await approveIzin(
      g.ctx.sheets,
      g.ctx.context.spreadsheetId,
      {
        id: str(formData, "id"),
        setuju: bool(formData, "setuju"),
      },
      { guru: g.guru, olehUserId: g.userId }
    );
  } catch (err) {
    redirect(
      `${base(slug)}?error=${encodeURIComponent(err instanceof Error ? err.message : "Gagal memproses.")}`
    );
  }
  const setuju = bool(formData, "setuju");
  redirect(
    `${base(slug)}?ok=${encodeURIComponent(setuju ? "Pengajuan disetujui." : "Pengajuan ditolak.")}`
  );
}
