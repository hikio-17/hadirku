import "server-only";

import type { Repository } from "@/lib/storage/types";

/** Pool minimal (kompatibel node-postgres Pool; mudah di-mock di test). */
export interface PgPoolLike {
  query(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}

export interface PostgresTableOptions {
  /** Kolom identitas. Default "id". */
  idColumn?: string;
}

/**
 * Adapter PostgreSQL generik: implementasi Repository<T> yang sama dengan
 * SheetsTable, sehingga migrasi sekolah = ganti adapter tanpa ubah service.
 * Nama tabel/kolom SAMA dengan tab Sheets (lihat docs/postgres-schema.sql).
 * Semua nilai di-parameterisasi ($1, $2, …) — anti SQL injection.
 *
 * Catatan: findWhere difilter di memori (seperti cache Sheets); untuk skala
 * besar gunakan query berindeks langsung via pool.
 */
export class PostgresTable<T extends Record<string, unknown>> implements Repository<T> {
  private readonly idColumn: string;

  constructor(
    private readonly pool: PgPoolLike,
    private readonly schema: string,
    private readonly table: string,
    private readonly columns: (keyof T & string)[],
    private readonly opts: PostgresTableOptions = {}
  ) {
    this.idColumn = opts.idColumn ?? "id";
  }

  private get target(): string {
    return `${quoteIdent(this.schema)}.${quoteIdent(this.table)}`;
  }

  private get selectCols(): string {
    return this.columns.map((c) => quoteIdent(c)).join(", ");
  }

  private decode(row: Record<string, unknown>): T {
    const out: Record<string, unknown> = {};
    for (const col of this.columns) {
      const v = row[col];
      out[col] = v instanceof Date ? v.toISOString() : v;
    }
    return out as T;
  }

  async findAll(): Promise<T[]> {
    const res = await this.pool.query(`SELECT ${this.selectCols} FROM ${this.target}`);
    return res.rows.map((r) => this.decode(r));
  }

  async findById(id: string): Promise<T | null> {
    const res = await this.pool.query(
      `SELECT ${this.selectCols} FROM ${this.target} WHERE ${quoteIdent(this.idColumn)} = $1`,
      [id]
    );
    return res.rows.length > 0 ? this.decode(res.rows[0]) : null;
  }

  async findWhere(predicate: (row: T) => boolean): Promise<T[]> {
    return (await this.findAll()).filter(predicate);
  }

  async insert(row: T): Promise<T> {
    const rows = await this.insertMany([row]);
    return rows[0];
  }

  async insertMany(rows: T[]): Promise<T[]> {
    if (rows.length === 0) return [];
    const cols = this.columns;
    const values: unknown[] = [];
    const tuples = rows.map((row, i) => {
      const ph = cols.map((c, j) => {
        values.push(encodeValue(row[c]));
        return `$${i * cols.length + j + 1}`;
      });
      return `(${ph.join(", ")})`;
    });
    const res = await this.pool.query(
      `INSERT INTO ${this.target} (${cols.map((c) => quoteIdent(c)).join(", ")}) VALUES ${tuples.join(", ")} RETURNING ${this.selectCols}`,
      values
    );
    return res.rows.map((r) => this.decode(r));
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const entries = Object.entries(patch).filter(([k]) => (this.columns as string[]).includes(k));
    if (entries.length === 0) return this.findById(id);
    const sets = entries.map(([k], i) => `${quoteIdent(k)} = $${i + 1}`);
    const res = await this.pool.query(
      `UPDATE ${this.target} SET ${sets.join(", ")} WHERE ${quoteIdent(this.idColumn)} = $${entries.length + 1} RETURNING ${this.selectCols}`,
      [...entries.map(([, v]) => encodeValue(v)), id]
    );
    return res.rows.length > 0 ? this.decode(res.rows[0]) : null;
  }

  async updateMany(ids: string[], patch: Partial<T>): Promise<number> {
    if (ids.length === 0) return 0;
    let n = 0;
    for (const id of ids) {
      if (await this.update(id, patch)) n += 1;
    }
    return n;
  }

  async softDelete(id: string): Promise<void> {
    if ((this.columns as string[]).includes("aktif")) {
      await this.update(id, { aktif: false } as unknown as Partial<T>);
      return;
    }
    await this.pool.query(`DELETE FROM ${this.target} WHERE ${quoteIdent(this.idColumn)} = $1`, [
      id,
    ]);
  }
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Nama identifier tidak valid: ${name}`);
  }
  return `"${name}"`;
}

function encodeValue(v: unknown): unknown {
  return v === undefined ? null : v;
}
