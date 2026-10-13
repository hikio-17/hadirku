import "server-only";

/**
 * Stub adapter PostgreSQL (migrasi Supabase, Tahap 9).
 * Skema SQL: docs/postgres-schema.sql (menyusul Tahap 9).
 * Script migrasi: scripts/migrate-sheets-to-postgres.ts (menyusul Tahap 9).
 */
export function createPostgresRepository(): never {
  throw new Error(
    "Adapter PostgreSQL belum tersedia (rencana Tahap 9). Sekolah gratis memakai adapter sheets."
  );
}
