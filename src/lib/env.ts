import { z } from "zod";

/**
 * Validasi environment variables saat boot.
 * Dipakai di server saja; jangan import dari Client Component.
 */
const envSchema = z.object({
  AUTH_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  // Private key SA: di Vercel disimpan dengan literal \n, dinormalisasi di sini.
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  REGISTRY_SHEET_ID: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  DEPLOY_MODE: z.enum(["multitenant", "selfhost"]).default("multitenant"),
  // Self-host: satu sekolah, Service Account, tanpa OAuth/registry.
  SELFHOST_SPREADSHEET_ID: z.string().optional(),
  SELFHOST_SLUG: z.string().default("sekolah"),
  SELFHOST_SCHOOL_NAME: z.string().optional(),
  // Postgres: hanya untuk migrasi/manual (lihat docs/postgres-schema.sql).
  DATABASE_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Konfigurasi environment tidak valid: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }
  const env = parsed.data;
  if (env.GOOGLE_PRIVATE_KEY?.includes("\\n")) {
    env.GOOGLE_PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  return env;
}

export const env: Env = loadEnv();

/** True jika kredensial Upstash Redis tersedia (selain itu pakai fallback memory). */
export function hasUpstashConfig(e: Env = env): boolean {
  return Boolean(e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN);
}
