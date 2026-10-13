import "server-only";

import type { Cache, Locker } from "@/lib/redis";
import { tenantKey } from "@/lib/redis";
import { SheetsTable, type SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import type { SchoolRow } from "@/lib/storage/types";
import { registerSchoolSchema, schoolRowSchema } from "@/lib/validations/registry";
import type { StatusSekolah } from "@/types";

export const SCHOOLS_SHEET = "schools";

export const SCHOOL_COLUMNS = [
  "school_id",
  "slug",
  "nama_sekolah",
  "owner_email",
  "sheet_id",
  "refresh_token_enc",
  "status",
  "storage_adapter",
  "dibuat_pada",
  "terakhir_aktif",
] as const;

/** TTL cache registry 10 menit sesuai spek (registry hanya dibaca saat cache kosong). */
export const REGISTRY_CACHE_TTL_SECONDS = 600;

export interface RegisterSchoolInput {
  slug: string;
  nama_sekolah: string;
  owner_email: string;
  sheet_id: string;
  refresh_token_enc: string;
}

/**
 * Akses tab `schools` di spreadsheet REGISTRY via Service Account.
 * Refresh token tidak pernah dikirim ke client — repo ini server-only.
 */
export class RegistryRepo {
  private readonly table: SheetsTable<SchoolRow>;

  constructor(
    client: SheetsValuesClient,
    registrySpreadsheetId: string,
    opts?: { cache?: Cache; locker?: Locker }
  ) {
    const cacheKey = `platform:registry:${SCHOOLS_SHEET}`;
    this.table = new SheetsTable<SchoolRow>(client, registrySpreadsheetId, SCHOOLS_SHEET, {
      columns: [...SCHOOL_COLUMNS],
      idColumn: "school_id",
      cache: opts?.cache,
      cacheKey,
      cacheTtlSeconds: REGISTRY_CACHE_TTL_SECONDS,
      locker: opts?.locker,
      lockKey: `lock:platform:registry:${SCHOOLS_SHEET}`,
    });
  }

  private parse(row: SchoolRow): SchoolRow {
    return schoolRowSchema.parse(row);
  }

  async findBySlug(slug: string): Promise<SchoolRow | null> {
    const normalized = slug.trim().toLowerCase();
    const rows = await this.table.findWhere((r) => r.slug === normalized);
    return rows.length > 0 ? this.parse(rows[0]) : null;
  }

  async findById(schoolId: string): Promise<SchoolRow | null> {
    const row = await this.table.findById(schoolId);
    return row ? this.parse(row) : null;
  }

  async findAll(): Promise<SchoolRow[]> {
    return (await this.table.findAll()).map((r) => this.parse(r));
  }

  /**
   * Tulis baris baru (append, bukan tulis ulang tab).
   * Gagal bila slug sudah dipakai sekolah lain.
   */
  async registerSchool(input: RegisterSchoolInput): Promise<SchoolRow> {
    const data = registerSchoolSchema.parse(input);
    const existing = await this.findBySlug(data.slug);
    if (existing) {
      throw new Error(`Slug "${data.slug}" sudah dipakai sekolah lain.`);
    }
    const now = new Date().toISOString();
    const [row] = await this.table.insertMany([
      {
        school_id: "",
        slug: data.slug,
        nama_sekolah: data.nama_sekolah,
        owner_email: data.owner_email,
        sheet_id: data.sheet_id,
        refresh_token_enc: data.refresh_token_enc,
        status: "aktif",
        storage_adapter: "sheets",
        dibuat_pada: now,
        terakhir_aktif: now,
      },
    ]);
    return this.parse(row);
  }

  async setStatus(schoolId: string, status: StatusSekolah): Promise<SchoolRow | null> {
    return this.table.update(schoolId, { status });
  }

  /** Dipakai saat refresh gagal invalid_grant: tampilkan banner hubungkan ulang. */
  async markNeedsReconnect(schoolId: string): Promise<void> {
    await this.table.update(schoolId, { status: "perlu_hubungkan_ulang" });
  }

  /**
   * "Putuskan koneksi & hapus token saya": hapus token dari registry.
   * Revoke ke Google dilakukan sebelum memanggil ini (Tahap 8).
   */
  async clearToken(schoolId: string): Promise<void> {
    await this.table.update(schoolId, { refresh_token_enc: "", status: "nonaktif" });
  }

  /** Catat aktivitas terakhir. Dipanggil terpisah dari read agar cache tetap hemat. */
  async touchLastActive(schoolId: string): Promise<void> {
    await this.table.update(schoolId, { terakhir_aktif: new Date().toISOString() });
  }

  /** Key cache registry untuk satu sekolah (prefix school_id). */
  static cacheKeyFor(schoolId: string): string {
    return tenantKey(schoolId, "registry");
  }
}
