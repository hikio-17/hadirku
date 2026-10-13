import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encode, getToken } from "next-auth/jwt";

import { SESSION_COOKIE_NAME } from "./auth-cookies";

const secret = randomBytes(32).toString("hex");

/**
 * Memastikan middleware (getToken + nama cookie eksplisit) bisa membaca sesi
 * yang ditulis Auth.js (encode + salt = nama cookie, sesuai @auth/core).
 */
describe("session cookie roundtrip", () => {
  it("getToken membaca JWT yang di-encode dengan salt nama cookie", async () => {
    const jwt = await encode({
      secret,
      salt: SESSION_COOKIE_NAME,
      token: { slug: "smpn-1", role: "guru", mustChange: false },
      maxAge: 12 * 60 * 60,
    });
    const req = {
      cookies: {
        get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: jwt } : undefined),
      },
      headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${jwt}` }),
      nextUrl: new URL("http://localhost/s/smpn-1"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const token = await getToken({ req, secret, cookieName: SESSION_COOKIE_NAME });
    expect(token).toMatchObject({ slug: "smpn-1", role: "guru", mustChange: false });
  });

  it("cookie tak dikenal → null (fail-closed)", async () => {
    const req = {
      cookies: { get: () => undefined },
      headers: new Headers(),
      nextUrl: new URL("http://localhost/s/smpn-1"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(await getToken({ req, secret, cookieName: SESSION_COOKIE_NAME })).toBeNull();
  });
});
