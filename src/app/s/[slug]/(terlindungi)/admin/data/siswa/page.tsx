import Link from "next/link";

import { requireAdmin } from "@/lib/admin-guard";
import { NeedsReconnectError } from "@/lib/google/oauth";
import type { KelasRow, UserRow } from "@/lib/storage/types";
import type { SiswaView } from "@/lib/services/akademik";
import {
  Card,
  CardTitle,
  Field,
  Notice,
  Pager,
  PageHeader,
  SearchBar,
  filterByQuery,
  inputCls,
  paginate,
  selectCls,
} from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/ui-client";
import { listSiswa, listSiswaTersedia } from "@/lib/services/akademik";
import { listKelas } from "@/lib/services/master";
import { deleteAction, saveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SiswaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string; ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { q = "", page = "1", ok = "", error = "" } = await searchParams;
  const base = `/s/${slug}/admin/data/siswa`;

  let rows: SiswaView[] = [];
  let tersedia: UserRow[] = [];
  let kelas: KelasRow[] = [];
  let loadError = "";
  let reconnect = false;
  try {
    const { ctx } = await requireAdmin();
    const sid = ctx.context.spreadsheetId;
    [rows, tersedia, kelas] = await Promise.all([
      listSiswa(ctx.sheets, sid),
      listSiswaTersedia(ctx.sheets, sid),
      listKelas(ctx.sheets, sid),
    ]);
  } catch (err) {
    reconnect = err instanceof NeedsReconnectError;
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  const { items, pages, current } = paginate(
    filterByQuery(rows, q, (s) => [s.nama, s.nis, s.username, s.kelas_nama]),
    Number(page) || 1
  );

  return (
    <div>
      <PageHeader
        title="Data siswa"
        subtitle="Profil siswa terhubung ke akun login dan kelas."
        backHref={`/s/${slug}/admin/data`}
      />
      <Notice ok={ok} error={error} />
      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {loadError}{" "}
          {reconnect && (
            <Link
              href={`/api/auth/google/reconnect?slug=${slug}`}
              className="font-medium underline"
            >
              Hubungkan ulang Google
            </Link>
          )}
        </div>
      )}

      <Card>
        <CardTitle>Tambah profil siswa</CardTitle>
        {tersedia.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Tidak ada akun siswa yang belum punya profil.{" "}
            <Link href={`/s/${slug}/admin/data/pengguna`} className="font-medium underline">
              Buat akun dulu di Pengguna
            </Link>
            .
          </p>
        ) : kelas.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Belum ada kelas.{" "}
            <Link href={`/s/${slug}/admin/data/kelas`} className="font-medium underline">
              Buat kelas dulu
            </Link>
            .
          </p>
        ) : (
          <form action={saveAction} className="grid gap-3 sm:grid-cols-2">
            <Field label="Akun login">
              <select name="user_id" required className={selectCls} defaultValue="">
                <option value="" disabled>
                  Pilih akun…
                </option>
                {tersedia.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama} (@{u.username})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nama tampilan">
              <input name="nama" required maxLength={120} className={inputCls} />
            </Field>
            <Field label="NIS (opsional)">
              <input name="nis" maxLength={32} className={inputCls} />
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
            <Field label="Jenis kelamin">
              <select name="jenis_kelamin" className={selectCls} defaultValue="L">
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Simpan siswa</SubmitButton>
            </div>
          </form>
        )}
      </Card>

      <SearchBar q={q} placeholder="Cari nama / NIS / kelas…" />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">NIS</th>
              <th className="px-4 py-3">Kelas</th>
              <th className="px-4 py-3">L/P</th>
              <th className="px-4 py-3">Akun</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium">{s.nama}</td>
                <td className="px-4 py-3">{s.nis || "-"}</td>
                <td className="px-4 py-3">{s.kelas_nama}</td>
                <td className="px-4 py-3">{s.jenis_kelamin}</td>
                <td className="px-4 py-3 font-mono text-xs">@{s.username}</td>
                <td className="px-4 py-3">
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton message={`Hapus profil ${s.nama}?`} danger>
                      Hapus
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                  Belum ada data siswa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager base={base} page={current} pages={pages} q={q} />
    </div>
  );
}
