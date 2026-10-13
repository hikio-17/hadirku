import { NextRequest, NextResponse } from "next/server";

import { encryptToken, redactForLog, safeEqual } from "@/lib/crypto/token";
import { env } from "@/lib/env";
import { exchangeCodeForTokens, OAUTH_MODE_COOKIE, OAUTH_STATE_COOKIE } from "@/lib/google/oauth";
import { getServerRegistry } from "@/lib/google/tenant-client";
import { createSetupSession, SETUP_COOKIE } from "@/lib/setup-session";

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Callback OAuth Google: tukar code → refresh token (terenkripsi) →
 * sesi setup (pendaftaran baru) atau update token (hubung ulang).
 * Refresh token tidak pernah dikirim ke client.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { isSelfHostMode } = await import("@/lib/selfhost");
  if (isSelfHostMode()) return NextResponse.redirect("/daftar");
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return NextResponse.redirect("/daftar?error=ditolak");

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const mode = req.cookies.get(OAUTH_MODE_COOKIE)?.value; // school_id saat hubung ulang

  if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
    return NextResponse.redirect("/daftar?error=sesi");
  }
  if (!env.TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect("/daftar?error=konfigurasi");
  }

  const done = (path: string): NextResponse => {
    const res = NextResponse.redirect(path);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  };

  try {
    const tokens = await exchangeCodeForTokens(code);
    const refreshTokenEnc = encryptToken(tokens.refreshToken, env.TOKEN_ENCRYPTION_KEY);
    const registry = getServerRegistry();

    if (mode) {
      // Hubung ulang: pakai spreadsheet yang SAMA, hanya token diperbarui.
      const school = await registry.findById(mode);
      if (!school) return done("/daftar?error=sekolah");
      await registry.updateRefreshToken(mode, refreshTokenEnc, "aktif");
      const res = done(`/s/${school.slug}?reconnected=1`);
      res.cookies.delete(OAUTH_MODE_COOKIE);
      return res;
    }

    const setupId = await createSetupSession({
      email: tokens.email,
      name: tokens.name,
      refreshTokenEnc,
      createdAt: new Date().toISOString(),
    });
    const res = done("/setup/wizard");
    res.cookies.set(SETUP_COOKIE, setupId, cookieOpts(1800));
    return res;
  } catch (err) {
    console.error(redactForLog({ scope: "oauth-callback", error: String(err) }));
    const msg = err instanceof Error ? err.message : "";
    const code = /refresh token/i.test(msg) ? "token" : "gagal";
    return done(`/daftar?error=${code}`);
  }
}
