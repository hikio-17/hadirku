import "server-only";

import { Ratelimit } from "@upstash/ratelimit";

import { getRedis } from "@/lib/redis";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms saat window reset. */
  resetMs: number;
}

export interface RateLimiter {
  limit(key: string): Promise<RateLimitResult>;
}

/**
 * Rate limiter memory (sliding window) untuk dev/test tanpa Upstash.
 * BUKAN untuk produksi multi-instance.
 */
export function createMemoryRateLimiter(opts: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    async limit(key: string): Promise<RateLimitResult> {
      const now = Date.now();
      const windowStart = now - opts.windowMs;
      const prev = (hits.get(key) ?? []).filter((t) => t > windowStart);
      if (prev.length >= opts.limit) {
        const oldest = prev[0] ?? now;
        return { success: false, limit: opts.limit, remaining: 0, resetMs: oldest + opts.windowMs };
      }
      prev.push(now);
      hits.set(key, prev);
      return {
        success: true,
        limit: opts.limit,
        remaining: opts.limit - prev.length,
        resetMs: now + opts.windowMs,
      };
    },
  };
}

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 percobaan per 10 menit

let loginLimiter: RateLimiter | undefined;

/**
 * Rate limit login (dipakai Tahap 3: per IP + per username).
 * Memakai Upstash Ratelimit bila env tersedia, memory bila tidak.
 */
export function getLoginRateLimiter(): RateLimiter {
  if (!loginLimiter) {
    const redis = getRedis();
    if (redis) {
      const upstash = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(LOGIN_LIMIT, "10 m"),
        analytics: false,
        prefix: "hadirku:ratelimit:login",
      });
      loginLimiter = {
        async limit(key: string): Promise<RateLimitResult> {
          const r = await upstash.limit(key);
          return {
            success: r.success,
            limit: r.limit,
            remaining: r.remaining,
            resetMs: r.reset,
          };
        },
      };
    } else {
      loginLimiter = createMemoryRateLimiter({ limit: LOGIN_LIMIT, windowMs: LOGIN_WINDOW_MS });
    }
  }
  return loginLimiter;
}

/** Reset singleton (test). */
export function __resetRateLimiters(): void {
  loginLimiter = undefined;
}
