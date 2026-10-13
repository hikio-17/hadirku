import "server-only";

import bcrypt from "bcryptjs";
import { z } from "zod";

import { getServerRegistry } from "@/lib/google/tenant-client";
import { getTenantContext } from "@/lib/google/tenant-client";
import { assertStorageSupported } from "@/lib/storage";
import { SheetsTable, booleanCodec } from "@/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import { USERS_COLUMNS } from "@/lib/storage/sheets/columns";
import type { SchoolRow, UserRow } from "@/lib/storage/types";
import type { RegistryRepo } from "@/lib/registry/RegistryRepo";
import type { Role } from "@/types";

/** Kredensial login: username unik PER SEKOLAH (bukan global). */
export const loginSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1, "Slug sekolah wajib diisi."),
  username: z.string().trim().min(1, "Username wajib diisi.").max(32),
  password: z.string().min(1, "Password wajib diisi.").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Data user yang aman dibawa ke session — TANPA password_hash. */
export interface SafeUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  schoolId: string;
  slug: string;
  mustChange: boolean;
}

export interface VerifyDeps {
  registry: RegistryRepo;
  sheetsForSchool: (school: SchoolRow) => Promise<SheetsValuesClient> | SheetsValuesClient;
  compare: (password: string, hash: string) => Promise<boolean>;
}

function usersTable(sheets: SheetsValuesClient, spreadsheetId: string): SheetsTable<UserRow> {
  return new SheetsTable<UserRow>(sheets, spreadsheetId, "users", {
    columns: [...USERS_COLUMNS],
    codecs: { aktif: booleanCodec, wajib_ganti_password: booleanCodec },
  });
}

/**
 * Verifikasi username+password. Mengembalikan null untuk SEMUA kegagalan
 * (sekolah tak dikenal, nonaktif, user tak dikenal/nonaktif, password salah,
 * koneksi Google putus) agar tidak bisa di-enumerasi.
 */
export async function verifyCredentials(raw: unknown, deps: VerifyDeps): Promise<SafeUser | null> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { slug, username, password } = parsed.data;

  const school = await deps.registry.findBySlug(slug);
  if (!school || school.status !== "aktif") return null;
  try {
    assertStorageSupported(school.storage_adapter);
  } catch {
    return null;
  }

  let sheets: SheetsValuesClient;
  try {
    sheets = await deps.sheetsForSchool(school);
  } catch {
    return null;
  }
  const match = (
    await usersTable(sheets, school.sheet_id).findWhere((u) => u.username === username && u.aktif)
  )[0];
  if (!match) return null;

  let ok = false;
  try {
    ok = await deps.compare(password, match.password_hash);
  } catch {
    return null;
  }
  if (!ok) return null;

  return {
    id: match.id,
    name: match.nama,
    username: match.username,
    role: match.role,
    schoolId: school.school_id,
    slug: school.slug,
    mustChange: match.wajib_ganti_password,
  };
}

/** Wiring produksi: registry SA + tenant context (sheets terautentikasi sekolah). */
export async function verifyCredentialsProduction(raw: unknown): Promise<SafeUser | null> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;
  return verifyCredentials(parsed.data, {
    registry: getServerRegistry(),
    sheetsForSchool: async (school) => (await getTenantContext(school.slug)).sheets,
    compare: (pw, hash) => bcrypt.compare(pw, hash),
  });
}

export const newPasswordSchema = z.string().min(8, "Password baru minimal 8 karakter.").max(128);

/** Hash bcrypt default (cost 12). Diekspor agar dipakai impor massal juga. */
export function hashPasswordDefault(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export interface ChangePasswordInput {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

/**
 * Ganti password (dipakai saat wajib_ganti_password). Memverifikasi password
 * lama, menyimpan hash bcrypt baru, dan menandai wajib=false.
 */
export async function changePassword(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  input: ChangePasswordInput,
  opts?: {
    compare?: (password: string, hash: string) => Promise<boolean>;
    hash?: (password: string) => Promise<string>;
  }
): Promise<void> {
  const compare = opts?.compare ?? ((pw, hash) => bcrypt.compare(pw, hash));
  const hash = opts?.hash ?? ((pw) => bcrypt.hash(pw, 12));
  const newPassword = newPasswordSchema.parse(input.newPassword);
  if (newPassword === input.oldPassword) {
    throw new Error("Password baru harus berbeda dari password lama.");
  }
  const table = usersTable(sheets, spreadsheetId);
  const row = await table.findById(input.userId);
  if (!row || !row.aktif) throw new Error("Akun tidak ditemukan.");
  if (!(await compare(input.oldPassword, row.password_hash))) {
    throw new Error("Password lama salah.");
  }
  await table.update(input.userId, {
    password_hash: await hash(newPassword),
    wajib_ganti_password: false,
  });
}

export interface ResetPasswordInput {
  targetUserId: string;
  tempPassword: string;
}

/**
 * Reset password oleh admin: set password sementara + wajib ganti saat
 * login berikutnya. Otorisasi "admin" dicek di route handler (Tahap 4).
 */
export async function resetPasswordByAdmin(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  input: ResetPasswordInput,
  opts?: { hash?: (password: string) => Promise<string> }
): Promise<void> {
  const hash = opts?.hash ?? ((pw) => bcrypt.hash(pw, 12));
  const temp = newPasswordSchema.parse(input.tempPassword);
  const table = usersTable(sheets, spreadsheetId);
  const row = await table.findById(input.targetUserId);
  if (!row || !row.aktif) throw new Error("Akun tidak ditemukan.");
  await table.update(input.targetUserId, {
    password_hash: await hash(temp),
    wajib_ganti_password: true,
  });
}
