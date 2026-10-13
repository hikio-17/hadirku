import Link from "next/link";

import { auth } from "@/auth";
import { getServerRegistry } from "@/lib/google/tenant-client";
import type { SchoolRow } from "@/lib/storage/types";
import { Card, CardTitle, Notice, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/ui-client";
import { putuskanAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  aktif: "Terhubung",
  perlu_hubungkan_ulang: "Terputus — perlu hubungkan ulang",
  nonaktif: "Nonaktif",
};

export default async function KoneksiPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { ok = "", error = "" } = await searchParams;
  const session = await auth();

  let school: SchoolRow | null = null;
  try {
    school = await getServerRegistry().findBySlug(slug);
  } catch {
    school = null;
  }

  return (
    <div>
      <PageHeader
        title="Koneksi & data"
        subtitle="Status Google, backup, dan pemutusan koneksi."
        backHref={`/s/${slug}/admin`}
      />
      <Notice ok={ok} error={error} />
      <Card>
        <CardTitle>Status koneksi Google</CardTitle>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium">
              {school ? (STATUS_LABEL[school.status] ?? school.status) : "-"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Terakhir aktif</dt>
            <dd className="font-mono text-xs">{school?.terakhir_aktif?.slice(0, 10) ?? "-"}</dd>
          </div>
        </dl>
        {school?.status === "perlu_hubungkan_ulang" && (
          <Link
            href={`/api/auth/google/reconnect?slug=${slug}`}
            className="mt-3 flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white"
          >
            Hubungkan ulang Google
          </Link>
        )}
      </Card>

      <Card>
        <CardTitle>Backup data</CardTitle>
        <p className="text-sm text-zinc-600">
          Unduh seluruh data sekolah (12 tab) sebagai file Excel. Simpan berkala di tempat aman.
        </p>
        <a
          href={`/api/admin/backup?slug=${slug}`}
          className="mt-3 flex h-11 items-center justify-center rounded-full border border-zinc-950 px-5 text-sm font-medium"
        >
          Unduh backup (.xlsx)
        </a>
      </Card>

      <Card>
        <CardTitle>Zona berbahaya</CardTitle>
        <p className="text-sm text-zinc-600">
          Memutus koneksi mencabut akses aplikasi ke Google Drive sekolah dan menghapus token dari
          platform. Anda akan keluar dan sekolah menjadi nonaktif. Spreadsheet di Drive tetap ada
          (data tidak dihapus).
        </p>
        {session?.user.role === "admin" && session.user.slug === slug ? (
          <form action={putuskanAction} className="mt-3">
            <ConfirmButton message="Putuskan koneksi Google dan nonaktifkan sekolah ini?" danger>
              Putuskan koneksi & hapus token saya
            </ConfirmButton>
          </form>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Hanya admin sekolah ini yang bisa memutuskan.
          </p>
        )}
      </Card>
    </div>
  );
}
