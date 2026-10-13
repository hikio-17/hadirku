import "server-only";

import { SheetsTable, booleanCodec } from "@/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import {
  KELAS_COLUMNS,
  MAPEL_COLUMNS,
  PENGATURAN_COLUMNS,
  TAHUN_AJARAN_COLUMNS,
} from "@/lib/storage/sheets/columns";
import type { KelasRow, MapelRow, PengaturanRow, TahunAjaranRow } from "@/lib/storage/types";
import {
  pengaturanSchema,
  upsertKelasSchema,
  upsertMapelSchema,
  upsertTahunAjaranSchema,
} from "@/lib/validations/admin";

function kelasTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<KelasRow>(sheets, spreadsheetId, "kelas", {
    columns: [...KELAS_COLUMNS],
  });
}

function mapelTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<MapelRow>(sheets, spreadsheetId, "mapel", {
    columns: [...MAPEL_COLUMNS],
  });
}

function taTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<TahunAjaranRow>(sheets, spreadsheetId, "tahun_ajaran", {
    columns: [...TAHUN_AJARAN_COLUMNS],
    codecs: { aktif: booleanCodec },
  });
}

function pengaturanTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<PengaturanRow>(sheets, spreadsheetId, "pengaturan", {
    columns: [...PENGATURAN_COLUMNS],
    idColumn: "kunci",
  });
}

// --- Kelas ---
export async function listKelas(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<KelasRow[]> {
  return kelasTable(sheets, spreadsheetId).findAll();
}

export async function saveKelas(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown
): Promise<void> {
  const input = upsertKelasSchema.parse(raw);
  const tas = await taTable(sheets, spreadsheetId).findAll();
  if (!tas.some((t) => t.id === input.tahun_ajaran_id)) {
    throw new Error("Tahun ajaran tidak ditemukan.");
  }
  if (input.id) {
    const updated = await kelasTable(sheets, spreadsheetId).update(input.id, {
      nama: input.nama,
      tingkat: input.tingkat,
      tahun_ajaran_id: input.tahun_ajaran_id,
    });
    if (!updated) throw new Error("Kelas tidak ditemukan.");
  } else {
    await kelasTable(sheets, spreadsheetId).insert({
      id: "",
      nama: input.nama,
      tingkat: input.tingkat,
      tahun_ajaran_id: input.tahun_ajaran_id,
    });
  }
}

export async function deleteKelas(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  id: string,
  refs: {
    siswaCount: (kelasId: string) => Promise<number>;
    penugasanCount: (kelasId: string) => Promise<number>;
  }
): Promise<void> {
  if ((await refs.siswaCount(id)) > 0) {
    throw new Error("Kelas masih dipakai siswa. Pindahkan dulu siswanya.");
  }
  if ((await refs.penugasanCount(id)) > 0) {
    throw new Error("Kelas masih dipakai penugasan guru. Hapus penugasannya dulu.");
  }
  // Kelas tanpa kolom aktif → baris dikosongkan (lihat SheetsTable.softDelete).
  await kelasTable(sheets, spreadsheetId).softDelete(id);
}

// --- Mapel ---
export async function listMapel(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<MapelRow[]> {
  return mapelTable(sheets, spreadsheetId).findAll();
}

export async function saveMapel(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown
): Promise<void> {
  const input = upsertMapelSchema.parse(raw);
  if (input.id) {
    const updated = await mapelTable(sheets, spreadsheetId).update(input.id, {
      nama: input.nama,
      kode: input.kode,
    });
    if (!updated) throw new Error("Mapel tidak ditemukan.");
  } else {
    await mapelTable(sheets, spreadsheetId).insert({ id: "", nama: input.nama, kode: input.kode });
  }
}

export async function deleteMapel(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  id: string,
  refs: { penugasanCount: (mapelId: string) => Promise<number> }
): Promise<void> {
  if ((await refs.penugasanCount(id)) > 0) {
    throw new Error("Mapel masih dipakai penugasan. Hapus penugasannya dulu.");
  }
  await mapelTable(sheets, spreadsheetId).softDelete(id);
}

// --- Tahun ajaran (hanya satu yang aktif) ---
export async function listTahunAjaran(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<TahunAjaranRow[]> {
  return taTable(sheets, spreadsheetId).findAll();
}

export async function saveTahunAjaran(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown
): Promise<void> {
  const input = upsertTahunAjaranSchema.parse(raw);
  const table = taTable(sheets, spreadsheetId);
  if (input.aktif) {
    const others = (await table.findAll()).filter((t) => t.id !== input.id && t.aktif);
    if (others.length > 0) {
      await table.updateMany(
        others.map((t) => t.id),
        { aktif: false }
      );
    }
  }
  if (input.id) {
    const updated = await table.update(input.id, {
      nama: input.nama,
      semester: input.semester,
      aktif: input.aktif,
    });
    if (!updated) throw new Error("Tahun ajaran tidak ditemukan.");
  } else {
    await table.insert({ id: "", nama: input.nama, semester: input.semester, aktif: input.aktif });
  }
}

export async function deleteTahunAjaran(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  id: string,
  refs: { usedCount: (taId: string) => Promise<number> }
): Promise<void> {
  if ((await refs.usedCount(id)) > 0) {
    throw new Error("Tahun ajaran masih dipakai kelas/penugasan.");
  }
  await taTable(sheets, spreadsheetId).softDelete(id);
}

// --- Pengaturan ---
export async function getPengaturan(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<Record<string, string>> {
  const rows = await pengaturanTable(sheets, spreadsheetId).findAll();
  return Object.fromEntries(rows.map((r) => [r.kunci, r.nilai]));
}

export async function savePengaturan(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown
): Promise<void> {
  const input = pengaturanSchema.parse(raw);
  const ambang = input["ambang_kehadiran_rendah"];
  if (ambang !== undefined && ambang !== "") {
    const n = Number(ambang);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new Error("Ambang kehadiran harus angka 0–100.");
    }
  }
  const table = pengaturanTable(sheets, spreadsheetId);
  for (const [kunci, nilai] of Object.entries(input)) {
    const updated = await table.update(kunci, { nilai });
    if (!updated) await table.insert({ kunci, nilai });
  }
}
