import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { getServerRegistry } from "@/lib/google/tenant-client";
import { getNavForRole } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * Layout terlindungi: ulangi pemeriksaan login + kecocokan slug di Node
 * (middleware Edge sudah memeriksa lebih dulu — pertahanan berlapis).
 */
export default async function GuardedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/s/${slug}/login`);
  if (session.user.slug !== slug) redirect(`/s/${session.user.slug}`);

  let schoolName = slug;
  let koneksiTerputus = false;
  try {
    const school = await getServerRegistry().findBySlug(slug);
    if (school) {
      schoolName = school.nama_sekolah;
      koneksiTerputus = school.status === "perlu_hubungkan_ulang";
    }
  } catch {
    // Nama tampilan saja; proteksi tidak bergantung pada fetch ini.
  }

  return (
    <AppShell
      slug={slug}
      schoolName={schoolName}
      koneksiTerputus={koneksiTerputus}
      isAdmin={session.user.role === "admin"}
      user={{
        name: session.user.name,
        username: session.user.username,
        role: session.user.role,
      }}
      nav={getNavForRole(session.user.role, slug)}
    >
      {children}
    </AppShell>
  );
}
