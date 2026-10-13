import "server-only";

import ExcelJS from "exceljs";

import { SCHOOL_TABS } from "@/lib/google/provision";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";

/**
 * Backup seluruh data sekolah: 12 tab (header skema + baris mentah).
 * Cukup SATU batchGet untuk semua tab (jarang dijalankan admin).
 */
export async function buildBackupWorkbook(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<Buffer> {
  const ranges = SCHOOL_TABS.map((t) => `${t.name}!A1:ZZ`);
  const valueRanges = await sheets.batchGet(spreadsheetId, ranges);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hadirku";
  wb.created = new Date();
  SCHOOL_TABS.forEach((tab, i) => {
    const ws = wb.addWorksheet(tab.name);
    const values = valueRanges[i]?.values ?? [];
    if (values.length === 0) {
      ws.addRow(tab.headers).font = { bold: true };
    } else {
      for (const row of values) ws.addRow([...row]);
      ws.getRow(1).font = { bold: true };
    }
    ws.columns = tab.headers.map(() => ({ width: 18 }));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
