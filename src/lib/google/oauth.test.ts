import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GOOGLE_OAUTH_SCOPES,
  NeedsReconnectError,
  buildAuthUrl,
  exchangeCodeForTokens,
  getOAuthRedirectUri,
  isInvalidGrantError,
  refreshAccessToken,
} from "./oauth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildAuthUrl", () => {
  it("memakai scope minimal + offline + consent", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "cid-123");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "csecret");
    const url = new URL(buildAuthUrl("state-abc"));
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("client_id")).toBe("cid-123");
    const scope = url.searchParams.get("scope") ?? "";
    for (const s of GOOGLE_OAUTH_SCOPES) expect(scope).toContain(s);
    // TIDAK boleh ada scope Drive penuh (hanya drive.file).
    const scopes = scope.split(" ");
    expect(scopes).not.toContain("https://www.googleapis.com/auth/drive");
    expect(scopes).toContain("https://www.googleapis.com/auth/drive.file");
  });

  it("gagal bila OAuth belum dikonfigurasi", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    expect(() => buildAuthUrl("x")).toThrow(/belum dikonfigurasi/);
  });
});

describe("getOAuthRedirectUri", () => {
  it("mengikuti NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://hadirku.example");
    expect(getOAuthRedirectUri()).toBe("https://hadirku.example/api/auth/google/callback");
  });
});

describe("exchangeCodeForTokens", () => {
  const tokens = {
    refresh_token: "rt-1",
    access_token: "at-1",
    expiry_date: Date.now() + 3600_000,
  };
  const client = {
    getToken: vi.fn(async () => ({ tokens })),
    setCredentials: vi.fn(),
    refreshAccessToken: vi.fn(),
  };

  it("mengembalikan refresh token + profil", async () => {
    const out = await exchangeCodeForTokens("code-1", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      fetchProfile: async () => ({ email: "op@sekolah.id", name: "Operator" }),
    });
    expect(client.getToken).toHaveBeenCalledWith("code-1");
    expect(out).toMatchObject({
      refreshToken: "rt-1",
      accessToken: "at-1",
      email: "op@sekolah.id",
    });
    expect(out.expiresInSeconds).toBeGreaterThan(0);
  });

  it("gagal jelas bila refresh token tidak terbit", async () => {
    const noRefresh = {
      getToken: async () => ({ tokens: { access_token: "at" } }),
      setCredentials: () => {},
      refreshAccessToken: async () => ({ credentials: {} }),
    };
    await expect(
      exchangeCodeForTokens("code-x", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: noRefresh as any,
        fetchProfile: async () => ({ email: "a@b.c", name: "A" }),
      })
    ).rejects.toThrow(/refresh token/i);
  });
});

describe("refreshAccessToken", () => {
  it("sukses mengembalikan access token baru", async () => {
    const client = {
      setCredentials: vi.fn(),
      refreshAccessToken: async () => ({
        credentials: { access_token: "at-baru", expiry_date: Date.now() + 3600_000 },
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await refreshAccessToken("rt", client as any);
    expect(out.accessToken).toBe("at-baru");
    expect(client.setCredentials).toHaveBeenCalledWith({ refresh_token: "rt" });
  });

  it("invalid_grant → NeedsReconnectError", async () => {
    const client = {
      setCredentials: () => {},
      refreshAccessToken: async () => {
        throw Object.assign(new Error("invalid_grant: Token has been expired or revoked"), {
          code: 400,
        });
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(refreshAccessToken("rt", client as any)).rejects.toBeInstanceOf(
      NeedsReconnectError
    );
  });

  it("error lain diteruskan apa adanya", async () => {
    const client = {
      setCredentials: () => {},
      refreshAccessToken: async () => {
        throw Object.assign(new Error("Backend error"), { code: 503 });
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(refreshAccessToken("rt", client as any)).rejects.toThrow("Backend error");
  });
});

describe("isInvalidGrantError", () => {
  it("mendeteksi invalid_grant", () => {
    expect(isInvalidGrantError(new Error("invalid_grant"))).toBe(true);
    expect(isInvalidGrantError(new Error("lainnya"))).toBe(false);
    expect(isInvalidGrantError(null)).toBe(false);
  });
});
