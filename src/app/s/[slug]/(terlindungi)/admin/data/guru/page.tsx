import Link from "next/link";

import { requireAdmin } from "@/lib/admin-guard";
import { NeedsReconnectError } from "@/lib/google/oauth";
import type { KelasRow, UserRow } from "@/lib/storage/types";
import type { GuruView } from "@/lib/services/akademik";
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
import { listGuru, listGuruTersedia } from "@/lib/services/akademik";
import { listKelas } from "@/lib/services/master";
import { deleteAction, saveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function GuruPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string; ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { q = "", page = "1", ok = "", error = "" } = await searchParams;
  const base = `/s/${slug}/admin/data/guru`;

  let rows: GuruView[] = [];
  let tersedia: UserRow[] = [];
  let kelas: KelasRow[] = [];
  let loadError = "";
  let reconnect = false;
  try {
    const { ctx } = await requireAdmin();
    const sid = ctx.context.spreadsheetId;
    [rows, tersedia, kelas] = await Promise.all([
      listGuru(ctx.sheets, sid),
      listGuruTersedia(ctx.sheets, sid),
      listKelas(ctx.sheets, sid),
    ]);
  } catch (err) {
    reconnect = err instanceof NeedsReconnectError;
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  const { items, pages, current } = paginate(
    filterByQuery(rows, q, (g) => [g.nama, g.nip, g.username]),
    Number(page) || 1
  );

  return (
    <div>
      <PageHeader
        title="Data guru"
        subtitle="Profil guru terhubung ke akun login."
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
        <CardTitle>Tambah profil guru</CardTitle>
        {tersedia.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Tidak ada akun guru yang belum punya profil.{" "}
            <Link href={`/s/${slug}/admin/data/pengguna`} className="font-medium underline">
              Buat akun dulu di Pengguna
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
            <Field label="NIP (opsional)">
              <input name="nip" maxLength={32} className={inputCls} />
            </Field>
            <Field label="Kelas wali (bila wali kelas)">
              <select name="kelas_wali_id" className={selectCls} defaultValue="">
                <option value="">— Bukan wali kelas —</option>
                {kelas.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="is_wali_kelas" />
              Wali kelas
            </label>
            <div className="sm:col-span-2">
              <SubmitButton>Simpan guru</SubmitButton>
            </div>
          </form>
        )}
      </Card>

      <SearchBar q={q} placeholder="Cari nama / NIP…" />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">NIP</th>
              <th className="px-4 py-3">Akun</th>
              <th className="px-4 py-3">Wali</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium">{g.nama}</td>
                <td className="px-4 py-3">{g.nip || "-"}</td>
                <td className="px-4 py-3 font-mono text-xs">@{g.username}</td>
                <td className="px-4 py-3">{g.is_wali_kelas ? g.kelas_wali_nama : "-"}</td>
                <td className="px-4 py-3">
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={g.id} />
                    <ConfirmButton message={`Hapus profil ${g.nama}?`} danger>
                      Hapus
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                  Belum ada data guru.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager base={base} page={current} pages={pages} q={q} />
      <p className="mt-3 text-xs text-zinc-500">
        Ubah profil: hapus lalu buat ulang (riwayat penugasan ikut terproteksi).
      </p>
    </div>
  );
}
