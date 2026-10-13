"use server";

import { signOut } from "@/auth";

/** Keluar dari sesi sekolah, kembali ke halaman login sekolah tersebut. */
export async function logoutAction(slug: string): Promise<void> {
  await signOut({ redirectTo: `/s/${slug}/login` });
}
