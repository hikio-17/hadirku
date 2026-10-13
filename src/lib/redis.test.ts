import { describe, expect, it } from "vitest";

import { createMemoryCache, createMemoryLocker, tenantKey } from "./redis";

describe("tenantKey", () => {
  it("selalu berprefix school_id", () => {
    expect(tenantKey("sch_1", "registry", "slug")).toBe("school:sch_1:registry:slug");
  });
});

describe("memory cache", () => {
  it("set lalu get mengembalikan nilai", async () => {
    const cache = createMemoryCache();
    await cache.set("k", { a: 1 }, 60);
    expect(await cache.get("k")).toEqual({ a: 1 });
  });

  it("entry kedaluwarsa setelah TTL", async () => {
    const cache = createMemoryCache();
    await cache.set("k", "v", 0.01); // 10ms
    await new Promise((r) => setTimeout(r, 30));
    expect(await cache.get("k")).toBeNull();
  });

  it("del menghapus key", async () => {
    const cache = createMemoryCache();
    await cache.set("a", 1, 60);
    await cache.set("b", 2, 60);
    await cache.del("a", "b");
    expect(await cache.get("a")).toBeNull();
    expect(await cache.get("b")).toBeNull();
  });
});

describe("memory locker", () => {
  it("acquire kedua gagal saat lock dipegang", async () => {
    const locker = createMemoryLocker();
    const release = await locker.acquire("lock:sch_1:refresh", 60);
    expect(release).not.toBeNull();
    expect(await locker.acquire("lock:sch_1:refresh", 60)).toBeNull();
    await release!();
    expect(await locker.acquire("lock:sch_1:refresh", 60)).not.toBeNull();
  });
});
