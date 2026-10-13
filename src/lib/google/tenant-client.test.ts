import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { encryptToken } from "@/lib/crypto/token";
import { NeedsReconnectError } from "@/lib/google/oauth";
import { createMemoryCache, createMemoryLocker, tenantKey } from "@/lib/redis";
import { RegistryRepo, SCHOOL_COLUMNS } from "@/lib/registry/RegistryRepo";
import type { CellValue, SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import { getTenantContext } from "./tenant-client";

const KEY = randomBytes(32).toString("base64");

function makeRegistryFake() {
  const header: string[] = [...SCHOOL_COLUMNS];
  const data: string[][] = [];
  const client: SheetsValuesClient = {
    async batchGet() {
      return [{ range: "schools!A1:ZZ", values: [header, ...data] }];
    },
    async append(_id, _range, values: CellValue[][]) {
      for (const v of values) data.push(v.map((c) => String(c ?? "")));
    },
    async batchUpdate(_id, updates) {
      for (const u of updates) {
        const n = Number(u.range.match(/A(\d+):/)?.[1]);
        data[n - 2] = u.values[0].map((c) => String(c));
      }
    },
  };
  return { client };
}

async function seedSchool(
  refreshTokenEnc: string,
  status: "aktif" | "perlu_hubungkan_ulang" | "nonaktif" = "aktif"
) {
  const fake = makeRegistryFake();
  const registry = new RegistryRepo(fake.client, "registry-1", {
    cache: createMemoryCache(),
    locker: createMemoryLocker(),
  });
  const school = await registry.registerSchool({
    slug: "smpn-1",
    nama_sekolah: "SMPN 1",
    owner_email: "admin@sekolah.id",
    sheet_id: "spread-1",
    refresh_token_enc: refreshTokenEnc === "" ? "sementara" : refreshTokenEnc,
  });
  if (refreshTokenEnc === "") {
    await registry.updateRefreshToken(school.school_id, "", "aktif");
  }
  if (status !== "aktif") await registry.setStatus(school.school_id, status);
  return { registry, school };
}

describe("getTenantContext", () => {
  it("mengembalikan konteks + cache token (1 refresh untuk 2 panggil)", async () => {
    const { registry } = await seedSchool(encryptToken("rt-asli", KEY));
    const refreshFn = vi.fn(async () => ({ accessToken: "at-1", expiresInSeconds: 3600 }));
    const deps = {
      registry,
      cache: createMemoryCache(),
      locker: createMemoryLocker(),
      tokenKey: KEY,
      refreshFn,
      sheetsFactory: () => ({}) as SheetsValuesClient,
    };
    const a = await getTenantContext("smpn-1", deps);
    const b = await getTenantContext("SMPN-1", deps); // case-insensitive
    expect(a.context).toMatchObject({
      slug: "smpn-1",
      spreadsheetId: "spread-1",
      storageAdapter: "sheets",
    });
    expect(b.accessToken).toBe("at-1");
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });

  it("TTL cache = expires_in − 5 menit (tidak refresh ulang dalam window)", async () => {
    const { registry } = await seedSchool(encryptToken("rt-asli", KEY));
    const cache = createMemoryCache();
    let n = 0;
    const deps = {
      registry,
      cache,
      locker: createMemoryLocker(),
      tokenKey: KEY,
      refreshFn: async () => ({ accessToken: `at-${++n}`, expiresInSeconds: 3600 }),
      sheetsFactory: () => ({}) as SheetsValuesClient,
    };
    await getTenantContext("smpn-1", deps);
    await getTenantContext("smpn-1", deps);
    expect(n).toBe(1);
  });

  it("lock mencegah refresh ganda bersamaan", async () => {
    const { registry, school } = await seedSchool(encryptToken("rt-asli", KEY));
    const locker = createMemoryLocker();
    const release = await locker.acquire(tenantKey(school.school_id, "token-refresh"), 60);
    await expect(
      getTenantContext("smpn-1", {
        registry,
        cache: createMemoryCache(), // cache kosong → wajib refresh → lock dipegang
        locker,
        tokenKey: KEY,
        refreshFn: async () => ({ accessToken: "at", expiresInSeconds: 3600 }),
        sheetsFactory: () => ({}) as SheetsValuesClient,
      })
    ).rejects.toThrow("Server sibuk");
    await release!();
  });

  it("invalid_grant → status perlu_hubungkan_ulang + NeedsReconnectError", async () => {
    const { registry } = await seedSchool(encryptToken("rt-asli", KEY));
    const refreshFn = vi.fn(async () => {
      throw Object.assign(new Error("invalid_grant: revoked"), { code: 400 });
    });
    const deps = {
      registry,
      cache: createMemoryCache(),
      locker: createMemoryLocker(),
      tokenKey: KEY,
      refreshFn,
      sheetsFactory: () => ({}) as SheetsValuesClient,
    };
    await expect(getTenantContext("smpn-1", deps)).rejects.toBeInstanceOf(NeedsReconnectError);
    const school = await registry.findBySlug("smpn-1");
    expect(school?.status).toBe("perlu_hubungkan_ulang");
    // Panggilan berikut langsung ditolak tanpa refresh lagi.
    await expect(getTenantContext("smpn-1", deps)).rejects.toBeInstanceOf(NeedsReconnectError);
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });

  it("slug tak dikenal → error jelas", async () => {
    const fake = makeRegistryFake();
    const registry = new RegistryRepo(fake.client, "registry-1");
    await expect(
      getTenantContext("tidak-ada", {
        registry,
        cache: createMemoryCache(),
        locker: createMemoryLocker(),
        tokenKey: KEY,
        refreshFn: async () => ({ accessToken: "at", expiresInSeconds: 3600 }),
        sheetsFactory: () => ({}) as SheetsValuesClient,
      })
    ).rejects.toThrow(/tidak ditemukan/);
  });

  it("token kosong → NeedsReconnectError", async () => {
    const { registry } = await seedSchool("");
    await expect(
      getTenantContext("smpn-1", {
        registry,
        cache: createMemoryCache(),
        locker: createMemoryLocker(),
        tokenKey: KEY,
        refreshFn: async () => ({ accessToken: "at", expiresInSeconds: 3600 }),
        sheetsFactory: () => ({}) as SheetsValuesClient,
      })
    ).rejects.toBeInstanceOf(NeedsReconnectError);
  });
});
