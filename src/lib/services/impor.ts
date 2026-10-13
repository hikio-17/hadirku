import "server-only";

import ExcelJS from "exceljs";
import { z } from "zod";

import type { Cache } from "@/lib/redis";
import { SheetsTable, booleanCodec } from "@/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import {
  GURU_COLUMNS,
  KELAS_COLUMNS,
  SISWA_COLUMNS,
  USERS_COLUMNS,
} from "@/lib/storage/sheets/columns";
import type { GuruRow, SiswaRow, UserRow } from "@/lib/storage/types";
import { passwordSchema, usernameSchema } from "@/lib/validations/admin";
import { generateId } from "@/lib/storage/sheets/SheetsTable";
import { hashPasswordDefault } from "@/lib/services/auth";

export type ImportJenis = "guru" | "siswa";

export const IMPORT_GURU_HEADERS = ["nama", "nip", "username", "password"] as const;
export const IMPORT_SISWA_HEADERS = [
  "nama",
  "nis",
  "username",
  "password",
  "kelas",
  "jenis_kelamin",
] as const;

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ERRORS = 50;

export interface ImportRowError {
  baris: number;
  pesan: string;
}

const guruRowSchema = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi.").max(120),
  nip: z.string().trim().max(32).default(""),
  username: usernameSchema,
  password: passwordSchema,
});

const siswaRowSchema = guruRowSchema.extend({
  nis: z.string().trim().max(32).default(""),
  kelas: z.string().trim().min(1, "Kelas wajib diisi."),
  jenis_kelamin: z.string().trim().min(1, "Jenis kelamin wajib diisi."),
});

function normalizeJk(v: string): string {
  const s = v.trim().toLowerCase();
  if (["l", "laki-laki", "laki laki", "lk"].includes(s)) return "L";
  if (["p", "perempuan", "pr"].includes(s)) return "P";
  return v;
}

function sheetToRecords(worksheet: ExcelJS.Worksheet, headers: readonly string[]) {
  const headerRow = worksheet.getRow(1);
  const indexByName = new Map<string, number>();
  headerRow.eachCell((cell, col) => {
    indexByName.set(
      String(cell.value ?? "")
        .trim()
        .toLowerCase(),
      col
    );
  });
  const missing = headers.filter((h) => !indexByName.has(h));
  if (missing.length > 0) {
    throw new Error(`Kolom wajib tidak ada: ${missing.join(", ")}. Unduh template dulu.`);
  }
  const records: { baris: number; values: Record<string, string> }[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = {};
    let kosong = true;
    for (const h of headers) {
      const v = String(row.getCell(indexByName.get(h)!).value ?? "").trim();
      values[h] = v;
      if (v !== "") kosong = false;
    }
    if (!kosong) records.push({ baris: rowNumber, values });
  });
  return records;
}

/** Parse buffer .xlsx → baris tervalidasi + daftar error per baris Excel. */
export async function parseImportBuffer(
  jenis: ImportJenis,
  buffer: Uint8Array
): Promise<{ rows: Record<string, string>[]; errors: ImportRowError[] }> {
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs mengetik Buffer versi lama; cast aman untuk runtime Node 22.
    type LoadArg = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];
    await wb.xlsx.load(buffer as unknown as LoadArg);
  } catch {
    throw new Error("File bukan Excel (.xlsx) yang valid.");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File Excel kosong.");
  const headers = jenis === "guru" ? IMPORT_GURU_HEADERS : IMPORT_SISWA_HEADERS;
  const records = sheetToRecords(ws, headers);
  if (records.length === 0) throw new Error("Tidak ada baris data di file.");
  if (records.length > 2000) throw new Error("Maksimal 2000 baris per impor.");

  const rows: Record<string, string>[] = [];
  const errors: ImportRowError[] = [];
  for (const rec of records) {
    if (errors.length >= MAX_IMPORT_ERRORS) break;
    const values = { ...rec.values };
    if (jenis === "siswa") values["jenis_kelamin"] = normalizeJk(values["jenis_kelamin"]);
    const parsed = (jenis === "guru" ? guruRowSchema : siswaRowSchema).safeParse(values);
    if (!parsed.success) {
      errors.push({ baris: rec.baris, pesan: parsed.error.issues[0]?.message ?? "Tidak valid." });
      continue;
    }
    if (jenis === "siswa" && !["L", "P"].includes(values["jenis_kelamin"])) {
      errors.push({ baris: rec.baris, pesan: "Jenis kelamin harus L atau P." });
      continue;
    }
    rows.push({ ...values, ...(parsed.data as Record<string, string>) });
  }
  return { rows, errors };
}

function usersTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<UserRow>(sheets, spreadsheetId, "users", {
    columns: [...USERS_COLUMNS],
    codecs: { aktif: booleanCodec, wajib_ganti_password: booleanCodec },
  });
}

export interface ConfirmResult {
  akun: number;
  profil: number;
}

/**
 * Eksekusi impor: cek duplikat (username/nip/nis, termasuk dalam batch),
 * buat akun (1 append) + profil (1 append). Password di-hash, wajib ganti.
 */
