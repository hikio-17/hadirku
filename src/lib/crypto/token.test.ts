import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decryptToken, encryptToken, getEncryptionKey, redactForLog, redactValue } from "./token";

const KEY = randomBytes(32).toString("base64");
const OTHER_KEY = randomBytes(32).toString("base64");

describe("getEncryptionKey", () => {
  it("menerima kunci base64 32 byte", () => {
    expect(getEncryptionKey(KEY)).toHaveLength(32);
  });

  it("menolak kunci yang bukan 32 byte", () => {
    expect(() => getEncryptionKey(randomBytes(16).toString("base64"))).toThrow(/32 byte/);
    expect(() => getEncryptionKey("bukan-base64-!!!")).toThrow();
  });
});

describe("encrypt/decrypt refresh token", () => {
  it("roundtrip mengembalikan plaintext semula", () => {
    const enc = encryptToken("refresh-token-abc-123", KEY);
    expect(enc).not.toContain("refresh-token-abc-123");
    expect(decryptToken(enc, KEY)).toBe("refresh-token-abc-123");
  });

  it("IV acak: ciphertext berbeda untuk plaintext sama", () => {
    expect(encryptToken("sama", KEY)).not.toBe(encryptToken("sama", KEY));
  });

  it("gagal dengan kunci yang salah", () => {
    const enc = encryptToken("rahasia", KEY);
    expect(() => decryptToken(enc, OTHER_KEY)).toThrow(/Gagal mendekripsi/);
  });

  it("gagal untuk payload korup", () => {
    expect(() => decryptToken("c2luZ2thdA==", KEY)).toThrow(/pendek|korup/);
    const enc = encryptToken("rahasia", KEY);
    const tampered = `A${enc.slice(1)}`;
    expect(() => decryptToken(tampered, KEY)).toThrow();
  });
});

describe("redact", () => {
  it("menyensor nilai dengan kunci sensitif", () => {
    expect(redactValue("refresh_token_enc", "abc")).toBe("[REDACTED]");
    expect(redactValue("password_hash", "abc")).toBe("[REDACTED]");
    expect(redactValue("nama_sekolah", "SMP 1")).toBe("SMP 1");
  });

  it("menyensor rekursif tanpa memutasi objek asli", () => {
    const input = {
      slug: "smp1",
      refresh_token_enc: "secret",
      nested: { owner_email: "a@b.c", items: [{ token: "t" }] },
    };
    const out = redactForLog(input);
    expect(out).toEqual({
      slug: "smp1",
      refresh_token_enc: "[REDACTED]",
      nested: { owner_email: "a@b.c", items: [{ token: "[REDACTED]" }] },
    });
    expect(input.refresh_token_enc).toBe("secret");
  });
});
