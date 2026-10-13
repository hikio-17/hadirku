/**
 * Rotasi TOKEN_ENCRYPTION_KEY.
 *
 * Cara pakai (JANGAN commit key ke repo):
 *   export OLD_TOKEN_ENCRYPTION_KEY="<kunci lama base64>"
 *   export TOKEN_ENCRYPTION_KEY="<kunci baru base64>"   # generate: openssl rand -base64 32
 *   export GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
 *   export GOOGLE_PRIVATE_KEY="..."   # atau file via GOOGLE_PRIVATE_KEY_FILE
 *   export REGISTRY_SHEET_ID="..."
 *   pnpm keys:rotate
 *
 * Script membaca semua baris registry, mendekripsi dengan kunci lama, dan
 * mengenkripsi ulang dengan kunci baru. Tidak pernah mencetak token ke stdout.
 */
import { readFileSync } from "node:fs";

import { getEncryptionKey } from "../src/lib/crypto/token";
import {
  createGoogleSheetsValuesClient,
  createServiceAccountSheets,
} from "../src/lib/google/sheets-adapter";
import { RegistryRepo } from "../src/lib/registry/RegistryRepo";
import { rotateRegistryTokens } from "../src/lib/registry/rotate";

function must(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Environment ${name} belum diisi.`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const oldKey = must("OLD_TOKEN_ENCRYPTION_KEY");
  const newKey = must("TOKEN_ENCRYPTION_KEY");
  // Validasi format lebih dulu sebelum menyentuh registry.
  getEncryptionKey(oldKey);
  getEncryptionKey(newKey);

  if (process.env.GOOGLE_PRIVATE_KEY_FILE) {
    process.env.GOOGLE_PRIVATE_KEY = readFileSync(process.env.GOOGLE_PRIVATE_KEY_FILE, "utf8");
  }
  const registryId = must("REGISTRY_SHEET_ID");
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error("Kredensial Service Account belum diisi.");
    process.exit(1);
  }

  const registry = new RegistryRepo(
    createGoogleSheetsValuesClient(createServiceAccountSheets()),
    registryId
  );
  const { rotated, skipped } = await rotateRegistryTokens(registry, oldKey, newKey);
  console.log(
    `Rotasi selesai: ${rotated} token dienkripsi ulang, ${skipped} dilewati (tanpa token).`
  );
}

if (process.argv[1]?.endsWith("rotate-token-key.ts")) {
  await main();
}
