import { auth } from "@/auth";
import { buildBackupWorkbook } from "@/lib/export/backup";
import { getTenantContext } from "@/lib/google/tenant-client";
import { todayWIB } from "@/lib/services/guru";

/**
 * Backup admin: unduh Excel seluruh data sekolah (12 tab).
 * Khusus admin sekolah tersebut.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("Khusus admin.", { status: 403 });
  }
  const q = new URL(req.url).searchParams;
  const slug = q.get("slug") ?? session.user.slug;
  if (slug !== session.user.slug) {
    return new Response("Slug tidak cocok dengan sesi.", { status: 403 });
  }
  try {
    const ctx = await getTenantContext(slug);
    const buf = await buildBackupWorkbook(ctx.sheets, ctx.context.spreadsheetId);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="backup-${slug}-${todayWIB()}.xlsx"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal membuat backup.";
    return new Response(msg, { status: 400 });
  }
}
