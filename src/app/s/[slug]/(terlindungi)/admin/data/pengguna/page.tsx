import Link from "next/link";

import { requireAdmin } from "@/lib/admin-guard";
import { NeedsReconnectError } from "@/lib/google/oauth";
import type { UserRow } from "@/lib/storage/types";
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
import { listUsers } from "@/lib/services/pengguna";
import { createAction, resetAction, toggleAction, updateAction } from "./actions";

export const dynamic = "force-dynamic";

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize">
      {role}
    </span>
  );
}

export default async function PenggunaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string; ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { q = "", page = "1", ok = "", error = "" } = await searchParams;
  const base = `/s/${slug}/admin/data/pengguna`;

  let users: UserRow[] = [];
  let loadError = "";
  let reconnect = false;
  try {
    const { ctx } = await requireAdmin();
    users = await listUsers(ctx.sheets, ctx.context.spreadsheetId);
  } catch (err) {
    reconnect = err instanceof NeedsReconnectError;
    loadError = err instanceof Error ? err.message : "Gagal memuat data.";
  }

  const { items, pages, current } = paginate(
    filterByQuery(users, q, (u) => [u.nama, u.username, u.role]),
    Number(page) || 1
  );

  return (
    <div>
      <PageHeader
        title="Akun pengguna"
        subtitle="Akun login guru, siswa, dan admin. Username unik per sekolah."
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
        <CardTitle>Tambah akun</CardTitle>
        <form action={createAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama lengkap">
            <input name="nama" required maxLength={120} className={inputCls} />
          </Field>
          <Field label="Username" hint="Huruf kecil, angka, titik, garis bawah.">
            <input
              name="username"
              required
              maxLength={32}
              pattern="[a-z0-9_.]+"
              className={inputCls}
            />
          </Field>
          <Field label="Password awal (min. 8)">
            <input name="password" type="password" required minLength={8} className={inputCls} />
          </Field>
          <Field label="Role">
            <select name="role" className={selectCls} defaultValue="siswa">
              <option value="admin">Admin</option>
              <option value="guru">Guru</option>
              <option value="siswa">Siswa</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Buat akun</SubmitButton>
          </div>
        </form>
      </Card>

      <SearchBar q={q} placeholder="Cari nama / username…" />
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3 font-medium">{u.nama}</td>
                <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-3">{u.aktif ? "Aktif" : "Nonaktif"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <details className="relative">
                      <summary className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
                        Ubah
                      </summary>
                      <form
                        action={updateAction}
                        className="absolute right-0 z-10 mt-1 w-64 space-y-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg"
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <Field label="Nama">
                          <input name="nama" required defaultValue={u.nama} className={inputCls} />
                        </Field>
                        <Field label="Role">
                          <select name="role" defaultValue={u.role} className={selectCls}>
                            <option value="admin">Admin</option>
                            <option value="guru">Guru</option>
                            <option value="siswa">Siswa</option>
                          </select>
                        </Field>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="aktif" defaultChecked={u.aktif} />
                          Aktif
                        </label>
                        <SubmitButton>Simpan</SubmitButton>
                      </form>
                    </details>
                    <details className="relative">
                      <summary className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
                        Reset
                      </summary>
                      <form
                        action={resetAction}
                        className="absolute right-0 z-10 mt-1 w-64 space-y-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg"
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <Field label="Password sementara" hint="User wajib ganti saat login.">
                          <input
                            name="tempPassword"
                            type="text"
                            required
                            minLength={8}
                            className={inputCls}
                          />
                        </Field>
                        <SubmitButton>Reset password</SubmitButton>
                      </form>
                    </details>
                    <form action={toggleAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="aktif" value={u.aktif ? "false" : "true"} />
                      <ConfirmButton
                        message={u.aktif ? `Nonaktifkan ${u.nama}?` : `Aktifkan ${u.nama}?`}
                        danger={u.aktif}
                      >
                        {u.aktif ? "Nonaktif" : "Aktifkan"}
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                  {users.length === 0 ? "Belum ada akun." : "Tidak cocok dengan pencarian."}
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
