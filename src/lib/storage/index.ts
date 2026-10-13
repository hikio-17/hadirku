import "server-only";

import type { StorageAdapter } from "@/types";
import { createPostgresRepository } from "./postgres/stub";

/**
 * Factory adapter storage per sekolah.
 * Field `storage_adapter` di registry (sheets|postgres) menentukan adapter,
 * sehingga satu instance bisa melayani sekolah gratis (Sheets) dan
 * berbayar (Postgres) bersamaan.
 */
export function assertStorageSupported(adapter: StorageAdapter): void {
  if (adapter === "postgres") {
    createPostgresRepository();
  }
}

export function isStorageSupported(adapter: StorageAdapter): boolean {
  return adapter === "sheets";
}
