import "server-only";

import type { sheets_v4 } from "googleapis";

import { a1 } from "@/lib/storage/sheets/SheetsTable";
import {
  ABSENSI_COLUMNS,
  GURU_COLUMNS,
  JADWAL_COLUMNS,
  KELAS_COLUMNS,
  LOG_PERUBAHAN_COLUMNS,
  MAPEL_COLUMNS,
  PENGATURAN_COLUMNS,
  PENGAJUAN_IZIN_COLUMNS,
  PENUGASAN_COLUMNS,
  SISWA_COLUMNS,
  TAHUN_AJARAN_COLUMNS,
  USERS_COLUMNS,
} from "@/lib/storage/sheets/columns";

export interface ProvisionTab {
  name: string;
  headers: string[];
}

/**
 * Struktur spreadsheet sekolah (satu spreadsheet per sekolah).
 * Header persis skema §4; baris 1 tiap tab = header.
 */
export const SCHOOL_TABS: ProvisionTab[] = [
  { name: "users", headers: [...USERS_COLUMNS] },
  { name: "guru", headers: [...GURU_COLUMNS] },
  { name: "siswa", headers: [...SISWA_COLUMNS] },
  { name: "kelas", headers: [...KELAS_COLUMNS] },
  { name: "mapel", headers: [...MAPEL_COLUMNS] },
  { name: "penugasan", headers: [...PENUGASAN_COLUMNS] },
  { name: "jadwal", headers: [...JADWAL_COLUMNS] },
  { name: "absensi", headers: [...ABSENSI_COLUMNS] },
  { name: "pengajuan_izin", headers: [...PENGAJUAN_IZIN_COLUMNS] },
  { name: "log_perubahan", headers: [...LOG_PERUBAHAN_COLUMNS] },
  { name: "tahun_ajaran", headers: [...TAHUN_AJARAN_COLUMNS] },
  { name: "pengaturan", headers: [...PENGATURAN_COLUMNS] },
];

/** Operasi Sheets minimal untuk provisioning (mudah di-mock di test). */
export interface ProvisionSheetsLike {
  createSpreadsheet(title: string, tabs: ProvisionTab[]): Promise<string>;
  writeHeaders(spreadsheetId: string, tabs: ProvisionTab[]): Promise<void>;
}

/**
 * Buat spreadsheet BARU di Drive operator + tulis header semua tab.
 * Tidak menyalin template milik platform (scope drive.file tidak mengizinkan
 * akses file yang tidak dibuat/dipilih app).
 */
export async function provisionSchoolSpreadsheet(
  provisioner: ProvisionSheetsLike,
  title: string
): Promise<string> {
  const spreadsheetId = await provisioner.createSpreadsheet(title, SCHOOL_TABS);
  if (!spreadsheetId) throw new Error("Gagal membuat spreadsheet sekolah.");
  await provisioner.writeHeaders(spreadsheetId, SCHOOL_TABS);
  return spreadsheetId;
}

export function createGoogleProvisioner(sheets: sheets_v4.Sheets): ProvisionSheetsLike {
  return {
    async createSpreadsheet(title: string, tabs: ProvisionTab[]): Promise<string> {
      const res = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: tabs.map((t) => ({ properties: { title: t.name } })),
        },
      });
      const id = res.data.spreadsheetId;
      if (!id) throw new Error("Google tidak mengembalikan ID spreadsheet.");
      return id;
    },
    async writeHeaders(spreadsheetId: string, tabs: ProvisionTab[]): Promise<void> {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          // SATU batchUpdate untuk header semua tab.
          data: tabs.map((t) => ({ range: a1(t.name, "A1"), values: [t.headers] })),
        },
      });
    },
  };
}
