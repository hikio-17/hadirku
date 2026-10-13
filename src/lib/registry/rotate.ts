import "server-only";

import { decryptToken, encryptToken } from "@/lib/crypto/token";
import type { RegistryRepo } from "@/lib/registry/RegistryRepo";

/**
 * Rotasi TOKEN_ENCRYPTION_KEY: dekripsi semua refresh token dengan kunci lama,
 * enkripsi ulang dengan kunci baru. Sekolah tanpa token dilewati.
 * Dijalankan via `pnpm keys:rotate` (scripts/rotate-token-key.ts).
 */
export async function rotateRegistryTokens(
  registry: RegistryRepo,
  oldKey: string,
  newKey: string
): Promise<{ rotated: number; skipped: number }> {
  let rotated = 0;
  let skipped = 0;
  const schools = await registry.findAll();
  for (const school of schools) {
    if (!school.refresh_token_enc) {
      skipped += 1;
      continue;
    }
    const plain = decryptToken(school.refresh_token_enc, oldKey);
    await registry.updateRefreshToken(school.school_id, encryptToken(plain, newKey), school.status);
    rotated += 1;
  }
  return { rotated, skipped };
}
