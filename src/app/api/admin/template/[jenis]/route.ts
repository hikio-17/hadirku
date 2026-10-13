import { auth } from "@/auth";
import { buildTemplateWorkbook, type ImportJenis } from "@/lib/services/impor";

/**
 * Unduh template Excel impor (kolom + 1 baris contoh).
 * Butuh sesi admin (sekolah mana pun — template generik tanpa data).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ jenis: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("Khusus admin.", { status: 403 });
  }
  const { jenis } = await ctx.params;
  if (jenis !== "guru" && jenis !== "siswa") {
    return new Response("Jenis tidak dikenal.", { status: 404 });
  }
  const buf = await buildTemplateWorkbook(jenis as ImportJenis);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-${jenis}.xlsx"`,
    },
  });
}
