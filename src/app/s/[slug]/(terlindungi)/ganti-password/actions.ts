"use server";

import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { getTenantContext } from "@/lib/google/tenant-client";
import { changePassword } from "@/lib/services/auth";

export interface ChangeState {
  error?: string;
}

/** Ganti password sendiri (wajib saat login pertama / setelah reset admin). */
export async function changePasswordAction(
  _prev: ChangeState | null,
  formData: FormData
): Promise<ChangeState> {
  const session = await auth();
  if (!session?.user) redirect("/");
  const oldPassword = String(formData.get("oldPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!oldPassword || !newPassword) return { error: "Semua kolom wajib diisi." };
  try {
    const ctx = await getTenantContext(session.user.slug);
    await changePassword(ctx.sheets, ctx.context.spreadsheetId, {
      userId: session.user.id,
      oldPassword,
      newPassword,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengganti password." };
  }
  // Sesi JWT masih bertanda mustChange — keluar agar klaim sesi segar,
  // lalu minta login ulang dengan password baru.
  await signOut({ redirectTo: `/s/${session.user.slug}/login?baru=1` });
  // Tidak terjangkau (signOut selalu redirect); hanya untuk type-checker.
  return { error: "Password tersimpan. Silakan login ulang." };
}
