import type { CellValue, SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";

/**
 * Fake spreadsheet multi-tab untuk unit test service (Tahap 4+).
 * Key tab → array baris; baris pertama tiap tab = header.
 * Murni in-memory, tanpa import server-only.
 */
export function makeSheetsStore(initial: Record<string, string[][]> = {}) {
  const store = new Map<string, string[][]>(Object.entries(initial));
  const calls = { batchGet: 0, batchUpdate: 0, append: 0 };

  const sheetOf = (range: string) => range.split("!")[0].replace(/^'|'$/g, "");

  const client: SheetsValuesClient = {
    async batchGet(_spreadsheetId, ranges) {
      calls.batchGet += 1;
      return ranges.map((range) => ({ range, values: store.get(sheetOf(range)) ?? [] }));
    },
    async append(_spreadsheetId, range, values: CellValue[][]) {
      calls.append += 1;
      const rows = store.get(sheetOf(range)) ?? [];
      for (const v of values) rows.push(v.map((c) => String(c ?? "")));
      store.set(sheetOf(range), rows);
    },
    async batchUpdate(_spreadsheetId, updates) {
      calls.batchUpdate += 1;
      for (const u of updates) {
        const [sheetPart, cellPart] = u.range.split("!");
        const sheet = sheetPart.replace(/^'|'$/g, "");
        // Nomor baris 1-based termasuk header (baris 1); header di indeks 0.
        const n = Number(cellPart.match(/A(\d+):/)?.[1]);
        const rows = store.get(sheet) ?? [];
        rows[n - 1] = u.values[0].map((c) => String(c));
        store.set(sheet, rows);
      }
    },
  };

  return { client, store, calls };
}

/** Bangun store dari definisi kolom + baris objek (urutan kolom = header). */
export function seedTab(columns: readonly string[], rows: Record<string, unknown>[]): string[][] {
  return [[...columns], ...rows.map((r) => columns.map((c) => String(r[c] ?? "")))];
}
