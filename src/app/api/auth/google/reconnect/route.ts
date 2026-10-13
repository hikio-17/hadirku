import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { redactForLog } from "@/lib/crypto/token";
import { buildAuthUrl, OAUTH_MODE_COOKIE, OAUTH_STATE_COOKIE } from "@/lib/google/oauth";
import { getServerRegistry } from "@/lib/google/tenant-client";

/**
 * Mulai hubung ulang Google untuk satu sekolah (dipakai saat status
 * `perlu_hubungkan_ulang`). Callback memakai spreadsheet yang sama.
 *
 * TODO(Tahap 3): batasi hanya untuk admin sekolah yang sedang login.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").trim().toLowerCase();
  if (!slug) return new Response("Parameter slug wajib diisi.", { status: 400 });

  try {
    const school = await getServerRegistry().findBySlug(slug);
    if (!school) return new Response("Sekolah tidak ditemukan.", { status: 404 });

    const state = randomBytes(32).toString("hex");
    const res = NextResponse.redirect(buildAuthUrl(state));
    const opts = {
      httpOnly: true as const,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600,
    };
    res.cookies.set(OAUTH_STATE_COOKIE, state, opts);
    res.cookies.set(OAUTH_MODE_COOKIE, school.school_id, opts);
    return res;
  } catch (err) {
    console.error(redactForLog({ scope: "oauth-reconnect", slug, error: String(err) }));
    return new Response("Gagal memulai hubung ulang. Coba lagi.", { status: 500 });
  }
}
