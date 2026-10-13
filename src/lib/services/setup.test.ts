import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { encryptToken } from "@/lib/crypto/token";
import { SCHOOL_TABS } from "@/lib/google/provision";
import { RegistryRepo, SCHOOL_COLUMNS } from "@/lib/registry/RegistryRepo";
import type { CellValue, SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import type { SetupSession } from "@/lib/setup-session";
import { completeSetup } from "./setup";

const KEY = randomBytes(32).toString("base64");

/** Fake spreadsheet sekolah multi-tab (header di-seed saat provision). */
function makeSchoolStore() {
  const store = new Map<string, string[][]>();
  const sheetOf = (range: string) => range.split("!")[0].replace(/^'|'$/g, "");
  const client: SheetsValuesClient = {
    async batchGet(_id, ranges) {
      return ranges.map((range) => ({ range, values: store.get(sheetOf(range)) ?? [] }));
    },
    async append(_id, range, values: CellValue[][]) {
      const rows = store.get(sheetOf(range)) ?? [];
      for (const v of values) rows.push(v.map((c) => String(c ?? "")));
      store.set(sheetOf(range), rows);
    },
    async batchUpdate(_id, updates) {
      for (const u of updates) {
        const [sheetPart, cellPart] = u.range.split("!");
        const n = Number(cellPart.match(/A(\d+):/)?.[1]);
        const rows = store.get(sheetPart.replace(/^'|'$/g, "")) ?? [];
        rows[n - 2] = u.values[0].map((c) => String(c));
        store.set(sheetPart.replace(/^'|'$/g, ""), rows);
      }
    },
  };
  return { client, store };
}

function makeRegistryFake() {
  const header: string[] = [...SCHOOL_COLUMNS];
  const data: string[][] = [];
  const client: SheetsValuesClient = {
    async batchGet() {
      return [{ range: "schools!A1:ZZ", values: [header, ...data] }];
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
  return { client };
}

const INPUT = {
  nama_sekolah: "SMPN 1 Bandung",
  slug: "smpn-1-bandung",
  nama_admin: "Operator",
  username_admin: "admin",
  password_admin: "rahasia123",
  tahun_ajaran_nama: "2026/2027",
  semester: "Ganjil",
  jam_pelajaran: "Senin-Jumat 07:00-12:00",
  persetujuan: true,
} as const;

const SESSION: SetupSession = {
  email: "op@sekolah.id",
  name: "Operator",
  refreshTokenEnc: encryptToken("rt-setup", KEY),
  createdAt: new Date().toISOString(),
};

async function makeDeps() {
  const school = makeSchoolStore();
  const titles: string[] = [];
  const google = {
    refresh: vi.fn(async () => ({ accessToken: "at-setup", expiresInSeconds: 3600 })),
    provision: vi.fn(async (_at: string, title: string) => {
      titles.push(title);
      for (const t of SCHOOL_TABS) school.store.set(t.name, [t.headers]);
      return "spread-baru";
    }),
    schoolSheets: () => school.client,
  };
  const registry = new RegistryRepo(makeRegistryFake().client, "registry-1");
  const deps = {
    registry,
    google,
    hashPassword: async (pw: string) => `hash:${pw}`,
    appUrl: "https://hadirku.example",
    tokenKey: KEY,
  };
  return { school, google, titles, deps, registry };
}

describe("completeSetup", () => {
  it("provision → seed → registry → URL login", async () => {
    const { school, google, titles, deps, registry } = await makeDeps();
    const result = await completeSetup({ ...INPUT }, SESSION, deps);

    expect(result).toEqual({
      schoolId: expect.any(String),
      slug: "smpn-1-bandung",
      loginUrl: "https://hadirku.example/s/smpn-1-bandung/login",
    });
    expect(titles).toEqual(["Hadirku - SMPN 1 Bandung"]);
    expect(google.refresh).toHaveBeenCalledTimes(1);

    const users = school.store.get("users")!;
    expect(users).toHaveLength(2);
    const admin = users[1];
    expect(admin[2]).toBe("admin"); // username
    expect(admin[3]).toBe("hash:rahasia123"); // password_hash (bukan plaintext)
    expect(admin[4]).toBe("admin");
    expect(admin[5]).toBe("TRUE");
    expect(admin[6]).toBe("TRUE"); // wajib ganti password saat login pertama

    const pengaturan = new Map(
      school.store
        .get("pengaturan")!
        .slice(1)
        .map((r) => [r[0], r[1]])
    );
    expect(pengaturan.get("nama_sekolah")).toBe("SMPN 1 Bandung");
    const taRows = school.store.get("tahun_ajaran")!;
    expect(taRows).toHaveLength(2);
    expect(pengaturan.get("tahun_ajaran_aktif")).toBe(taRows[1][0]);
    expect(pengaturan.get("jam_pelajaran")).toBe("Senin-Jumat 07:00-12:00");

    const saved = await registry.findBySlug("smpn-1-bandung");
    expect(saved).toMatchObject({
      nama_sekolah: "SMPN 1 Bandung",
      owner_email: "op@sekolah.id",
      sheet_id: "spread-baru",
      status: "aktif",
      refresh_token_enc: SESSION.refreshTokenEnc,
    });
  });

  it("slug bentrok dicek SEBELUM provisioning (tanpa spreadsheet yatim)", async () => {
    const { google, deps, registry } = await makeDeps();
    await registry.registerSchool({
      slug: "smpn-1-bandung",
      nama_sekolah: "Lain",
      owner_email: "x@y.id",
      sheet_id: "s-lama",
      refresh_token_enc: "t",
    });
    await expect(completeSetup({ ...INPUT }, SESSION, deps)).rejects.toThrow(/sudah dipakai/);
    expect(google.provision).not.toHaveBeenCalled();
  });

  it("tanpa persetujuan pengendali data ditolak", async () => {
    const { deps } = await makeDeps();
    const { persetujuan: _buang, ...tanpaSetuju } = { ...INPUT };
    void _buang;
    await expect(completeSetup(tanpaSetuju, SESSION, deps)).rejects.toThrow(/pengendali data/);
  });

  it("input tidak valid ditolak Zod (password pendek)", async () => {
    const { deps } = await makeDeps();
    await expect(
      completeSetup({ ...INPUT, password_admin: "pendek" }, SESSION, deps)
    ).rejects.toThrow(/minimal 8/);
  });

  it("sesi rusak → pesan ramah tanpa bocor token", async () => {
    const { deps } = await makeDeps();
    const bad: SetupSession = { ...SESSION, refreshTokenEnc: "bukan-base64-valid-!!!" };
    const err = await completeSetup({ ...INPUT }, bad, deps).catch((e) => e);
    expect(String(err.message)).toMatch(/Sesi setup/);
    expect(String(err.message)).not.toContain("bukan-base64");
  });
});
