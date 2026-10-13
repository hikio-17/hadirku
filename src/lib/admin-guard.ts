import "server-only";

import { auth } from "@/auth";
import { getTenantContext, type TenantClient } from "@/lib/google/tenant-client";
import { getGuruProfil } from "@/lib/services/guru";
import type { GuruRow } from "@/lib/storage/types";

/**
 * Penjaga server-side untuk SEMUA action admin: sesi ada + role admin +
 * konteks tenant milik sekolah sesi (anti lintas sekolah).
 * Dipakai di setiap server action modul admin (pertahanan berlapis
 * setelah middleware).
 */
export async function requireAdmin(): Promise<{ ctx: TenantClient; userId: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Belum login. Silakan masuk dulu.");
  if (session.user.role !== "admin") throw new Error("Halaman ini khusus admin sekolah.");
  const ctx = await getTenantContext(session.user.slug);
  if (ctx.school.school_id !== session.user.schoolId) {
    throw new Error("Sesi tidak cocok dengan sekolah ini.");
  }
  return { ctx, userId: session.user.id };
}

/**
 * Penjaga server-side untuk SEMUA action guru: sesi role guru + profil guru
 * + konteks tenant milik sekolah sesi.
 */
export async function requireGuru(): Promise<{ ctx: TenantClient; guru: GuruRow; userId: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Belum login. Silakan masuk dulu.");
  if (session.user.role !== "guru") throw new Error("Halaman ini khusus guru.");
  const ctx = await getTenantContext(session.user.slug);
  if (ctx.school.school_id !== session.user.schoolId) {
    throw new Error("Sesi tidak cocok dengan sekolah ini.");
  }
  const guru = await getGuruProfil(ctx.sheets, ctx.context.spreadsheetId, session.user.id);
  if (!guru) throw new Error("Akun belum punya profil guru. Hubungi admin sekolah.");
  return { ctx, guru, userId: session.user.id };
}
