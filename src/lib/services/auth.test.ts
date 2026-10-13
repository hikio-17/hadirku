import { describe, expect, it } from "vitest";

import { NeedsReconnectError } from "@/lib/google/oauth";
import type { CellValue, SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import { USERS_COLUMNS } from "@/lib/storage/sheets/columns";
import { changePassword, resetPasswordByAdmin, verifyCredentials, type VerifyDeps } from "./auth";

function makeTabularFake(header: string[], seed: string[][] = []) {
  const data: string[][] = [...seed];
  const client: SheetsValuesClient = {
    async batchGet() {
      return [{ range: "x!A1:ZZ", values: [header, ...data] }];
    },
    async append(_id, _range, values: CellValue[][]) {
      for (const v of values) data.push(v.map((c) => String(c ?? "")));
    },
    async batchUpdate(_id, updates) {
      for (const u of updates) {
        const n = Number(u.range.match(/A(\d+):/)?.[1]);
        data[n - 2] = u.values[0].map((c) => String(c));
      }
    },
  };
  return { client, data };
}

const compare = async (pw: string, hash: string) => hash === `hash:${pw}`;

/** Baris users mentah (string, seperti dari Sheets). */
function userRow(over: Record<string, string> = {}) {
  return {
    id: "u1",
    nama: "Guru A",
    username: "guru-a",
    password_hash: "hash:benar",
    role: "guru",
    aktif: "TRUE",
    wajib_ganti_password: "FALSE",
    dibuat_pada: "2026-01-01",
    ...over,
  };
}

async function makeDeps(opts?: {
  users?: Record<string, string>[];
  schoolStatus?: "aktif" | "nonaktif";
  brokenConnection?: boolean;
}): Promise<{ deps: VerifyDeps }> {
  const usersFake = makeTabularFake(
    [...USERS_COLUMNS],
    (opts?.users ?? [userRow()]).map((u) => [...USERS_COLUMNS].map((c) => u[c] ?? ""))
  );
  const school = {
    school_id: "sch-1",
    slug: "smpn-1",
    nama_sekolah: "SMPN 1",
    owner_email: "a@sekolah.id",
    sheet_id: "spread-1",
    refresh_token_enc: "enc",
    status: opts?.schoolStatus ?? "aktif",
    storage_adapter: "sheets",
    dibuat_pada: "",
    terakhir_aktif: "",
  } as const;
  const deps: VerifyDeps = {
    loadSchool: async (slug: string) =>
      slug.trim().toLowerCase() === "smpn-1" ? { ...school } : null,
    sheetsForSchool: async () => {
      if (opts?.brokenConnection) throw new NeedsReconnectError();
      return usersFake.client;
    },
    compare,
  };
  return { deps };
}

describe("verifyCredentials", () => {
  it("sukses → SafeUser TANPA password_hash", async () => {
    const { deps } = await makeDeps();
    const user = await verifyCredentials(
      { slug: "SMPN-1", username: "guru-a", password: "benar" },
      deps
    );
    expect(user).toEqual({
      id: "u1",
      name: "Guru A",
      username: "guru-a",
      role: "guru",
      schoolId: expect.any(String),
      slug: "smpn-1",
      mustChange: false,
    });
    expect(user).not.toHaveProperty("password_hash");
  });

  it("mustChange diteruskan dari wajib_ganti_password", async () => {
    const { deps } = await makeDeps({ users: [userRow({ wajib_ganti_password: "TRUE" })] });
    const user = await verifyCredentials(
      { slug: "smpn-1", username: "guru-a", password: "benar" },
      deps
    );
    expect(user?.mustChange).toBe(true);
  });

  it("null untuk: password salah, user tak dikenal, user nonaktif", async () => {
    const { deps } = await makeDeps({
      users: [userRow(), userRow({ id: "u2", username: "nonaktif", aktif: "FALSE" })],
    });
    expect(
      await verifyCredentials({ slug: "smpn-1", username: "guru-a", password: "salah" }, deps)
    ).toBeNull();
    expect(
      await verifyCredentials({ slug: "smpn-1", username: "hantu", password: "benar" }, deps)
    ).toBeNull();
    expect(
      await verifyCredentials({ slug: "smpn-1", username: "nonaktif", password: "benar" }, deps)
    ).toBeNull();
  });

  it("null untuk: slug tak dikenal, sekolah nonaktif, koneksi putus", async () => {
    const { deps } = await makeDeps();
    expect(
      await verifyCredentials({ slug: "lain", username: "guru-a", password: "benar" }, deps)
    ).toBeNull();
    const nonaktif = await makeDeps({ schoolStatus: "nonaktif" });
    expect(
      await verifyCredentials(
        { slug: "smpn-1", username: "guru-a", password: "benar" },
        nonaktif.deps
      )
    ).toBeNull();
    const broken = await makeDeps({ brokenConnection: true });
    expect(
      await verifyCredentials(
        { slug: "smpn-1", username: "guru-a", password: "benar" },
        broken.deps
      )
    ).toBeNull();
  });

  it("input tidak valid → null", async () => {
    const { deps } = await makeDeps();
    expect(await verifyCredentials({ slug: "", username: "", password: "" }, deps)).toBeNull();
    expect(await verifyCredentials(null, deps)).toBeNull();
  });
});

describe("changePassword", () => {
  const fakeOpts = { compare, hash: async (pw: string) => `hash:${pw}` };

  it("sukses: hash baru + flag wajib hilang", async () => {
    const fake = makeTabularFake(
      [...USERS_COLUMNS],
      [[...USERS_COLUMNS].map((c) => userRow({ wajib_ganti_password: "TRUE" })[c] ?? "")]
    );
    await changePassword(
      fake.client,
      "spread-1",
      {
        userId: "u1",
        oldPassword: "benar",
        newPassword: "baru1234",
      },
      fakeOpts
    );
    expect(fake.data[0][3]).toBe("hash:baru1234");
    expect(fake.data[0][6]).toBe("FALSE");
  });

  it("password lama salah → error", async () => {
    const fake = makeTabularFake(
      [...USERS_COLUMNS],
      [[...USERS_COLUMNS].map((c) => userRow()[c] ?? "")]
    );
    await expect(
      changePassword(
        fake.client,
        "spread-1",
        {
          userId: "u1",
          oldPassword: "keliru",
          newPassword: "baru1234",
        },
        fakeOpts
      )
    ).rejects.toThrow(/lama salah/);
  });

  it("password baru pendek / sama → error", async () => {
    const fake = makeTabularFake(
      [...USERS_COLUMNS],
      [[...USERS_COLUMNS].map((c) => userRow({ password_hash: "hash:lamalama" })[c] ?? "")]
    );
    await expect(
      changePassword(
        fake.client,
        "spread-1",
        {
          userId: "u1",
          oldPassword: "lamalama",
          newPassword: "pendek",
        },
        fakeOpts
      )
    ).rejects.toThrow(/minimal 8/);
    await expect(
      changePassword(
        fake.client,
        "spread-1",
        {
          userId: "u1",
          oldPassword: "lamalama",
          newPassword: "lamalama",
        },
        fakeOpts
      )
    ).rejects.toThrow(/berbeda/);
  });
});

describe("resetPasswordByAdmin", () => {
  it("set password sementara + wajib ganti", async () => {
    const fake = makeTabularFake(
      [...USERS_COLUMNS],
      [[...USERS_COLUMNS].map((c) => userRow()[c] ?? "")]
    );
    await resetPasswordByAdmin(
      fake.client,
      "spread-1",
      { targetUserId: "u1", tempPassword: "sementara1" },
      { hash: async (pw) => `hash:${pw}` }
    );
    expect(fake.data[0][3]).toBe("hash:sementara1");
    expect(fake.data[0][6]).toBe("TRUE");
  });
});
