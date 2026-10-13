import { requireAdmin } from "@/lib/admin-guard";
import { Card, CardTitle, Field, Notice, PageHeader, inputCls } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { getPengaturan } from "@/lib/services/master";
import { PENGATURAN_KNOWN } from "@/lib/validations/admin";
import { saveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PengaturanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { ok = "", error = "" } = await searchParams;

  let values: Record<string, string> = {};
  let loadError = "";
  try {
    const { ctx } = await requireAdmin();
    values = await getPengaturan(ctx.sheets, ctx.context.spreadsheetId);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  return (
    <div>
      <PageHeader
        title="Pengaturan sekolah"
        subtitle="Dipakai di kop laporan, dashboard, dan ambang peringatan."
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
        <CardTitle>Profil & preferensi</CardTitle>
        <form action={saveAction} className="grid gap-3 sm:grid-cols-2">
          {PENGATURAN_KNOWN.map(({ kunci, label, type }) => (
            <Field key={kunci} label={label}>
              <input
                name={kunci}
                type={type === "number" ? "number" : type === "url" ? "url" : "text"}
                min={type === "number" ? 0 : undefined}
                max={type === "number" ? 100 : undefined}
                defaultValue={values[kunci] ?? ""}
                className={inputCls}
              />
            </Field>
          ))}
          <div className="sm:col-span-2">
            <SubmitButton>Simpan pengaturan</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
