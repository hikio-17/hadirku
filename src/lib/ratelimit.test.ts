import { describe, expect, it } from "vitest";

import { createMemoryRateLimiter } from "./ratelimit";

describe("memory rate limiter", () => {
  it("mengizinkan sampai limit lalu menolak", async () => {
    const rl = createMemoryRateLimiter({ limit: 3, windowMs: 60_000 });
    expect((await rl.limit("ip:1.2.3.4")).success).toBe(true);
    expect((await rl.limit("ip:1.2.3.4")).success).toBe(true);
    const third = await rl.limit("ip:1.2.3.4");
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = await rl.limit("ip:1.2.3.4");
    expect(fourth.success).toBe(false);
  });

  it("key berbeda punya kuota sendiri", async () => {
    const rl = createMemoryRateLimiter({ limit: 1, windowMs: 60_000 });
    expect((await rl.limit("user:a")).success).toBe(true);
    expect((await rl.limit("user:b")).success).toBe(true);
    expect((await rl.limit("user:a")).success).toBe(false);
  });

  it("kuota pulih setelah window berlalu", async () => {
    const rl = createMemoryRateLimiter({ limit: 1, windowMs: 20 });
    expect((await rl.limit("k")).success).toBe(true);
    expect((await rl.limit("k")).success).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect((await rl.limit("k")).success).toBe(true);
  });
});
