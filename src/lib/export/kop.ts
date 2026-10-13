import "server-only";

import { SheetsTable } from "@/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import { PENGATURAN_COLUMNS } from "@/lib/storage/sheets/columns";
import type { PengaturanRow } from "@/lib/storage/types";

/** Kop laporan dari tab pengaturan milik sekolah. */
export interface KopSekolah {
  nama: string;
  alamat: string;
}

export async function getKop(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  fallbackNama = ""
): Promise<KopSekolah> {
  const rows = await new SheetsTable<PengaturanRow>(sheets, spreadsheetId, "pengaturan", {
    columns: [...PENGATURAN_COLUMNS],
    idColumn: "kunci",
  }).findAll();
  const m = new Map(rows.map((r) => [r.kunci, r.nilai]));
  return {
    nama: m.get("nama_sekolah")?.trim() || fallbackNama || "-",
    alamat: m.get("alamat")?.trim() ?? "",
  };
}

export interface LaporanMeta {
  dari: string;
  sampai: string;
  kelasLabel: string;
  mapelLabel: string;
  dicetakOleh: string;
  dicetakPada: string;
}

export function periodeLabel(
  meta: Pick<LaporanMeta, "dari" | "sampai" | "kelasLabel" | "mapelLabel">
): string {
  const scope = [meta.kelasLabel, meta.mapelLabel].filter(Boolean).join(" · ");
  return `Periode ${meta.dari} s.d. ${meta.sampai}${scope ? ` · ${scope}` : ""}`;
}
