import "server-only";

import { google } from "googleapis";

import { env } from "@/lib/env";

/**
 * Scope OAuth Google untuk registrasi sekolah. SENGAJA minimal:
 * hanya `drive.file` (app hanya bisa akses file yang dibuat/dipilih app),
 * tanpa akses penuh ke Drive pengguna.
 */
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.file",
] as const;

/** Nama cookie state CSRF OAuth + mode hubung-ulang. */
export const OAUTH_STATE_COOKIE = "g_oauth_state";
export const OAUTH_MODE_COOKIE = "g_oauth_mode";

/** Tipe struktural minimal agar mudah di-mock di unit test. */
export type OAuth2ClientLike = InstanceType<(typeof google)["auth"]["OAuth2"]>;

/** Dibaca lazy dari process.env agar bisa di-stub di test. */
function oauthEnv(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET || "",
  };
}

export function getOAuthRedirectUri(appUrl?: string): string {
  const base = (
    appUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

export function createOAuthClient(redirectUri?: string): OAuth2ClientLike {
  const { clientId, clientSecret } = oauthEnv();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth belum dikonfigurasi (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  }
  return new google.auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri: redirectUri ?? getOAuthRedirectUri(),
  });
}

/** URL persetujuan Google: access_type=offline + prompt=consent agar refresh token terbit. */
export function buildAuthUrl(state: string, redirectUri?: string): string {
  return createOAuthClient(redirectUri).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_OAUTH_SCOPES],
    state,
  });
}

export interface ExchangedTokens {
  refreshToken: string;
  accessToken: string;
  expiresInSeconds: number;
  email: string;
  name: string;
}

export interface ProfileFetcher {
  (client: OAuth2ClientLike): Promise<{ email: string; name: string }>;
}

async function defaultFetchProfile(
  client: OAuth2ClientLike
): Promise<{ email: string; name: string }> {
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) throw new Error("Google tidak memberikan alamat email.");
  return { email: data.email, name: data.name ?? data.email };
}

/**
 * Tukar authorization code dengan token. Refresh token dijamin ada karena
 * prompt=consent; bila tidak ada, minta operator mengulang persetujuan.
 */
export async function exchangeCodeForTokens(
  code: string,
  opts?: { client?: OAuth2ClientLike; fetchProfile?: ProfileFetcher; redirectUri?: string }
): Promise<ExchangedTokens> {
  const client = opts?.client ?? createOAuthClient(opts?.redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google tidak menerbitkan refresh token. Ulangi pendaftaran dan pastikan klik persetujuan penuh."
    );
  }
  if (!tokens.access_token) throw new Error("Google tidak menerbitkan access token.");
  client.setCredentials(tokens);
  const profile = await (opts?.fetchProfile ?? defaultFetchProfile)(client);
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresInSeconds: tokens.expiry_date
      ? Math.max(60, Math.floor((tokens.expiry_date - Date.now()) / 1000))
      : 3600,
    email: profile.email,
    name: profile.name,
  };
}

export interface RefreshedToken {
  accessToken: string;
  expiresInSeconds: number;
}

/** Error khusus: refresh gagal invalid_grant → sekolah harus hubungkan ulang. */
export class NeedsReconnectError extends Error {
  constructor() {
    super("Koneksi Google terputus. Buka dashboard admin lalu klik “Hubungkan ulang”.");
    this.name = "NeedsReconnectError";
  }
}

function errorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as { message?: unknown };
    if (typeof e.message === "string") return e.message;
  }
  return "";
}

/** True bila Google menolak refresh token (dicabut / kedaluwarsa izin). */
export function isInvalidGrantError(err: unknown): boolean {
  return /invalid_grant/i.test(errorMessage(err));
}

/** Refresh access token dari refresh token tersimpan (yang sudah didekripsi). */
export async function refreshAccessToken(
  refreshToken: string,
  client?: OAuth2ClientLike
): Promise<RefreshedToken> {
  const c = client ?? createOAuthClient();
  c.setCredentials({ refresh_token: refreshToken });
  try {
    const { credentials } = await c.refreshAccessToken();
    if (!credentials.access_token) throw new Error("Google tidak menerbitkan access token.");
    return {
      accessToken: credentials.access_token,
      expiresInSeconds: credentials.expiry_date
        ? Math.max(60, Math.floor((credentials.expiry_date - Date.now()) / 1000))
        : 3600,
    };
  } catch (err) {
    if (isInvalidGrantError(err)) throw new NeedsReconnectError();
    throw err;
  }
}

/**
 * Cabut token ke Google (dipakai sebelum menghapus dari registry).
 * Token tidak pernah di-log; body form-urlencoded sesuai RFC 7009.
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    throw new Error("Gagal menghubungi Google. Periksa koneksi lalu coba lagi.");
  }
  if (!res.ok) {
    throw new Error("Google menolak pencabutan token. Coba lagi.");
  }
}
