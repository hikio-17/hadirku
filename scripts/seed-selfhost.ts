/**
 * Siapkan spreadsheet self-host: buat spreadsheet baru via Service Account
 * + tulis header 12 tab, lalu cetak ID-nya untuk SELFHOST_SPREADSHEET_ID.
 *
 * Cara pakai:
 *   export GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
 *   export GOOGLE_PRIVATE_KEY="..."   # atau GOOGLE_PRIVATE_KEY_FILE
 *   pnpm seed:selfhost --title="Hadirku - SDN 1"
 *
 * Setelah itu share spreadsheet ke email Service Account (Editor)
 * bila dibuat di akun berbeda — bila dibuat script ini, file sudah
 * milik Service Account dan tinggal dipakai.
 */
import { readFileSync } from "node:fs";

import { createGoogleProvisioner, provisionSchoolSpreadsheet } from "../src/lib/google/provision";
import { createServiceAccountSheets } from "../src/lib/google/sheets-adapter";

function arg(name: string): string | undefined {
  const p = `--${name}=`;
  return process.argv.find((a) => a.startsWith(p))?.slice(p.length);
}

async function main(): Promise<void> {
  if (process.env.GOOGLE_PRIVATE_KEY_FILE) {
    process.env.GOOGLE_PRIVATE_KEY = readFileSync(process.env.GOOGLE_PRIVATE_KEY_FILE, "utf8");
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error("Isi GOOGLE_SERVICE_ACCOUNT_EMAIL dan GOOGLE_PRIVATE_KEY dulu.");
    process.exit(1);
  }
  const title = arg("title") ?? "Hadirku - Sekolah";
  const id = await provisionSchoolSpreadsheet(
    createGoogleProvisioner(createServiceAccountSheets()),
    title
  );
  console.log(`Spreadsheet siap: ${id}`);
  console.log(`Set SELFHOST_SPREADSHEET_ID=${id}`);
}

if (process.argv[1]?.endsWith("seed-selfhost.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
