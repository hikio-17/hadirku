import { requireAdmin } from "@/lib/admin-guard";
import type { PenugasanView } from "@/lib/services/akademik";
import type { GuruRow, KelasRow, MapelRow, TahunAjaranRow } from "@/lib/storage/types";
import {
  Card,
  CardTitle,
  Field,
  Notice,
  PageHeader,
  SearchBar,
  filterByQuery,
  selectCls,
} from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/ui-client";
import { listGuru, listPenugasan } from "@/lib/services/akademik";
import { listKelas, listMapel, listTahunAjaran } from "@/lib/services/master";
import { deleteAction, saveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PenugasanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { q = "", ok = "", error = "" } = await searchParams;

  let rows: PenugasanView[] = [];
  let guru: GuruRow[] = [];
  let kelas: KelasRow[] = [];
  let mapel: MapelRow[] = [];
  let tas: TahunAjaranRow[] = [];
  let loadError = "";
  try {
    const { ctx } = await requireAdmin();
    const sid = ctx.context.spreadsheetId;
    [rows, guru, kelas, mapel, tas] = await Promise.all([
      listPenugasan(ctx.sheets, sid),
      listGuru(ctx.sheets, sid),
      listKelas(ctx.sheets, sid),
      listMapel(ctx.sheets, sid),
      listTahunAjaran(ctx.sheets, sid),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }
  const taAktif = tas.find((t) => t.aktif);
  const items = filterByQuery(rows, q, (p) => [p.guru_nama, p.kelas_nama, p.mapel_nama]);
  const siap = guru.length > 0 && kelas.length > 0 && mapel.length > 0 && tas.length > 0;

  return (
    <div>
      <PageHeader
        title="Penugasan guru"
        subtitle="Siapa mengajar mapel apa di kelas mana. Guru hanya bisa absen di kelas penugasannya."
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
        <CardTitle>Tambah penugasan</CardTitle>
        {!siap ? (
          <p className="text-sm text-zinc-500">
            Lengkapi dulu data guru, kelas, mapel, dan tahun ajaran sebelum membuat penugasan.
          </p>
        ) : (
          <form action={saveAction} className="grid gap-3 sm:grid-cols-2">
            <Field label="Guru">
              <select name="guru_id" required className={selectCls} defaultValue="">
                <option value="" disabled>
                  Pilih guru…
                </option>
                {guru.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nama}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Kelas">
              <select name="kelas_id" required className={selectCls} defaultValue="">
                <option value="" disabled>
                  Pilih kelas…
                </option>
                {kelas.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mapel">
              <select name="mapel_id" required className={selectCls} defaultValue="">
                <option value="" disabled>
                  Pilih mapel…
                </option>
                {mapel.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama}
                  </option>
                ))}
              </select>
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
                    {t.aktif ? " (aktif)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Simpan penugasan</SubmitButton>
            </div>
          </form>
        )}
      </Card>
      <SearchBar q={q} placeholder="Cari guru / kelas / mapel…" />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Guru</th>
              <th className="px-4 py-3">Kelas</th>
              <th className="px-4 py-3">Mapel</th>
              <th className="px-4 py-3">Tahun</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium">{p.guru_nama}</td>
                <td className="px-4 py-3">{p.kelas_nama}</td>
                <td className="px-4 py-3">{p.mapel_nama}</td>
                <td className="px-4 py-3">{p.ta_nama}</td>
                <td className="px-4 py-3">
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton message="Hapus penugasan ini?" danger>
                      Hapus
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                  Belum ada penugasan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
