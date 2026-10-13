"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { decryptToken, redactForLog } from "@/lib/crypto/token";
import { env } from "@/lib/env";
import { revokeGoogleToken } from "@/lib/google/oauth";
import { getServerRegistry } from "@/lib/google/tenant-client";
import { requireAdmin } from "@/lib/admin-guard";

const base = (slug: string) => `/s/${slug}/admin/koneksi`;

/**
 * Putuskan koneksi & hapus token: revoke ke Google (best-effort) +
 * hapus dari registry + keluar. Kegagalan revoke TETAP memutus sisi kami;
 * pencabutan manual dijelaskan di Kebijakan Privasi.
 */
export async function putuskanAction(): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  const school = ctx.school;
  try {
    if (school.refresh_token_enc && env.TOKEN_ENCRYPTION_KEY) {
      try {
        const plain = decryptToken(school.refresh_token_enc, env.TOKEN_ENCRYPTION_KEY);
        await revokeGoogleToken(plain);
      } catch (err) {
        console.error(redactForLog({ scope: "putuskan-koneksi", error: String(err) }));
      }
    }
    const registry = getServerRegistry();
    await registry.clearToken(school.school_id);
  } catch (err) {
    redirect(
      `${base(slug)}?error=${encodeURIComponent(err instanceof Error ? err.message : "Gagal memutuskan.")}`
    );
  }
  await signOut({ redirectTo: "/daftar?putus=1" });
  redirect("/daftar?putus=1");
}
