import { describe, expect, it } from "vitest";

import { securityHeaders } from "./security-headers";

describe("securityHeaders", () => {
  it("production: CSP ketat + HSTS", () => {
    const h = new Map(securityHeaders(true).map((x) => [x.key, x.value]));
    expect(h.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(h.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(h.get("Content-Security-Policy")).toContain("accounts.google.com");
    expect(h.get("Content-Security-Policy")).not.toContain("unsafe-eval");
    expect(h.get("X-Frame-Options")).toBe("DENY");
    expect(h.get("Strict-Transport-Security")).toContain("max-age");
  });

  it("development: eval diizinkan untuk HMR, tanpa HSTS", () => {
    const h = new Map(securityHeaders(false).map((x) => [x.key, x.value]));
    expect(h.get("Content-Security-Policy")).toContain("unsafe-eval");
    expect(h.has("Strict-Transport-Security")).toBe(false);
  });
});
