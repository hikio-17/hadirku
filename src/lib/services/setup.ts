import "server-only";

import bcrypt from "bcryptjs";

import { decryptToken } from "@/lib/crypto/token";
import { env } from "@/lib/env";
import { refreshAccessToken } from "@/lib/google/oauth";
import { createGoogleProvisioner, provisionSchoolSpreadsheet } from "@/lib/google/provision";
import { createGoogleSheetsValuesClient, createTenantSheets } from "@/lib/google/sheets-adapter";
import { RegistryRepo } from "@/lib/registry/RegistryRepo";
import type { SetupSession } from "@/lib/setup-session";
import { SheetsTable, booleanCodec, generateId } from "@/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import type { PengaturanRow, TahunAjaranRow, UserRow } from "@/lib/storage/types";
import { wizardSchema, type WizardInput } from "@/lib/validations/setup";

/** Operasi Google yang dibutuhkan setup (di-inject agar bisa di-test tanpa Google). */
export interface SetupGoogle {
  refresh(refreshToken: string): Promise<{ accessToken: string; expiresInSeconds: number }>;
  provision(accessToken: string, title: string): Promise<string>;
  schoolSheets(accessToken: string): SheetsValuesClient;
}

function defaultSetupGoogle(): SetupGoogle {
  return {
    refresh: (rt) => refreshAccessToken(rt),
    provision: (at, title) =>
      provisionSchoolSpreadsheet(createGoogleProvisioner(createTenantSheets(at)), title),
    schoolSheets: (at) => createGoogleSheetsValuesClient(createTenantSheets(at)),
  };
}

export interface SetupDeps {
  registry: RegistryRepo;
  google?: SetupGoogle;
  hashPassword?: (password: string) => Promise<string>;
  appUrl?: string;
  /** Kunci base64 TOKEN_ENCRYPTION_KEY (di-inject agar bisa di-test). */
  tokenKey?: string;
}

export interface SetupResult {
  schoolId: string;
  slug: string;
  loginUrl: string;
}

/**
 * Selesaikan setup satu-klik: validasi → refresh token → buat spreadsheet →
 * seed tahun ajaran + pengaturan + admin pertama → catat di registry.
 *
 * Catatan: slug dicek dulu sebelum provisioning agar tidak yatim bila bentrok,
 * dan registerSchool tetap menjadi penjaga akhir (append atomic per baris).
 * Bila gagal setelah spreadsheet dibuat, spreadsheet yatim tetap ada di Drive
 * operator (bisa dihapus manual) — kegagalan dilaporkan apa adanya.
 */
export async function completeSetup(
  rawInput: unknown,
  session: SetupSession,
  deps: SetupDeps
): Promise<SetupResult> {
  const input: WizardInput = wizardSchema.parse(rawInput);
  const tokenKey = deps.tokenKey ?? env.TOKEN_ENCRYPTION_KEY;
  if (!tokenKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY belum dikonfigurasi.");
  }
  const google = deps.google ?? defaultSetupGoogle();
  const hashPassword = deps.hashPassword ?? ((pw) => bcrypt.hash(pw, 12));

  const slugTaken = await deps.registry.findBySlug(input.slug);
  if (slugTaken) throw new Error(`Slug "${input.slug}" sudah dipakai sekolah lain.`);

  let refreshToken: string;
  try {
    refreshToken = decryptToken(session.refreshTokenEnc, tokenKey);
  } catch {
    throw new Error("Sesi setup rusak atau kedaluwarsa. Ulangi dari halaman /daftar.");
  }

  const { accessToken } = await google.refresh(refreshToken);
  const spreadsheetId = await google.provision(accessToken, `Hadirku - ${input.nama_sekolah}`);
  const sheets = google.schoolSheets(accessToken);

  const now = new Date().toISOString();
  const tahunAjaranId = generateId();

  const tahunAjaran = new SheetsTable<TahunAjaranRow>(sheets, spreadsheetId, "tahun_ajaran", {
    columns: ["id", "nama", "semester", "aktif"],
    codecs: { aktif: booleanCodec },
  });
  await tahunAjaran.insertMany([
    { id: tahunAjaranId, nama: input.tahun_ajaran_nama, semester: input.semester, aktif: true },
  ]);

  const pengaturan = new SheetsTable<PengaturanRow>(sheets, spreadsheetId, "pengaturan", {
    columns: ["kunci", "nilai"],
    idColumn: "kunci",
  });
  await pengaturan.insertMany([
    { kunci: "nama_sekolah", nilai: input.nama_sekolah },
    { kunci: "logo_url", nilai: input.logo_url ?? "" },
    { kunci: "tahun_ajaran_aktif", nilai: tahunAjaranId },
    { kunci: "jam_pelajaran", nilai: input.jam_pelajaran },
  ]);

  const users = new SheetsTable<UserRow>(sheets, spreadsheetId, "users", {
    columns: [
      "id",
      "nama",
      "username",
      "password_hash",
      "role",
      "aktif",
      "wajib_ganti_password",
      "dibuat_pada",
    ],
    codecs: { aktif: booleanCodec, wajib_ganti_password: booleanCodec },
  });
  await users.insertMany([
    {
      id: generateId(),
      nama: input.nama_admin,
      username: input.username_admin,
      password_hash: await hashPassword(input.password_admin),
      role: "admin",
      aktif: true,
      wajib_ganti_password: true,
      dibuat_pada: now,
    },
  ]);

  const school = await deps.registry.registerSchool({
    slug: input.slug,
    nama_sekolah: input.nama_sekolah,
    owner_email: session.email,
    sheet_id: spreadsheetId,
    refresh_token_enc: session.refreshTokenEnc,
  });

  const appUrl = (deps.appUrl ?? env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  return {
    schoolId: school.school_id,
    slug: school.slug,
    loginUrl: `${appUrl}/s/${school.slug}/login`,
  };
}
