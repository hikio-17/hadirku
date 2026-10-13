import "server-only";

import { nanoid } from "nanoid";

import type { Cache, Locker } from "@/lib/redis";
import type { Repository } from "@/lib/storage/types";

/** Nilai sel mentah dari Sheets API. */
export type CellValue = string | number | boolean | null | undefined;

export interface SheetsValueRange {
  range: string;
  values?: CellValue[][];
}

export interface SheetsBatchUpdateItem {
  range: string;
  values: CellValue[][];
}

/**
 * Client Sheets minimal yang dibutuhkan SheetsTable.
 * Adapter produksi (Tahap 2) memetakan ini ke `googleapis` sheets v4
 * (`values.batchGet` / `values.batchUpdate` / `values.append`).
 * Interface kecil ini membuat unit test tidak menyentuh Google API.
 */
export interface SheetsValuesClient {
  batchGet(spreadsheetId: string, ranges: string[]): Promise<SheetsValueRange[]>;
  batchUpdate(spreadsheetId: string, updates: SheetsBatchUpdateItem[]): Promise<void>;
  append(spreadsheetId: string, range: string, values: CellValue[][]): Promise<void>;
}

/** Codec kolom: Sheets hanya menyimpan string, encode/decode di layer ini. */
export interface ColumnCodec {
  encode(value: unknown): string;
  decode(cell: string): unknown;
}

export const stringCodec: ColumnCodec = {
  encode: (v) => (v === null || v === undefined ? "" : String(v)),
  decode: (s) => s,
};

export const booleanCodec: ColumnCodec = {
  encode: (v) => (v === true || v === "TRUE" || v === "true" ? "TRUE" : "FALSE"),
  decode: (s) => s === "TRUE" || s === "true" || s === "1",
};

export const numberCodec: ColumnCodec = {
  encode: (v) => (v === null || v === undefined || v === "" ? "" : String(v)),
  decode: (s) => (s === "" ? 0 : Number(s)),
};

export interface SheetsTableOptions<T extends Record<string, unknown>> {
  /** Urutan kolom = urutan header yang ditulis. Mapping baca by nama header. */
  columns: (keyof T & string)[];
  /** Nama kolom identitas. Default "id" (`school_id` untuk registry, `kunci` untuk pengaturan). */
  idColumn?: string;
  codecs?: Partial<Record<keyof T & string, ColumnCodec>>;
  cache?: Cache;
  cacheKey?: string;
  /** TTL baca master 30–60 detik. Default 45. */
  cacheTtlSeconds?: number;
  /** Lock tulis per tenant+tab untuk cegah race. Wajib untuk update. */
  locker?: Locker;
  lockKey?: string;
  maxAttempts?: number;
}

interface LoadedRow<T> {
  row: T;
  rowNumber: number; // nomor baris di sheet (header = 1)
}

/** ID unik pakai nanoid, jangan pakai nomor baris. */
export function generateId(): string {
  return nanoid();
}

function colLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Quote nama sheet untuk notasi A1 bila mengandung spasi/karakter khusus. */
export function a1(sheet: string, range: string): string {
  return /[^A-Za-z0-9_]/.test(sheet)
    ? `'${sheet.replace(/'/g, "''")}'!${range}`
    : `${sheet}!${range}`;
}

function statusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.code === "number") return e.code;
  const resp = e.response as Record<string, unknown> | undefined;
  if (resp && typeof resp.status === "number") return resp.status;
  const msg = typeof e.message === "string" ? e.message : "";
  if (/rateLimitExceeded|userRateLimitExceeded|quotaExceeded/i.test(msg)) return 429;
  if (/backendError|internalError/i.test(msg)) return 500;
  return undefined;
}

