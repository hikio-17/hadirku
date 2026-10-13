import { requireAdmin } from "@/lib/admin-guard";
import type { JadwalView } from "@/lib/services/akademik";
import { HARI } from "@/lib/validations/admin";
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
import { listJadwal, listPenugasan } from "@/lib/services/akademik";
import type { PenugasanView } from "@/lib/services/akademik";
import { deleteAction, saveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function JadwalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { ok = "", error = "" } = await searchParams;

  let rows: JadwalView[] = [];
  let tugas: PenugasanView[] = [];
  let loadError = "";
  try {
    const { ctx } = await requireAdmin();
    [rows, tugas] = await Promise.all([
      listJadwal(ctx.sheets, ctx.context.spreadsheetId),
      listPenugasan(ctx.sheets, ctx.context.spreadsheetId),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  return (
    <div>
      <PageHeader
        title="Jadwal pelajaran"
        subtitle="Jam mengajar per penugasan per hari."
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
        <CardTitle>Tambah jadwal</CardTitle>
        {tugas.length === 0 ? (
          <p className="text-sm text-zinc-500">Buat penugasan dulu sebelum menambah jadwal.</p>
        ) : (
          <form action={saveAction} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Penugasan">
                <select name="penugasan_id" required className={selectCls} defaultValue="">
                  <option value="" disabled>
                    Pilih penugasan…
                  </option>
                  {tugas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.guru_nama} · {t.kelas_nama} · {t.mapel_nama}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Hari">
              <select name="hari" className={selectCls} defaultValue="Senin">
                {HARI.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mulai">
                <input name="jam_mulai" type="time" required className={inputCls} />
              </Field>
              <Field label="Selesai">
                <input name="jam_selesai" type="time" required className={inputCls} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Simpan jadwal</SubmitButton>
            </div>
          </form>
        )}
      </Card>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Penugasan</th>
              <th className="px-4 py-3">Hari</th>
              <th className="px-4 py-3">Jam</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium">{j.label_penugasan}</td>
                <td className="px-4 py-3">{j.hari}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {j.jam_mulai}–{j.jam_selesai}
                </td>
                <td className="px-4 py-3">
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={j.id} />
                    <ConfirmButton message="Hapus jadwal ini?" danger>
                      Hapus
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">
                  Belum ada jadwal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
