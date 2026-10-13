import "server-only";

import type { sheets_v4 } from "googleapis";

import { a1 } from "@/lib/storage/sheets/SheetsTable";

export interface ProvisionTab {
  name: string;
  headers: string[];
}

/**
 * Struktur spreadsheet sekolah (satu spreadsheet per sekolah).
 * Header persis skema §4; baris 1 tiap tab = header.
 */
export const SCHOOL_TABS: ProvisionTab[] = [
  {
    name: "users",
    headers: [
      "id",
      "nama",
      "username",
      "password_hash",
      "role",
      "aktif",
      "wajib_ganti_password",
      "dibuat_pada",
    ],
  },
  {
    name: "guru",
    headers: ["id", "user_id", "nip", "nama", "is_wali_kelas", "kelas_wali_id", "aktif"],
  },
  {
    name: "siswa",
    headers: ["id", "user_id", "nis", "nama", "kelas_id", "jenis_kelamin", "aktif"],
  },
  { name: "kelas", headers: ["id", "nama", "tingkat", "tahun_ajaran_id"] },
  { name: "mapel", headers: ["id", "nama", "kode"] },
  { name: "penugasan", headers: ["id", "guru_id", "kelas_id", "mapel_id", "tahun_ajaran_id"] },
  { name: "jadwal", headers: ["id", "penugasan_id", "hari", "jam_mulai", "jam_selesai"] },
  {
    name: "absensi",
    headers: [
      "id",
      "tanggal",
      "jadwal_id",
      "siswa_id",
      "status",
      "catatan",
      "diinput_oleh",
      "diinput_pada",
      "diubah_pada",
    ],
  },
  {
    name: "pengajuan_izin",
    headers: [
      "id",
      "siswa_id",
      "tanggal",
      "jenis",
      "alasan",
      "url_bukti",
      "status",
      "diproses_oleh",
    ],
  },
  {
    name: "log_perubahan",
    headers: ["id", "tabel", "record_id", "aksi", "data_lama", "data_baru", "oleh", "waktu"],
  },
  { name: "tahun_ajaran", headers: ["id", "nama", "semester", "aktif"] },
  { name: "pengaturan", headers: ["kunci", "nilai"] },
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
