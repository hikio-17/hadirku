import { requireAdmin } from "@/lib/admin-guard";
import type { TahunAjaranRow } from "@/lib/storage/types";
import {
  Card,
  CardTitle,
  Field,
  Notice,
  PageHeader,
  inputCls,
  selectCls,
} from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/ui-client";
import { listTahunAjaran } from "@/lib/services/master";
import { deleteAction, saveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TahunAjaranPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { ok = "", error = "" } = await searchParams;

  let rows: TahunAjaranRow[] = [];
  let loadError = "";
  try {
    const { ctx } = await requireAdmin();
    rows = await listTahunAjaran(ctx.sheets, ctx.context.spreadsheetId);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  return (
    <div>
      <PageHeader
        title="Tahun ajaran"
        subtitle="Hanya satu tahun ajaran yang aktif."
        backHref={`/s/${slug}/admin/data`}
      />
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
        <CardTitle>Tambah tahun ajaran</CardTitle>
        <form action={saveAction} className="grid gap-3 sm:grid-cols-3">
          <Field label="Nama">
            <input
              name="nama"
              required
              maxLength={32}
              placeholder="cth: 2026/2027"
              className={inputCls}
            />
          </Field>
          <Field label="Semester">
            <select name="semester" className={selectCls} defaultValue="Ganjil">
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-3 text-sm">
            <input type="checkbox" name="aktif" />
            Jadikan aktif
          </label>
          <div className="sm:col-span-3">
            <SubmitButton>Simpan</SubmitButton>
          </div>
        </form>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Semester</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium">{t.nama}</td>
                <td className="px-4 py-3">{t.semester}</td>
                <td className="px-4 py-3">{t.aktif ? "Aktif" : "-"}</td>
                <td className="px-4 py-3">
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <ConfirmButton message={`Hapus ${t.nama}?`} danger>
                      Hapus
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">
                  Belum ada tahun ajaran.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
