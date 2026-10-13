"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { getLoginRateLimiter } from "@/lib/ratelimit";

export interface LoginState {
  error?: string;
}

/**
 * Login username+password. Rate limit (per slug+username+IP) dicek di sini
 * sebelum signIn agar pesannya spesifik; authorize tetap generik.
 */
export async function loginAction(
  slug: string,
  _prev: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (String(formData.get("slug") ?? slug) !== slug) {
    return { error: "Data sekolah tidak valid." };
  }
  if (!username || !password) return { error: "Username dan password wajib diisi." };

  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  const rl = await getLoginRateLimiter().limit(`login:${slug}:${username.toLowerCase()}:${ip}`);
  if (!rl.success) {
    return { error: "Terlalu banyak percobaan login. Coba lagi dalam 10 menit." };
  }

  const next = String(formData.get("next") ?? "");
  const redirectTo = next.startsWith(`/s/${slug}/`) ? next : `/s/${slug}`;
  try {
    await signIn("credentials", { slug, username, password, redirectTo });
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.type === "CredentialsSignin") return { error: "Username atau password salah." };
      return { error: "Login gagal. Coba lagi." };
    }
    throw err;
  }
  return {};
}
