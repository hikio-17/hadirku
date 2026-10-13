import "server-only";

import { decryptToken } from "@/lib/crypto/token";
import { env } from "@/lib/env";
import { NeedsReconnectError, isInvalidGrantError, refreshAccessToken } from "@/lib/google/oauth";
import {
  createGoogleSheetsValuesClient,
  createServiceAccountSheets,
  createTenantSheets,
} from "@/lib/google/sheets-adapter";
import { getCache, getLocker, tenantKey, type Cache, type Locker } from "@/lib/redis";
import { RegistryRepo } from "@/lib/registry/RegistryRepo";
import { getSelfHostContext, isSelfHostMode } from "@/lib/selfhost";
import { assertStorageSupported } from "@/lib/storage";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import type { SchoolRow } from "@/lib/storage/types";
import type { TenantContext } from "@/types";

export interface TenantClient {
  context: TenantContext;
  /** Client Sheets terautentikasi untuk sekolah ini. */
  sheets: SheetsValuesClient;
  accessToken: string;
  school: SchoolRow;
}

export interface TenantDeps {
  registry: RegistryRepo;
  cache?: Cache;
  locker?: Locker;
  /** Kunci base64 TOKEN_ENCRYPTION_KEY (di-inject agar bisa di-test). */
  tokenKey?: string;
  refreshFn?: (refreshToken: string) => Promise<{ accessToken: string; expiresInSeconds: number }>;
  sheetsFactory?: (accessToken: string) => SheetsValuesClient;
}

function mustRegistryId(): string {
  if (!env.REGISTRY_SHEET_ID) throw new Error("REGISTRY_SHEET_ID belum dikonfigurasi.");
  return env.REGISTRY_SHEET_ID;
}

function mustTokenKey(): string {
  if (!env.TOKEN_ENCRYPTION_KEY) throw new Error("TOKEN_ENCRYPTION_KEY belum dikonfigurasi.");
  return env.TOKEN_ENCRYPTION_KEY;
}

/** Registry platform via Service Account (server-side saja). */
export function getServerRegistry(): RegistryRepo {
  return new RegistryRepo(
    createGoogleSheetsValuesClient(createServiceAccountSheets()),
    mustRegistryId(),
    { cache: getCache(), locker: getLocker() }
  );
}

export function defaultTenantDeps(): TenantDeps {
  return {
    registry: getServerRegistry(),
    cache: getCache(),
    locker: getLocker(),
    tokenKey: env.TOKEN_ENCRYPTION_KEY,
    refreshFn: (rt) => refreshAccessToken(rt),
    sheetsFactory: (at) => createGoogleSheetsValuesClient(createTenantSheets(at)),
  };
}

/**
 * Konteks tenant wajib untuk SEMUA akses data sekolah.
 * Tidak boleh ada kode yang membaca data sekolah tanpa lewat helper ini.
 *
 * - Registry di-cache 10 menit (di RegistryRepo), hanya dibaca saat cache kosong.
 * - Access token di-cache TTL = expires_in − 5 menit.
 * - Lock Redis saat refresh agar tidak ada refresh ganda untuk sekolah yang sama.
 * - invalid_grant → status perlu_hubungkan_ulang + NeedsReconnectError.
 */
export async function getTenantContext(slug: string, deps?: TenantDeps): Promise<TenantClient> {
  // Self-host: tanpa registry/OAuth, langsung konteks statis via Service Account.
  if (isSelfHostMode()) {
    return getSelfHostContext(slug);
  }
  const d = deps ?? defaultTenantDeps();
  const cache = d.cache ?? getCache();
  const locker = d.locker ?? getLocker();
  const tokenKey = d.tokenKey ?? mustTokenKey();
  const refreshFn = d.refreshFn ?? ((rt) => refreshAccessToken(rt));
  const sheetsFactory =
    d.sheetsFactory ?? ((at) => createGoogleSheetsValuesClient(createTenantSheets(at)));

  const school = await d.registry.findBySlug(slug);
  if (!school) throw new Error(`Sekolah "${slug}" tidak ditemukan.`);
  if (school.status === "nonaktif") throw new Error(`Sekolah "${slug}" sudah nonaktif.`);
  if (school.status === "perlu_hubungkan_ulang" || !school.refresh_token_enc) {
    throw new NeedsReconnectError();
  }
  assertStorageSupported(school.storage_adapter);

  const build = (accessToken: string): TenantClient => ({
    context: {
      schoolId: school.school_id,
      slug: school.slug,
      spreadsheetId: school.sheet_id,
      storageAdapter: school.storage_adapter,
    },
    sheets: sheetsFactory(accessToken),
    accessToken,
    school,
  });

  const tokenCacheKey = tenantKey(school.school_id, "token");
  const cached = await cache.get<string>(tokenCacheKey);
  if (cached) return build(cached);

  const release = await locker.acquire(tenantKey(school.school_id, "token-refresh"), 30);
  if (!release) throw new Error("Server sibuk, coba lagi.");
  try {
    const doubleChecked = await cache.get<string>(tokenCacheKey);
    if (doubleChecked) return build(doubleChecked);

    let refreshToken: string;
    try {
      refreshToken = decryptToken(school.refresh_token_enc, tokenKey);
    } catch {
      await d.registry.markNeedsReconnect(school.school_id);
      throw new NeedsReconnectError();
    }

    let fresh: { accessToken: string; expiresInSeconds: number };
    try {
      fresh = await refreshFn(refreshToken);
    } catch (err) {
      if (err instanceof NeedsReconnectError || isInvalidGrantError(err)) {
        await d.registry.markNeedsReconnect(school.school_id);
        throw new NeedsReconnectError();
      }
      throw err;
    }

    await cache.set(tokenCacheKey, fresh.accessToken, Math.max(60, fresh.expiresInSeconds - 300));
    return build(fresh.accessToken);
  } finally {
    await release();
  }
}
