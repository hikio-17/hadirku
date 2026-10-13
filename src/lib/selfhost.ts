import "server-only";

import { env } from "@/lib/env";
import {
  createGoogleSheetsValuesClient,
  createServiceAccountSheets,
} from "@/lib/google/sheets-adapter";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import type { SchoolRow } from "@/lib/storage/types";
import type { TenantClient } from "@/lib/google/tenant-client";

/**
 * Jalur self-host: SATU sekolah, Service Account, tanpa OAuth dan registry.
 * Spreadsheet disiapkan manual (lihat README), di-share ke email SA.
 */
export function isSelfHostMode(e: typeof env = env): boolean {
  return e.DEPLOY_MODE === "selfhost";
}

function mustSpreadsheetId(): string {
  if (!env.SELFHOST_SPREADSHEET_ID) {
    throw new Error("SELFHOST_SPREADSHEET_ID belum dikonfigurasi.");
  }
  return env.SELFHOST_SPREADSHEET_ID;
}

export function selfHostSlug(): string {
  return (env.SELFHOST_SLUG || "sekolah").trim().toLowerCase();
}

export function selfHostSchoolRow(): SchoolRow {
  return {
    school_id: "selfhost",
    slug: selfHostSlug(),
    nama_sekolah: env.SELFHOST_SCHOOL_NAME || "Sekolah",
    owner_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
    sheet_id: mustSpreadsheetId(),
    refresh_token_enc: "",
    status: "aktif",
    storage_adapter: "sheets",
    dibuat_pada: "",
    terakhir_aktif: "",
  };
}

/** Konteks tenant self-host: slug harus cocok dengan yang dikonfigurasi. */
export function getSelfHostContext(
  slug: string,
  sheetsFactory?: (sheets: SheetsValuesClient) => SheetsValuesClient
): TenantClient {
  if (slug.trim().toLowerCase() !== selfHostSlug()) {
    throw new Error(`Sekolah "${slug}" tidak ditemukan.`);
  }
  const school = selfHostSchoolRow();
  const sheets = createGoogleSheetsValuesClient(createServiceAccountSheets());
  return {
    context: {
      schoolId: school.school_id,
      slug: school.slug,
      spreadsheetId: school.sheet_id,
      storageAdapter: "sheets",
    },
    sheets: sheetsFactory ? sheetsFactory(sheets) : sheets,
    accessToken: "",
    school,
  };
}
