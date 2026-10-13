import Link from "next/link";

export const inputCls =
  "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950";

export const selectCls = inputCls;

export function PageHeader({
  title,
  subtitle,
  backHref,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
}) {
  return (
    <div className="mb-5">
      {backHref && (
        <Link href={backHref} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
          ← Kembali
        </Link>
      )}
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
    </div>
  );
}

export function Notice({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-800"
      }`}
    >
      {error ?? ok}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-1 block">{children}</span>
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function SearchBar({ q, placeholder }: { q: string; placeholder: string }) {
  return (
    <form method="get" className="mb-4 flex gap-2">
      <input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
      />
      <button
        type="submit"
        className="h-10 shrink-0 rounded-lg bg-zinc-950 px-4 text-sm font-medium text-white"
      >
        Cari
      </button>
    </form>
  );
}

export function filterByQuery<T>(rows: T[], q: string, pick: (row: T) => string[]): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) => pick(r).some((v) => v.toLowerCase().includes(s)));
}

export function paginate<T>(rows: T[], page: number, perPage = 20) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pages);
  return { items: rows.slice((current - 1) * perPage, current * perPage), total, pages, current };
}

export function Pager({
  base,
  page,
  pages,
  q,
}: {
  base: string;
  page: number;
  pages: number;
  q: string;
}) {
  if (pages <= 1) return null;
  const href = (p: number) => `${base}?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-lg border border-zinc-300 px-3 py-1.5">
          ← Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span className="text-zinc-500">
        Halaman {page} dari {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="rounded-lg border border-zinc-300 px-3 py-1.5">
          Berikutnya →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-xl border border-zinc-200 bg-white p-5">{children}</section>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold">{children}</h2>;
}
