"use server";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-guard";
import { bool, str } from "@/lib/form";
import {
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
  userHasProfile,
} from "@/lib/services/pengguna";

const SEG = "pengguna";
const base = (slug: string) => `/s/${slug}/admin/data/${SEG}`;

function fail(slug: string, message: unknown): never {
  redirect(
    `${base(slug)}?error=${encodeURIComponent(message instanceof Error ? message.message : "Operasi gagal.")}`
  );
}

function done(slug: string, msg: string): never {
  redirect(`${base(slug)}?ok=${encodeURIComponent(msg)}`);
}

export async function createAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  try {
    await createUser(ctx.sheets, ctx.context.spreadsheetId, {
      nama: str(formData, "nama"),
      username: str(formData, "username"),
      password: str(formData, "password"),
      role: str(formData, "role"),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Akun dibuat. Ingatkan user ganti password saat login pertama.");
}

export async function updateAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx, userId } = admin;
  const slug = ctx.context.slug;
  const sid = ctx.context.spreadsheetId;
  try {
    await updateUser(
      ctx.sheets,
      sid,
      {
        id: str(formData, "id"),
        nama: str(formData, "nama"),
        role: str(formData, "role"),
        aktif: bool(formData, "aktif"),
      },
      {
        currentUserId: userId,
        hasProfile: (uid) => userHasProfile(ctx.sheets, sid, uid),
      }
    );
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Akun diperbarui.");
}

export async function toggleAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx, userId } = admin;
  const slug = ctx.context.slug;
  try {
    await setUserActive(
      ctx.sheets,
      ctx.context.spreadsheetId,
      str(formData, "id"),
      str(formData, "aktif") === "true",
      userId
    );
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Status akun diperbarui.");
}

export async function resetAction(formData: FormData): Promise<never> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/");
  const { ctx } = admin;
  const slug = ctx.context.slug;
  try {
    await resetUserPassword(ctx.sheets, ctx.context.spreadsheetId, {
      id: str(formData, "id"),
      tempPassword: str(formData, "tempPassword"),
    });
  } catch (err) {
    fail(slug, err);
  }
  done(slug, "Password direset. User wajib ganti saat login berikutnya.");
}
