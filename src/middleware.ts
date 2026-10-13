import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-cookies";
import { decideSchoolAccess, type SchoolToken } from "@/lib/route-guard";

/**
 * Proteksi route /s/[slug]/* di Edge: baca JWT sesi (tanpa menyentuh Google
 * API), tegakkan login + kecocokan slug + role + wajib ganti password.
 * Layout (terlindungi) mengulang pemeriksaan login + slug di Node.
 */
export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/s/")) return NextResponse.next();

  const raw = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName: SESSION_COOKIE_NAME,
  });
  const token: SchoolToken | null =
    raw && typeof raw.slug === "string" && typeof raw.role === "string"
      ? { slug: raw.slug, role: raw.role, mustChange: raw.mustChange === true }
      : null;

  const decision = decideSchoolAccess(pathname, token);
  if ("redirect" in decision) {
    return NextResponse.redirect(new URL(decision.redirect, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/s/:path*"] };
