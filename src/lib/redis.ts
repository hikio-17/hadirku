import "server-only";

import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";

import { env, hasUpstashConfig } from "@/lib/env";

/** Interface cache minimal agar bisa di-swap (Upstash vs memory) dan di-mock di test. */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
}

/** Lock distribusi: acquire mengembalikan fungsi release, atau null bila terkunci. */
export type ReleaseLock = () => Promise<void>;
export interface Locker {
  acquire(key: string, ttlSeconds: number): Promise<ReleaseLock | null>;
}

/** Key cache/lock selalu berprefix school_id agar antar-tenant tidak bocor. */
export function tenantKey(schoolId: string, ...parts: string[]): string {
  return ["school", schoolId, ...parts].join(":");
}

// ---------------------------------------------------------------------------
// Adapter memory (dev/test tanpa kredensial Upstash; BUKAN untuk produksi)
// ---------------------------------------------------------------------------

export function createMemoryCache(): Cache {
  const store = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() >= entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },
    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async del(...keys: string[]): Promise<void> {
      for (const k of keys) store.delete(k);
    },
  };
}

export function createMemoryLocker(): Locker {
  const locks = new Map<string, number>();
  return {
    async acquire(key: string, ttlSeconds: number): Promise<ReleaseLock | null> {
      const now = Date.now();
      const heldUntil = locks.get(key);
      if (heldUntil !== undefined && heldUntil > now) return null;
      locks.set(key, now + ttlSeconds * 1000);
      let released = false;
      return async () => {
        if (!released) {
          released = true;
          locks.delete(key);
        }
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter Upstash Redis
// ---------------------------------------------------------------------------

let redisSingleton: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton;
  if (!hasUpstashConfig()) {
    redisSingleton = null;
    return null;
  }
  redisSingleton = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return redisSingleton;
}

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export function createRedisLocker(redis: Redis): Locker {
  return {
    async acquire(key: string, ttlSeconds: number): Promise<ReleaseLock | null> {
      const token = randomBytes(16).toString("hex");
      // SET key token NX EX ttl
      const result = await redis.set(key, token, { nx: true, ex: ttlSeconds });
      if (result !== "OK") return null;
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        try {
          await redis.eval(RELEASE_SCRIPT, [key], [token]);
        } catch {
          // Fallback bila EVAL tidak tersedia: hapus best-effort.
          await redis.del(key);
        }
      };
    },
  };
}

export function createRedisCache(redis: Redis): Cache {
  return {
    async get<T>(key: string): Promise<T | null> {
      return redis.get<T>(key);
    },
    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
      await redis.set(key, value, { ex: ttlSeconds });
    },
    async del(...keys: string[]): Promise<void> {
      if (keys.length > 0) await redis.del(...keys);
    },
  };
}

// ---------------------------------------------------------------------------
// Factory default: Upstash bila env tersedia, memory bila tidak.
// ---------------------------------------------------------------------------

let defaultCache: Cache | undefined;
let defaultLocker: Locker | undefined;

/** Cache default instance. Di produksi wajib ada env Upstash (lihat hasUpstashConfig). */
export function getCache(): Cache {
  if (!defaultCache) {
    const redis = getRedis();
    defaultCache = redis ? createRedisCache(redis) : createMemoryCache();
  }
  return defaultCache;
}

/** Locker default instance (SET NX EX agar tidak ada refresh ganda bersamaan). */
export function getLocker(): Locker {
  if (!defaultLocker) {
    const redis = getRedis();
    defaultLocker = redis ? createRedisLocker(redis) : createMemoryLocker();
  }
  return defaultLocker;
}

/** Reset singleton (dipakai test agar antar-test terisolasi). */
export function __resetSingletons(): void {
  redisSingleton = undefined;
  defaultCache = undefined;
  defaultLocker = undefined;
}
