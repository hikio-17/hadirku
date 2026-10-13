/**
 * Migrasi satu sekolah dari Google Sheets ke PostgreSQL.
 *
 * Cara pakai (JANGAN commit secret):
 *   export DATABASE_URL="postgresql://user:pass@host:5432/hadirku"
 *   export GOOGLE_SERVICE_ACCOUNT_EMAIL="..."
 *   export GOOGLE_PRIVATE_KEY="..."      # atau GOOGLE_PRIVATE_KEY_FILE
 *   # multitenant (baca registry + token sekolah):
 *   export REGISTRY_SHEET_ID="..."
 *   export TOKEN_ENCRYPTION_KEY="..."
 *   pnpm migrate:sheets-pg --slug=smpn-1 [--schema=school_smpn1] [--set-adapter]
 *   # langsung via spreadsheet (tanpa registry):
 *   pnpm migrate:sheets-pg --spreadsheet-id=ABC123 [--schema=school_x]
 *
 * Alur: buat schema dari docs/postgres-schema.sql → baca 12 tab Sheets →
 * tulis via PostgresTable. Jalankan di schema KOSONG (tidak idempoten).
 * --set-adapter mengubah registry storage_adapter menjadi "postgres" —
 * pakai HANYA setelah migrasi terverifikasi (runtime Postgres menyusul).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import { getServerRegistry } from "../src/lib/google/tenant-client";
import { getTenantContext } from "../src/lib/google/tenant-client";
import {
  createGoogleSheetsValuesClient,
  createServiceAccountSheets,
} from "../src/lib/google/sheets-adapter";
import { SheetsTable, booleanCodec } from "../src/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "../src/lib/storage/sheets/SheetsTable";
import {
  ABSENSI_COLUMNS,
  GURU_COLUMNS,
  JADWAL_COLUMNS,
  KELAS_COLUMNS,
  LOG_PERUBAHAN_COLUMNS,
  MAPEL_COLUMNS,
  PENGATURAN_COLUMNS,
  PENGAJUAN_IZIN_COLUMNS,
  PENUGASAN_COLUMNS,
  SISWA_COLUMNS,
  TAHUN_AJARAN_COLUMNS,
  USERS_COLUMNS,
} from "../src/lib/storage/sheets/columns";
import { PostgresTable } from "../src/lib/storage/postgres/adapter";
import { defaultSchemaName, sanitizeSchemaName } from "../src/lib/storage/postgres/schema";

function arg(name: string): string | undefined {
  const p = `--${name}=`;
  return process.argv.find((a) => a.startsWith(p))?.slice(p.length);
}

function must(name: string, envName = name.toUpperCase()): string {
  const fromArg = arg(name);
  if (fromArg) return fromArg;
  const v = process.env[envName];
  if (!v) {
    console.error(`Butuh --${name}=... atau env ${envName}.`);
    process.exit(1);
  }
  return v;
}

const TABS = [
  { name: "tahun_ajaran", columns: [...TAHUN_AJARAN_COLUMNS], codecs: { aktif: booleanCodec } },
  {
    name: "users",
    columns: [...USERS_COLUMNS],
    codecs: { aktif: booleanCodec, wajib_ganti_password: booleanCodec },
  },
  { name: "kelas", columns: [...KELAS_COLUMNS], codecs: {} },
  { name: "mapel", columns: [...MAPEL_COLUMNS], codecs: {} },
  {
    name: "guru",
    columns: [...GURU_COLUMNS],
    codecs: { is_wali_kelas: booleanCodec, aktif: booleanCodec },
  },
  { name: "siswa", columns: [...SISWA_COLUMNS], codecs: { aktif: booleanCodec } },
  { name: "penugasan", columns: [...PENUGASAN_COLUMNS], codecs: {} },
  { name: "jadwal", columns: [...JADWAL_COLUMNS], codecs: {} },
  { name: "absensi", columns: [...ABSENSI_COLUMNS], codecs: {} },
  { name: "pengajuan_izin", columns: [...PENGAJUAN_IZIN_COLUMNS], codecs: {} },
  { name: "log_perubahan", columns: [...LOG_PERUBAHAN_COLUMNS], codecs: {} },
  { name: "pengaturan", columns: [...PENGATURAN_COLUMNS], codecs: {}, idColumn: "kunci" },
] as const;

function toPgValue(tab: string, col: string, v: unknown): unknown {
  if (tab === "log_perubahan" && (col === "data_lama" || col === "data_baru")) {
    if (typeof v !== "string" || v === "") return {};
    try {
      return JSON.parse(v);
    } catch {
      return {};
    }
  }
  return v;
}

async function main(): Promise<void> {
  const databaseUrl = must("database-url", "DATABASE_URL");
  if (process.env.GOOGLE_PRIVATE_KEY_FILE) {
    process.env.GOOGLE_PRIVATE_KEY = readFileSync(process.env.GOOGLE_PRIVATE_KEY_FILE, "utf8");
  }
  const slug = arg("slug");
  const spreadsheetIdArg = arg("spreadsheet-id");
  if (!slug && !spreadsheetIdArg) {
    console.error("Butuh --slug=... atau --spreadsheet-id=...");
    process.exit(1);
  }
  const schema = sanitizeSchemaName(
    arg("schema") ?? defaultSchemaName(slug ?? spreadsheetIdArg ?? "x")
  );

  // Sumber Sheets.
  let sheets: SheetsValuesClient;
  let spreadsheetId: string;
  let registrySchoolId: string | null = null;
  if (spreadsheetIdArg) {
    sheets = createGoogleSheetsValuesClient(createServiceAccountSheets());
    spreadsheetId = spreadsheetIdArg;
  } else {
    const ctx = await getTenantContext(slug!);
    sheets = ctx.sheets;
    spreadsheetId = ctx.context.spreadsheetId;
    registrySchoolId = ctx.school.school_id;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const ddl = readFileSync(
      path.join(here, "..", "docs", "postgres-schema.sql"),
      "utf8"
    ).replaceAll('"__SCHEMA__"', `"${schema}"`);
    await pool.query(ddl);
    console.log(`Schema "${schema}" siap.`);

    for (const tab of TABS) {
      const rows = await new SheetsTable(sheets, spreadsheetId, tab.name, {
        columns: [...tab.columns],
        codecs: { ...tab.codecs },
        ...(tab.name === "pengaturan" ? { idColumn: "kunci" } : {}),
      }).findAll();
      const pg = new PostgresTable(pool, schema, tab.name, [...tab.columns], {
        ...(tab.name === "pengaturan" ? { idColumn: "kunci" } : {}),
      });
      const mapped = rows.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r)) out[k] = toPgValue(tab.name, k, v);
        return out;
      });
      if (mapped.length > 0) await pg.insertMany(mapped);
      console.log(`- ${tab.name}: ${mapped.length} baris`);
    }

    if (process.argv.includes("--set-adapter") && registrySchoolId) {
      await getServerRegistry().setStorageAdapter(registrySchoolId, "postgres");
      console.log("Registry: storage_adapter=postgres. Pastikan runtime Postgres sudah siap.");
    } else if (process.argv.includes("--set-adapter")) {
      console.log("Catatan: --set-adapter diabaikan (sumber langsung tanpa registry).");
    }
    console.log("Migrasi selesai. Verifikasi jumlah baris sebelum alih trafik.");
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("migrate-sheets-to-postgres.ts")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
