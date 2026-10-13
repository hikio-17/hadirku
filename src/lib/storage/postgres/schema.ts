/** Nama schema Postgres per sekolah: huruf kecil, angka, garis bawah. */
export function sanitizeSchemaName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!s) throw new Error("Nama schema tidak valid.");
  return s;
}

/** Default: school_<slug>. */
export function defaultSchemaName(slug: string): string {
  return `school_${sanitizeSchemaName(slug)}`;
}
