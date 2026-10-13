import { describe, expect, it } from "vitest";

import { defaultSchemaName, sanitizeSchemaName } from "./schema";

describe("sanitizeSchemaName", () => {
  it("huruf kecil + garis bawah", () => {
    expect(sanitizeSchemaName("SMPN-1 Bandung")).toBe("smpn_1_bandung");
    expect(sanitizeSchemaName("  school.x ")).toBe("school_x");
    expect(defaultSchemaName("smpn-1")).toBe("school_smpn_1");
  });

  it("menolak nama kosong", () => {
    expect(() => sanitizeSchemaName("---")).toThrow(/tidak valid/);
  });

  it("mencegah injeksi SQL via nama schema", () => {
    const evil = sanitizeSchemaName('x"; DROP TABLE users; --');
    expect(evil).toMatch(/^[a-z0-9_]+$/);
    expect(evil).not.toContain('"');
  });
});
