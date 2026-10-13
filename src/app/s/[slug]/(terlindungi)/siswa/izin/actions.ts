"use server";

import { redirect } from "next/navigation";

import { requireSiswa } from "@/lib/admin-guard";
import { getCache } from "@/lib/redis";
import { createTenantDrive } from "@/lib/google/sheets-adapter";
import { ajukanIzin, batalkanIzin, uploadBuktiIzin } from "@/lib/services/siswa";
import { str } from "@/lib/form";

const base = (slug: string) => `/s/${slug}/siswa/izin`;

export async function ajukanAction(formData: FormData): Promise<never> {
  const s = await requireSiswa().catch(() => null);
  if (!s) redirect("/");
  const slug = s.ctx.context.slug;
  const sid = s.ctx.context.spreadsheetId;
  const tanggal = str(formData, "tanggal");
  try {
    let url = "";
    const file = formData.get("bukti");
    if (file instanceof File && file.size > 0) {
      const up = await uploadBuktiIzin(
        createTenantDrive(s.ctx.accessToken),
        getCache(),
        s.ctx.context.schoolId,
        {
          buffer: new Uint8Array(await file.arrayBuffer()),
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
        },
        `izin-${s.siswa.id}-${tanggal}`
      );
      url = up.url;
    }
    await ajukanIzin(
      s.ctx.sheets,
      sid,
      s.siswa.id,
      {
        tanggal,
        jenis: str(formData, "jenis"),
        alasan: str(formData, "alasan"),
      },
      url
    );
  } catch (err) {
    redirect(
      `${base(slug)}?error=${encodeURIComponent(err instanceof Error ? err.message : "Gagal mengajukan.")}`
    );
  }
  redirect(
    `${base(slug)}?ok=${encodeURIComponent("Pengajuan terkirim. Pantau statusnya di bawah.")}`
  );
}

export async function batalkanAction(formData: FormData): Promise<never> {
  const s = await requireSiswa().catch(() => null);
  if (!s) redirect("/");
  const slug = s.ctx.context.slug;
  try {
    await batalkanIzin(s.ctx.sheets, s.ctx.context.spreadsheetId, s.siswa.id, str(formData, "id"));
  } catch (err) {
    redirect(
      `${base(slug)}?error=${encodeURIComponent(err instanceof Error ? err.message : "Gagal membatalkan.")}`
    );
  }
  redirect(`${base(slug)}?ok=${encodeURIComponent("Pengajuan dibatalkan.")}`);
}
