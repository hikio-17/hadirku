import { requireAdmin } from "@/lib/admin-guard";
import type { KelasRow, TahunAjaranRow } from "@/lib/storage/types";
import {
  Card,
  CardTitle,
  Field,
  Notice,
  PageHeader,
  SearchBar,
  filterByQuery,
  inputCls,
  selectCls,
} from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/ui-client";
import { listKelas, listTahunAjaran } from "@/lib/services/master";
import { deleteAction, saveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function KelasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { q = "", ok = "", error = "" } = await searchParams;

  let rows: KelasRow[] = [];
  let tas: TahunAjaranRow[] = [];
  let loadError = "";
  try {
    const { ctx } = await requireAdmin();
    [rows, tas] = await Promise.all([
      listKelas(ctx.sheets, ctx.context.spreadsheetId),
      listTahunAjaran(ctx.sheets, ctx.context.spreadsheetId),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }
  const taAktif = tas.find((t) => t.aktif);
  const items = filterByQuery(rows, q, (k) => [k.nama, k.tingkat]);

  return (
    <div>
      <PageHeader title="Data kelas" backHref={`/s/${slug}/admin/data`} />
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
        <CardTitle>Tambah kelas</CardTitle>
        {tas.length === 0 ? (
          <p className="text-sm text-zinc-500">Buat tahun ajaran dulu sebelum menambah kelas.</p>
        ) : (
          <form action={saveAction} className="grid gap-3 sm:grid-cols-3">
            <Field label="Nama kelas">
              <input
                name="nama"
                required
                maxLength={64}
                placeholder="cth: VII-A"
                className={inputCls}
              />
            </Field>
            <Field label="Tingkat">
              <input name="tingkat" maxLength={32} placeholder="cth: 7" className={inputCls} />
            </Field>
            <Field label="Tahun ajaran">
              <select
                name="tahun_ajaran_id"
                required
                className={selectCls}
                defaultValue={taAktif?.id ?? ""}
              >
                {tas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nama} · {t.semester}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-3">
              <SubmitButton>Simpan kelas</SubmitButton>
            </div>
          </form>
        )}
      </Card>
      <SearchBar q={q} placeholder="Cari kelas…" />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Tingkat</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((k) => (
              <tr key={k.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium">{k.nama}</td>
                <td className="px-4 py-3">{k.tingkat || "-"}</td>
                <td className="px-4 py-3">
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={k.id} />
                    <ConfirmButton message={`Hapus kelas ${k.nama}?`} danger>
                      Hapus
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500">
                  Belum ada kelas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
