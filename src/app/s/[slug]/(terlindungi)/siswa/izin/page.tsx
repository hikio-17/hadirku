import { requireSiswa } from "@/lib/admin-guard";
import type { IzinSaya } from "@/lib/services/siswa";
import { listIzinSaya } from "@/lib/services/siswa";
import { todayWIB } from "@/lib/services/guru";
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
import { ajukanAction, batalkanAction } from "./actions";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  menunggu: "bg-amber-100 text-amber-800",
  disetujui: "bg-green-100 text-green-800",
  ditolak: "bg-red-100 text-red-800",
};

export default async function IzinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { ok = "", error = "" } = await searchParams;

  let rows: IzinSaya[] = [];
  let loadError = "";
  try {
    const s = await requireSiswa();
    rows = await listIzinSaya(s.ctx.sheets, s.ctx.context.spreadsheetId, s.siswa.id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }
  return (
    <div>
      <PageHeader
        title="Izin & sakit"
        subtitle="Pengajuan diteruskan ke wali kelas. Bukti (jpg/png/pdf, maks 2 MB) opsional."
        backHref={`/s/${slug}/siswa`}
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
        <CardTitle>Form pengajuan</CardTitle>
        <form action={ajukanAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal">
            <input
              name="tanggal"
              type="date"
              required
              defaultValue={todayWIB()}
              className={inputCls}
            />
          </Field>
          <Field label="Jenis">
            <select name="jenis" className={selectCls} defaultValue="izin">
              <option value="izin">Izin</option>
              <option value="sakit">Sakit</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Alasan (min. 10 karakter)">
              <textarea
                name="alasan"
                required
                minLength={10}
                maxLength={500}
                rows={3}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-950"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Bukti (opsional)"
              hint="JPG/PNG/PDF, maks 2 MB. Tersimpan di Drive sekolah."
            >
              <input name="bukti" type="file" accept=".jpg,.jpeg,.png,.pdf" className="text-sm" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Kirim pengajuan</SubmitButton>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Pengajuan saya</CardTitle>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">Belum ada pengajuan.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium capitalize">
                    {r.jenis} · <span className="font-mono text-xs">{r.tanggal}</span>
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>
                <p className="mt-1 text-sm">{r.alasan}</p>
                {r.url_bukti && (
                  <a
                    href={r.url_bukti}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs font-medium underline"
                  >
                    Lihat bukti
                  </a>
                )}
                {r.bisaBatal && (
                  <form action={batalkanAction} className="mt-2">
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmButton message="Batalkan pengajuan ini?">Batalkan</ConfirmButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
