import { describe, expect, it } from "vitest";

import { createMemoryCache, createMemoryLocker } from "@/lib/redis";
import type { CellValue, SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import { RegistryRepo, SCHOOL_COLUMNS } from "./RegistryRepo";

/** Fake registry: header sesuai SCHOOL_COLUMNS. */
function makeFake() {
  const calls = { batchGet: 0, append: 0, batchUpdate: 0 };
  const header: string[] = [...SCHOOL_COLUMNS];
  const idx = new Map(header.map((h, i) => [h, i]));
  const data: string[][] = [];
  const client: SheetsValuesClient = {
    async batchGet() {
      calls.batchGet += 1;
      return [{ range: "schools!A1:ZZ", values: [header, ...data] }];
    },
    async append(_id, _range, values: CellValue[][]) {
      calls.append += 1;
      for (const v of values) data.push(v.map((c) => String(c ?? "")));
    },
    async batchUpdate(_id, updates) {
      calls.batchUpdate += 1;
      for (const u of updates) {
        const m = u.range.match(/A(\d+):/);
        const n = Number(m?.[1]);
        const row = new Array(header.length).fill("");
        u.values[0].forEach((v, i) => {
          row[i] = String(v);
        });
        // kembalikan ke urutan header (di test ini sama dengan columns)
        void idx;
        data[n - 2] = row;
      }
    },
  };
  return { client, calls };
}

describe("RegistryRepo", () => {
  it("registerSchool append SATU baris dengan kolom lengkap", async () => {
    const fake = makeFake();
    const repo = new RegistryRepo(fake.client, "registry-1", {
      cache: createMemoryCache(),
      locker: createMemoryLocker(),
    });
    const school = await repo.registerSchool({
      slug: "SMPN-1",
      nama_sekolah: "SMPN 1",
      owner_email: "admin@sekolah.id",
      sheet_id: "sheet-abc",
      refresh_token_enc: "enc-token",
    });
    expect(fake.calls.append).toBe(1);
    expect(school.slug).toBe("smpn-1"); // dinormalisasi lowercase
    expect(school.school_id).not.toBe("");
    expect(school.status).toBe("aktif");
    expect(school.storage_adapter).toBe("sheets");
  });

  it("menolak slug duplikat", async () => {
    const fake = makeFake();
    const repo = new RegistryRepo(fake.client, "registry-1", {
      cache: createMemoryCache(),
      locker: createMemoryLocker(),
    });
    await repo.registerSchool({
      slug: "smpn-1",
      nama_sekolah: "SMPN 1",
      owner_email: "a@sekolah.id",
      sheet_id: "s1",
      refresh_token_enc: "t",
    });
    await expect(
      repo.registerSchool({
        slug: "SMPN-1",
        nama_sekolah: "SMPN 1 Baru",
        owner_email: "b@sekolah.id",
        sheet_id: "s2",
        refresh_token_enc: "t",
      })
    ).rejects.toThrow(/sudah dipakai/);
  });

  it("findBySlug case-insensitive + cache 10 menit (1 batchGet)", async () => {
    const fake = makeFake();
    const repo = new RegistryRepo(fake.client, "registry-1", {
      cache: createMemoryCache(),
      locker: createMemoryLocker(),
    });
    await repo.registerSchool({
      slug: "smpn-1",
      nama_sekolah: "SMPN 1",
      owner_email: "a@sekolah.id",
      sheet_id: "s1",
      refresh_token_enc: "t",
    });
    const before = fake.calls.batchGet;
    expect(await repo.findBySlug("SMPN-1")).not.toBeNull();
    // insert meng-invalidate cache, jadi baca pertama wajib 1 batchGet ...
    expect(fake.calls.batchGet).toBe(before + 1);
    // ... dan baca kedua murni dari cache 10 menit, tanpa read baru.
    expect(await repo.findBySlug("smpn-1")).not.toBeNull();
    expect(fake.calls.batchGet).toBe(before + 1);
  });

  it("markNeedsReconnect dan clearToken", async () => {
    const fake = makeFake();
    const repo = new RegistryRepo(fake.client, "registry-1", {
      cache: createMemoryCache(),
      locker: createMemoryLocker(),
    });
    const s = await repo.registerSchool({
      slug: "smpn-1",
      nama_sekolah: "SMPN 1",
      owner_email: "a@sekolah.id",
      sheet_id: "s1",
      refresh_token_enc: "t",
    });
    await repo.markNeedsReconnect(s.school_id);
    expect(await repo.findById(s.school_id)).toMatchObject({ status: "perlu_hubungkan_ulang" });
    await repo.clearToken(s.school_id);
    expect(await repo.findById(s.school_id)).toMatchObject({
      status: "nonaktif",
      refresh_token_enc: "",
    });
  });

  it("validasi input: email dan slug tidak valid ditolak", async () => {
    const fake = makeFake();
    const repo = new RegistryRepo(fake.client, "registry-1");
    await expect(
      repo.registerSchool({
        slug: "x",
        nama_sekolah: "S",
        owner_email: "bukan-email",
        sheet_id: "s",
        refresh_token_enc: "t",
      })
    ).rejects.toThrow();
  });
});
