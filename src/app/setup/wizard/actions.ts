"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getServerRegistry } from "@/lib/google/tenant-client";
import { completeSetup } from "@/lib/services/setup";
import { deleteSetupSession, getSetupSession, SETUP_COOKIE } from "@/lib/setup-session";

function str(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** Submit wizard setup satu-klik. Berhasil → /setup/selesai, gagal → kembali + pesan. */
export async function submitWizard(formData: FormData): Promise<never> {
  const setupId = (await cookies()).get(SETUP_COOKIE)?.value;
  if (!setupId) redirect("/daftar?error=sesi");
  const session = await getSetupSession(setupId);
  if (!session) redirect("/daftar?error=sesi");

  const input = {
    nama_sekolah: str(formData.get("nama_sekolah")),
    slug: str(formData.get("slug")),
    nama_admin: str(formData.get("nama_admin")),
    username_admin: str(formData.get("username_admin")),
    password_admin: str(formData.get("password_admin")),
    logo_url: str(formData.get("logo_url")) || undefined,
    tahun_ajaran_nama: str(formData.get("tahun_ajaran_nama")),
    semester: str(formData.get("semester")),
    jam_pelajaran: str(formData.get("jam_pelajaran")),
    persetujuan: formData.get("persetujuan") === "true",
  };

  try {
    const result = await completeSetup(input, session, { registry: getServerRegistry() });
    await deleteSetupSession(setupId);
    (await cookies()).delete(SETUP_COOKIE);
    redirect(`/setup/selesai?slug=${encodeURIComponent(result.slug)}`);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? (err.issues[0]?.message ?? "Data belum valid.")
        : err instanceof Error
          ? err.message
          : "Gagal menyimpan. Coba lagi.";
    redirect(`/setup/wizard?error=${encodeURIComponent(message)}`);
  }
}
