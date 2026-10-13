import "server-only";

import bcrypt from "bcryptjs";

import { SheetsTable, booleanCodec } from "@/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import { GURU_COLUMNS, SISWA_COLUMNS, USERS_COLUMNS } from "@/lib/storage/sheets/columns";
import type { UserRow } from "@/lib/storage/types";
import { resetPasswordByAdmin } from "@/lib/services/auth";
import { createUserSchema, resetPasswordSchema, updateUserSchema } from "@/lib/validations/admin";

function usersTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<UserRow>(sheets, spreadsheetId, "users", {
    columns: [...USERS_COLUMNS],
    codecs: { aktif: booleanCodec, wajib_ganti_password: booleanCodec },
  });
}

export async function listUsers(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<UserRow[]> {
  return usersTable(sheets, spreadsheetId).findAll();
}

/** Username unik per sekolah (case-insensitive, sudah lowercase oleh skema). */
async function assertUsernameFree(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  username: string,
  exceptId?: string
): Promise<void> {
  const taken = await usersTable(sheets, spreadsheetId).findWhere(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.id !== exceptId
  );
  if (taken.length > 0) throw new Error(`Username "${username}" sudah dipakai.`);
}

export async function createUser(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown,
  opts?: { hash?: (password: string) => Promise<string> }
): Promise<UserRow> {
  const input = createUserSchema.parse(raw);
  await assertUsernameFree(sheets, spreadsheetId, input.username);
  const hash = opts?.hash ?? ((pw: string) => bcrypt.hash(pw, 12));
  const [row] = await usersTable(sheets, spreadsheetId).insertMany([
    {
      id: "",
      nama: input.nama,
      username: input.username,
      password_hash: await hash(input.password),
      role: input.role,
      aktif: true,
      wajib_ganti_password: true,
      dibuat_pada: new Date().toISOString(),
    },
  ]);
  return row;
}

export async function updateUser(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown,
  opts?: { currentUserId?: string; hasProfile?: (userId: string) => Promise<boolean> }
): Promise<void> {
  const input = updateUserSchema.parse(raw);
  if (opts?.currentUserId && input.id === opts.currentUserId && !input.aktif) {
    throw new Error("Tidak bisa menonaktifkan akun sendiri.");
  }
  const table = usersTable(sheets, spreadsheetId);
  const current = await table.findById(input.id);
  if (!current) throw new Error("Akun tidak ditemukan.");
  if (current.role !== input.role && opts?.hasProfile && (await opts.hasProfile(input.id))) {
    throw new Error("Akun terhubung profil guru/siswa. Hapus profilnya dulu sebelum ganti role.");
  }
  await table.update(input.id, { nama: input.nama, role: input.role, aktif: input.aktif });
}

export async function setUserActive(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  id: string,
  aktif: boolean,
  currentUserId?: string
): Promise<void> {
  if (!aktif && currentUserId && id === currentUserId) {
    throw new Error("Tidak bisa menonaktifkan akun sendiri.");
  }
  const updated = await usersTable(sheets, spreadsheetId).update(id, { aktif });
  if (!updated) throw new Error("Akun tidak ditemukan.");
}

export async function resetUserPassword(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown,
  opts?: { hash?: (password: string) => Promise<string> }
): Promise<void> {
  const input = resetPasswordSchema.parse(raw);
  const hash = opts?.hash ?? ((pw: string) => bcrypt.hash(pw, 12));
  await resetPasswordByAdmin(
    sheets,
    spreadsheetId,
    { targetUserId: input.id, tempPassword: input.tempPassword },
    { hash }
  );
}

/** Cek profil guru/siswa untuk user (dipakai menjaga ganti role). */
export async function userHasProfile(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  userId: string
): Promise<boolean> {
  const guru = new SheetsTable(sheets, spreadsheetId, "guru", { columns: [...GURU_COLUMNS] });
  if ((await guru.findWhere((g) => String(g["user_id"]) === userId)).length > 0) return true;
  const siswa = new SheetsTable(sheets, spreadsheetId, "siswa", { columns: [...SISWA_COLUMNS] });
  return (await siswa.findWhere((s) => String(s["user_id"]) === userId)).length > 0;
}
