import Link from "next/link";

import { Card, CardTitle, Field, Notice, PageHeader, selectCls } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/ui-client";
import { confirmAction, uploadAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ImporPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    ok?: string;
    error?: string;
    batch?: string;
    parsed?: string;
    perhatian?: string;
    jenis?: string;
  }>;
}) {
  const { slug } = await params;
  const { ok = "", error = "", batch = "", parsed = "", perhatian = "" } = await searchParams;
  const base = `/s/${slug}/admin/data/impor`;

  return (
    <div>
      <PageHeader
        title="Impor guru & siswa"
        subtitle="Unggah Excel (.xlsx, maks 5 MB) → pratinjau → konfirmasi. Akun baru wajib ganti password."
        backHref={`/s/${slug}/admin/data`}
      />
      <Notice ok={ok} error={error} />

      <Card>
        <CardTitle>1. Unduh template</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/api/admin/template/guru?slug=${slug}`}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium"
          >
            Template guru (.xlsx)
          </Link>
          <Link
            href={`/api/admin/template/siswa?slug=${slug}`}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium"
          >
            Template siswa (.xlsx)
          </Link>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Kolom siswa: nama, nis, username, password, kelas (nama persis), jenis_kelamin (L/P).
          Kolom guru: nama, nip, username, password.
        </p>
      </Card>

      <Card>
        <CardTitle>2. Unggah file</CardTitle>
        <form action={uploadAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Jenis data">
            <select name="jenis" className={selectCls} defaultValue="siswa">
              <option value="siswa">Siswa</option>
              <option value="guru">Guru</option>
            </select>
          </Field>
          <Field label="File .xlsx">
            <input
              name="file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="text-sm"
            />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Pratinjau</SubmitButton>
          </div>
        </form>
      </Card>

      {batch && (
        <Card>
          <CardTitle>3. Konfirmasi impor</CardTitle>
          <p className="text-sm text-zinc-600">
            {parsed} baris valid siap diimpor sebagai akun + profil.
          </p>
          {perhatian && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {perhatian}
            </p>
          )}
          <form action={confirmAction} className="mt-3">
            <input type="hidden" name="batch" value={batch} />
            <SubmitButton>Jalankan impor</SubmitButton>
          </form>
          <Link href={base} className="mt-3 inline-block text-xs text-zinc-500 underline">
            Batalkan
          </Link>
        </Card>
      )}
    </div>
  );
}