/** Retryable: 429 / 5xx. Selain itu langsung throw. */
export function isRetryableSheetsError(err: unknown): boolean {
  const s = statusOf(err);
  return s === 429 || (s !== undefined && s >= 500 && s <= 599);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Helper generik Fast & efisien untuk satu tab Sheets:
 * - Mapping kolom by nama header, bukan indeks.
 * - Tulis massal (SATU append untuk insertMany, SATU batchUpdate untuk updateMany).
 * - Cache baca + invalidate per write, lock tulis, retry backoff+jitter.
 */
export class SheetsTable<T extends Record<string, unknown>> implements Repository<T> {
  private readonly idColumn: string;
  private readonly cacheTtl: number;
  private readonly cacheKey: string;
  private readonly maxAttempts: number;

  constructor(
    private readonly client: SheetsValuesClient,
    private readonly spreadsheetId: string,
    private readonly sheet: string,
    private readonly opts: SheetsTableOptions<T>
  ) {
    this.idColumn = opts.idColumn ?? "id";
    this.cacheTtl = opts.cacheTtlSeconds ?? 45;
    this.cacheKey = opts.cacheKey ?? `${spreadsheetId}:${sheet}`;
    this.maxAttempts = opts.maxAttempts ?? 4;
  }

  private codec(col: string): ColumnCodec {
    return this.opts.codecs?.[col as keyof T & string] ?? stringCodec;
  }

  private async withRetry<R>(fn: () => Promise<R>): Promise<R> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt += 1;
        if (!isRetryableSheetsError(err) || attempt >= this.maxAttempts) {
          if (attempt >= this.maxAttempts && isRetryableSheetsError(err)) {
            throw new Error("Server sibuk, coba lagi.", { cause: err });
          }
          throw err;
        }
        const backoff = Math.min(8000, 400 * 2 ** (attempt - 1));
        await sleep(backoff + Math.random() * 250);
      }
    }
  }

  private decodeRows(values: CellValue[][]): LoadedRow<T>[] {
    if (values.length === 0) return [];
    const header = values[0].map((c) => String(c ?? "").trim());
    const colIndex = new Map(header.map((h, i) => [h, i] as const));
    const missing = this.opts.columns.filter((c) => !colIndex.has(c));
    if (!colIndex.has(this.idColumn)) {
      throw new Error(
        `Tab "${this.sheet}" tidak punya kolom identitas "${this.idColumn}". Header: [${header.join(", ")}]`
      );
    }
    if (missing.length > 0) {
      throw new Error(
        `Tab "${this.sheet}" kekurangan kolom: ${missing.join(", ")}. Header: [${header.join(", ")}]`
      );
    }
    const out: LoadedRow<T>[] = [];
    for (let r = 1; r < values.length; r++) {
      const cells = values[r];
      const id = String(cells[colIndex.get(this.idColumn)!] ?? "");
      if (id === "") continue; // baris kosong / terhapus
      const row = {} as Record<string, unknown>;
      for (const col of this.opts.columns) {
        const raw = String(cells[colIndex.get(col)!] ?? "");
        row[col] = this.codec(col).decode(raw);
      }
      out.push({ row: row as T, rowNumber: r + 1 });
    }
    return out;
  }

  private encodeRow(row: T): CellValue[] {
    return this.opts.columns.map((col) => this.codec(col).encode(row[col]));
  }

  private async load(): Promise<LoadedRow<T>[]> {
    if (this.opts.cache) {
      const hit = await this.opts.cache.get<LoadedRow<T>[]>(this.cacheKey);
      if (hit) return hit;
    }
    const ranges = await this.withRetry(() =>
      this.client.batchGet(this.spreadsheetId, [a1(this.sheet, "A1:ZZ")])
    );
    const rows = this.decodeRows(ranges[0]?.values ?? []);
    if (this.opts.cache) {
      await this.opts.cache.set(this.cacheKey, rows, this.cacheTtl);
    }
    return rows;
  }

  private async invalidate(): Promise<void> {
    if (this.opts.cache) await this.opts.cache.del(this.cacheKey);
  }

  private async withWriteLock<R>(fn: () => Promise<R>): Promise<R> {
    if (!this.opts.locker) return fn();
    const key = this.opts.lockKey ?? `lock:${this.spreadsheetId}:${this.sheet}`;
    const release = await this.opts.locker.acquire(key, 15);
    if (!release) throw new Error("Server sibuk, coba lagi.");
    try {
      return await fn();
    } finally {
      await release();
    }
  }

  async findAll(): Promise<T[]> {
    return (await this.load()).map((r) => r.row);
  }

  async findById(id: string): Promise<T | null> {
    const rows = await this.load();
    return rows.find((r) => String(r.row[this.idColumn]) === id)?.row ?? null;
  }

  async findWhere(predicate: (row: T) => boolean): Promise<T[]> {
    return (await this.load()).map((r) => r.row).filter(predicate);
  }

  async insert(row: T): Promise<T> {
    const rows = await this.insertMany([row]);
    return rows[0];
  }

  async insertMany(rows: T[]): Promise<T[]> {
    if (rows.length === 0) return [];
    const withIds = rows.map((row) => {
      const id = String(row[this.idColumn] ?? "");
      if (id !== "") return row;
      return { ...row, [this.idColumn]: generateId() };
    });
    // SATU append call untuk semua baris.
    await this.withRetry(() =>
      this.client.append(
        this.spreadsheetId,
        a1(this.sheet, "A1"),
        withIds.map((r) => this.encodeRow(r as T))
      )
    );
    await this.invalidate();
    return withIds as T[];
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const n = await this.updateMany([id], patch);
    if (n === 0) return null;
    return this.findById(id);
  }

  async updateMany(ids: string[], patch: Partial<T>): Promise<number> {
    if (ids.length === 0) return 0;
    const wanted = new Set(ids);
    return this.withWriteLock(async () => {
      const rows = await this.load();
      const updates: SheetsBatchUpdateItem[] = [];
      let count = 0;
      const lastCol = colLetter(this.opts.columns.length - 1);
      for (const loaded of rows) {
        const rowId = String(loaded.row[this.idColumn]);
        if (!wanted.has(rowId)) continue;
        const merged = { ...loaded.row, ...patch, [this.idColumn]: rowId };
        loaded.row = merged as T;
        updates.push({
          range: a1(this.sheet, `A${loaded.rowNumber}:${lastCol}${loaded.rowNumber}`),
          values: [this.encodeRow(merged as T)],
        });
        count += 1;
      }
      if (updates.length > 0) {
        // SATU batchUpdate untuk semua baris.
        await this.withRetry(() => this.client.batchUpdate(this.spreadsheetId, updates));
        await this.invalidate();
      }
      return count;
    });
  }

  /**
   * Tulis banyak baris (patch berbeda per baris) dalam SATU batchUpdate.
   * Baris tanpa id atau yang tidak ada di sheet dilewati.
   * Dipakai simpan absensi satu kelas agar hemat request Google.
   */
  async bulkUpdate(rows: T[]): Promise<number> {
    if (rows.length === 0) return 0;
    return this.withWriteLock(async () => {
      const loaded = await this.load();
      const byId = new Map(loaded.map((l) => [String(l.row[this.idColumn]), l]));
      const updates: SheetsBatchUpdateItem[] = [];
      const lastCol = colLetter(this.opts.columns.length - 1);
      let count = 0;
      for (const row of rows) {
        const id = String(row[this.idColumn] ?? "");
        const target = id === "" ? undefined : byId.get(id);
        if (!target) continue;
        target.row = row;
        updates.push({
          range: a1(this.sheet, `A${target.rowNumber}:${lastCol}${target.rowNumber}`),
          values: [this.encodeRow(row)],
        });
        count += 1;
      }
      if (updates.length > 0) {
        await this.withRetry(() => this.client.batchUpdate(this.spreadsheetId, updates));
        await this.invalidate();
      }
      return count;
    });
  }

  async softDelete(id: string): Promise<void> {
    const hasAktif = (this.opts.columns as string[]).includes("aktif");
    if (hasAktif) {
      await this.update(id, { aktif: false } as unknown as Partial<T>);
      return;
    }
    // Tabel tanpa kolom aktif (mis. pengaturan): kosongkan barisnya.
    await this.withWriteLock(async () => {
      const rows = await this.load();
      const target = rows.find((r) => String(r.row[this.idColumn]) === id);
      if (!target) return;
      const lastCol = colLetter(this.opts.columns.length - 1);
      await this.withRetry(() =>
        this.client.batchUpdate(this.spreadsheetId, [
          {
            range: a1(this.sheet, `A${target.rowNumber}:${lastCol}${target.rowNumber}`),
            values: [this.opts.columns.map(() => "")],
          },
        ])
      );
      await this.invalidate();
    });
  }
}
