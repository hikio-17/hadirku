import "server-only";

import { google, type sheets_v4 } from "googleapis";

import { env } from "@/lib/env";
import type {
  CellValue,
  SheetsBatchUpdateItem,
  SheetsValuesClient,
} from "@/lib/storage/sheets/SheetsTable";

/**
 * Adapter googleapis sheets v4 → interface SheetsValuesClient milik SheetsTable.
 * Baca beberapa tab sekaligus via values.batchGet; tulis massal via
 * values.batchUpdate / values.append.
 */
export function createGoogleSheetsValuesClient(sheets: sheets_v4.Sheets): SheetsValuesClient {
  return {
    async batchGet(spreadsheetId: string, ranges: string[]) {
      const res = await sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges });
      return (res.data.valueRanges ?? []).map((vr) => ({
        range: vr.range ?? "",
        values: ((vr.values ?? []) as CellValue[][]).map((row) => [...row]),
      }));
    },
    async batchUpdate(spreadsheetId: string, updates: SheetsBatchUpdateItem[]) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: updates.map((u) => ({ range: u.range, values: u.values })),
        },
      });
    },
    async append(spreadsheetId: string, range: string, values: CellValue[][]) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
    },
  };
}

/** Client Sheets terautentikasi access token milik admin sekolah. */
export function createTenantSheets(accessToken: string): sheets_v4.Sheets {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

/** Client Sheets via Service Account (hanya untuk REGISTRY milik platform). */
export function createServiceAccountSheets(): sheets_v4.Sheets {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new Error(
      "Service Account belum dikonfigurasi (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)."
    );
  }
  const auth = new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}
