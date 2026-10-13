import { notFound } from "next/navigation";

import { getServerRegistry } from "@/lib/google/tenant-client";

/** Layout publik per sekolah: pastikan slug ada (auth dijaga middleware + layout terlindungi). */
export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let exists = false;
  try {
    const school = await getServerRegistry().findBySlug(slug);
    exists = !!school && school.status !== "nonaktif";
  } catch {
    exists = false;
  }
  if (!exists) notFound();
  return <>{children}</>;
}
