import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { buildAuthUrl, OAUTH_MODE_COOKIE, OAUTH_STATE_COOKIE } from "@/lib/google/oauth";

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Mulai pendaftaran: set state CSRF lalu arahkan ke persetujuan Google. */
export async function GET(): Promise<Response> {
  const state = randomBytes(32).toString("hex");
  let url: string;
  try {
    url = buildAuthUrl(state);
  } catch {
    return new Response("Konfigurasi Google OAuth belum lengkap.", { status: 500 });
  }
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, state, cookieOpts(600));
  res.cookies.delete(OAUTH_MODE_COOKIE);
  return res;
}
