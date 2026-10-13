import "server-only";

import { nanoid } from "nanoid";

import { getCache, type Cache } from "@/lib/redis";

/**
 * Sesi setup satu-klik: setelah callback OAuth, refresh token terenkripsi +
 * email operator disimpan server-side (cache), cookie hanya berisi ID acak.
 * TTL 30 menit. Dihapus setelah wizard selesai.
 */
export interface SetupSession {
  email: string;
  name: string;
  refreshTokenEnc: string;
  createdAt: string;
}

export const SETUP_SESSION_TTL_SECONDS = 1800;
export const SETUP_COOKIE = "setup_id";

function key(id: string): string {
  return `setup:${id}`;
}

export async function createSetupSession(
  session: SetupSession,
  cache: Cache = getCache()
): Promise<string> {
  const id = nanoid(32);
  await cache.set(key(id), session, SETUP_SESSION_TTL_SECONDS);
  return id;
}

export async function getSetupSession(
  id: string,
  cache: Cache = getCache()
): Promise<SetupSession | null> {
  return cache.get<SetupSession>(key(id));
}

export async function deleteSetupSession(id: string, cache: Cache = getCache()): Promise<void> {
  await cache.del(key(id));
}
