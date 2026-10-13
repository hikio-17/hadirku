import { redirect } from "next/navigation";

import { auth } from "@/auth";

export const dynamic = "force-dynamic";

/** Gerbang /s/[slug]: arahkan ke beranda sesuai role. */
export default async function GatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user.role;
  if (role === "admin") redirect(`/s/${slug}/admin`);
  if (role === "guru") redirect(`/s/${slug}/guru`);
  if (role === "siswa") redirect(`/s/${slug}/siswa`);
  redirect(`/s/${slug}/login?error=hak`);
}
