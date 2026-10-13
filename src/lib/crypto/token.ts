import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Mengambil kunci enkripsi 32 byte dari string base64 env TOKEN_ENCRYPTION_KEY.
 * Generate kunci baru: `openssl rand -base64 32`
 */
export function getEncryptionKey(base64Key: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(base64Key, "base64");
  } catch {
    throw new Error("TOKEN_ENCRYPTION_KEY bukan base64 yang valid.");
  }
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY harus 32 byte (base64 ~44 karakter), dapat ${key.length} byte.`
    );
  }
  return key;
}

/**
 * Enkripsi refresh token Google dengan AES-256-GCM.
 * IV acak per enkripsi; output = base64(iv ‖ authTag ‖ ciphertext).
 */
export function encryptToken(plaintext: string, base64Key: string): string {
  const key = getEncryptionKey(base64Key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/** Dekripsi hasil `encryptToken`. Gagal bila kunci salah atau payload korup. */
export function decryptToken(payload: string, base64Key: string): string {
  const key = getEncryptionKey(base64Key);
  let raw: Buffer;
  try {
    raw = Buffer.from(payload, "base64");
  } catch {
    throw new Error("Payload terenkripsi bukan base64 yang valid.");
  }
  const minLen = IV_BYTES + TAG_BYTES + 1;
  if (raw.length < minLen) {
    throw new Error("Payload terenkripsi terlalu pendek / korup.");
  }
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Gagal mendekripsi token (kunci salah atau data korup).");
  }
}

/** Samakan panjang string dengan timing aman (untuk komparasi token lock, dll). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const SENSITIVE_KEY_PATTERN = /token|secret|password|sandi|private[_-]?key|refresh/i;

/**
 * Sensor nilai sensitif agar tidak bocor ke log / error message.
 * - String yang kuncinya sensitif → "[REDACTED]"
 * - String panjang yang tampak seperti token (>= 20 char) → potong ujungnya.
 */
export function redactValue(key: string, value: unknown): unknown {
  if (typeof value === "string" && SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }
  return value;
}

/** Sensor rekursif sebuah objek sebelum di-log (tidak memutasi objek asli). */
export function redactForLog<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((v) => redactForLog(v)) as unknown as T;
  }
  if (input !== null && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k) ? "[REDACTED]" : redactForLog(v);
    }
    return out as T;
  }
  return input;
}
