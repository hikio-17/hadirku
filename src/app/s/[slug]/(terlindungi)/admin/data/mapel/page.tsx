import { requireAdmin } from "@/lib/admin-guard";
import type { MapelRow } from "@/lib/storage/types";
import {
  Card,
  CardTitle,
  Field,
  Notice,
  PageHeader,
  SearchBar,
  filterByQuery,
  inputCls,
} from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/ui-client";
import { listMapel } from "@/lib/services/master";
import { deleteAction, saveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MapelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { q = "", ok = "", error = "" } = await searchParams;

  let rows: MapelRow[] = [];
  let loadError = "";
  try {
    const { ctx } = await requireAdmin();
    rows = await listMapel(ctx.sheets, ctx.context.spreadsheetId);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }
  const items = filterByQuery(rows, q, (m) => [m.nama, m.kode]);

  return (
    <div>
      <PageHeader title="Data mapel" backHref={`/s/${slug}/admin/data`} />
      <Notice ok={ok} error={error} />
      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {loadError}
        </div>
      )}
      <Card>
        <CardTitle>Tambah mapel</CardTitle>
        <form action={saveAction} className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Nama mapel">
              <input
                name="nama"
                required
                maxLength={120}
                placeholder="cth: Matematika"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Kode">
            <input name="kode" maxLength={16} placeholder="cth: MTK" className={inputCls} />
          </Field>
          <div className="sm:col-span-3">
            <SubmitButton>Simpan mapel</SubmitButton>
          </div>
        </form>
      </Card>
      <SearchBar q={q} placeholder="Cari mapel…" />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium">{m.nama}</td>
                <td className="px-4 py-3">{m.kode || "-"}</td>
                <td className="px-4 py-3">
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <ConfirmButton message={`Hapus mapel ${m.nama}?`} danger>
                      Hapus
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500">
                  Belum ada mapel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