export async function confirmImport(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  jenis: ImportJenis,
  rows: Record<string, string>[],
  opts?: { hash?: (password: string) => Promise<string> }
): Promise<ConfirmResult> {
  if (rows.length === 0) throw new Error("Tidak ada baris untuk diimpor.");
  const hashPw = opts?.hash ?? hashPasswordDefault;

  const [users, kelas] = await Promise.all([
    usersTable(sheets, spreadsheetId).findAll(),
    new SheetsTable(sheets, spreadsheetId, "kelas", { columns: [...KELAS_COLUMNS] }).findAll(),
  ]);
  const usernameAda = new Set(users.map((u) => u.username.toLowerCase()));
  const kelasByName = new Map(
    (kelas as { id: string; nama: string }[]).map((k) => [k.nama.trim().toLowerCase(), k.id])
  );

  const batchUsername = new Set<string>();
  const batchNipNis = new Set<string>();
  const now = new Date().toISOString();

  if (jenis === "guru") {
    const existing = await new SheetsTable(sheets, spreadsheetId, "guru", {
      columns: [...GURU_COLUMNS],
    }).findAll();
    const nipAda = new Set(existing.map((g) => g.nip).filter(Boolean));
    for (const [i, r] of rows.entries()) {
      const u = r["username"].toLowerCase();
      if (usernameAda.has(u) || batchUsername.has(u)) {
        throw new Error(`Baris ${i + 1}: username "${r["username"]}" sudah dipakai.`);
      }
      batchUsername.add(u);
      if (r["nip"]) {
        if (nipAda.has(r["nip"]) || batchNipNis.has(`nip:${r["nip"]}`)) {
          throw new Error(`Baris ${i + 1}: NIP "${r["nip"]}" sudah dipakai.`);
        }
        batchNipNis.add(`nip:${r["nip"]}`);
      }
    }
    const newUsers: UserRow[] = [];
    for (const r of rows) {
      newUsers.push({
        id: generateId(),
        nama: r["nama"],
        username: r["username"].toLowerCase(),
        password_hash: await hashPw(r["password"]),
        role: "guru" as const,
        aktif: true,
        wajib_ganti_password: true,
        dibuat_pada: now,
      });
    }
    await usersTable(sheets, spreadsheetId).insertMany(newUsers);
    await new SheetsTable<GuruRow>(sheets, spreadsheetId, "guru", {
      columns: [...GURU_COLUMNS],
      codecs: { is_wali_kelas: booleanCodec, aktif: booleanCodec },
    }).insertMany(
      rows.map((r, i) => ({
        id: "",
        user_id: newUsers[i].id,
        nip: r["nip"] ?? "",
        nama: r["nama"],
        is_wali_kelas: false,
        kelas_wali_id: "",
        aktif: true,
      }))
    );
    return { akun: newUsers.length, profil: rows.length };
  }

  const existing = await new SheetsTable(sheets, spreadsheetId, "siswa", {
    columns: [...SISWA_COLUMNS],
  }).findAll();
  const nisAda = new Set(existing.map((s) => s.nis).filter(Boolean));
  const kelasIdOf: string[] = [];
  for (const [i, r] of rows.entries()) {
    const u = r["username"].toLowerCase();
    if (usernameAda.has(u) || batchUsername.has(u)) {
      throw new Error(`Baris ${i + 1}: username "${r["username"]}" sudah dipakai.`);
    }
    batchUsername.add(u);
    if (r["nis"]) {
      if (nisAda.has(r["nis"]) || batchNipNis.has(`nis:${r["nis"]}`)) {
        throw new Error(`Baris ${i + 1}: NIS "${r["nis"]}" sudah dipakai.`);
      }
      batchNipNis.add(`nis:${r["nis"]}`);
    }
    const kid = kelasByName.get(r["kelas"].trim().toLowerCase());
    if (!kid) throw new Error(`Baris ${i + 1}: kelas "${r["kelas"]}" tidak ditemukan.`);
    kelasIdOf.push(kid);
  }
  const newUsers: UserRow[] = [];
  for (const r of rows) {
    newUsers.push({
      id: generateId(),
      nama: r["nama"],
      username: r["username"].toLowerCase(),
      password_hash: await hashPw(r["password"]),
      role: "siswa" as const,
      aktif: true,
      wajib_ganti_password: true,
      dibuat_pada: now,
    });
  }
  await usersTable(sheets, spreadsheetId).insertMany(newUsers);
  await new SheetsTable<SiswaRow>(sheets, spreadsheetId, "siswa", {
    columns: [...SISWA_COLUMNS],
    codecs: { aktif: booleanCodec },
  }).insertMany(
    rows.map((r, i) => ({
      id: "",
      user_id: newUsers[i].id,
      nis: r["nis"] ?? "",
      nama: r["nama"],
      kelas_id: kelasIdOf[i],
      jenis_kelamin: r["jenis_kelamin"],
      aktif: true,
    }))
  );
  return { akun: newUsers.length, profil: rows.length };
}

// --- Batch sementara (upload → pratinjau → konfirmasi) ---
export interface PendingImport {
  jenis: ImportJenis;
  rows: Record<string, string>[];
}

export const IMPORT_TTL_SECONDS = 600;

export async function stashImportBatch(cache: Cache, batch: PendingImport): Promise<string> {
  const id = generateId();
  await cache.set(`import:${id}`, batch, IMPORT_TTL_SECONDS);
  return id;
}

/** Ambil + hapus (satu kali pakai). */
export async function takeImportBatch(cache: Cache, id: string): Promise<PendingImport | null> {
  const batch = await cache.get<PendingImport>(`import:${id}`);
  if (batch) await cache.del(`import:${id}`);
  return batch;
}

// --- Template .xlsx ---
export async function buildTemplateWorkbook(jenis: ImportJenis): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(jenis === "guru" ? "Guru" : "Siswa");
  const headers = jenis === "guru" ? IMPORT_GURU_HEADERS : IMPORT_SISWA_HEADERS;
  ws.addRow([...headers]);
  ws.addRow(
    jenis === "guru"
      ? ["Budi Santoso", "198001012010011001", "budi.santoso", "rahasia123"]
      : ["Ani Lestari", "1001", "ani.lestari", "rahasia123", "VII-A", "P"]
  );
  ws.getRow(1).font = { bold: true };
  ws.columns = headers.map((h) => ({ header: h, key: h, width: 22 }));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
