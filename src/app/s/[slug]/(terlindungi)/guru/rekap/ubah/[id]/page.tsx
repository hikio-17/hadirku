import { notFound } from "next/navigation";

import { requireGuru } from "@/lib/admin-guard";
import { getAbsensiDenganLog } from "@/lib/services/guru";
import { Card, CardTitle, Field, Notice, PageHeader, inputCls } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { editAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS = [
  { v: "H", label: "Hadir" },
  { v: "I", label: "Izin" },
  { v: "S", label: "Sakit" },
  { v: "A", label: "Alpha" },
];

export default async function UbahAbsensiPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug, id } = await params;
  const { ok = "", error = "" } = await searchParams;

  let data: Awaited<ReturnType<typeof getAbsensiDenganLog>> | null = null;
  try {
    const g = await requireGuru();
    data = await getAbsensiDenganLog(g.ctx.sheets, g.ctx.context.spreadsheetId, g.guru.id, id);
  } catch {
    notFound();
  }

  return (
    <div>
      <PageHeader
        title="Ubah absensi"
        subtitle={`${data.row.siswa_nama} · ${data.row.kelas_nama} · ${data.row.mapel_nama} · ${data.row.tanggal}`}
        backHref={`/s/${slug}/guru/rekap`}
      />
      <Notice ok={ok} error={error} />
      <Card>
        <CardTitle>Status kehadiran</CardTitle>
        <form action={editAction} className="space-y-3">
          <input type="hidden" name="id" value={data.row.id} />
          <div className="grid grid-cols-4 gap-2">
            {STATUS.map((s) => (
              <label
                key={s.v}
                className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold ${
                  data.row.status === s.v
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-300"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={s.v}
                  defaultChecked={data.row.status === s.v}
                  className="sr-only"
                />
                {s.v}
              </label>
            ))}
          </div>
          <p className="text-xs text-zinc-500">H Hadir · I Izin · S Sakit · A Alpha</p>
          <Field label="Catatan">
            <input
              name="catatan"
              defaultValue={data.row.catatan}
              maxLength={280}
              className={inputCls}
            />
          </Field>
          <SubmitButton>Simpan perubahan</SubmitButton>
        </form>
      </Card>
      <Card>
        <CardTitle>Riwayat perubahan</CardTitle>
        {data.logs.length === 0 ? (
          <p className="text-sm text-zinc-500">Belum pernah diubah.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.logs.map((l) => (
              <li key={l.id} className="rounded-lg bg-zinc-50 p-3">
                <p className="font-mono text-xs text-zinc-500">{String(l["waktu"])}</p>
                <p className="mt-1 font-mono text-xs">lama: {String(l["data_lama"])}</p>
                <p className="font-mono text-xs">baru: {String(l["data_baru"])}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
