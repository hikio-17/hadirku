import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { decryptToken, encryptToken } from "@/lib/crypto/token";
import { RegistryRepo, SCHOOL_COLUMNS } from "@/lib/registry/RegistryRepo";
import type { CellValue, SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import { rotateRegistryTokens } from "./rotate";

const OLD_KEY = randomBytes(32).toString("base64");
const NEW_KEY = randomBytes(32).toString("base64");

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

describe("rotateRegistryTokens", () => {
  it("enkripsi ulang dengan kunci baru, status dipertahankan", async () => {
    const registry = new RegistryRepo(makeRegistryFake().client, "registry-1");
    const s1 = await registry.registerSchool({
      slug: "smpn-1",
      nama_sekolah: "SMPN 1",
      owner_email: "a@sekolah.id",
      sheet_id: "s1",
      refresh_token_enc: encryptToken("rt-1", OLD_KEY),
    });
    await registry.markNeedsReconnect(s1.school_id);
    const s2 = await registry.registerSchool({
      slug: "smpn-2",
      nama_sekolah: "SMPN 2",
      owner_email: "b@sekolah.id",
      sheet_id: "s2",
      refresh_token_enc: "sementara",
    });
    // Simulasi sekolah tanpa token tersimpan.
    await registry.updateRefreshToken(s2.school_id, "", s2.status);

    const out = await rotateRegistryTokens(registry, OLD_KEY, NEW_KEY);
    expect(out).toEqual({ rotated: 1, skipped: 1 });

    const after = (await registry.findById(s1.school_id))!;
    expect(decryptToken(after.refresh_token_enc, NEW_KEY)).toBe("rt-1");
    expect(after.status).toBe("perlu_hubungkan_ulang"); // status tidak ikut berubah
    expect(() => decryptToken(after.refresh_token_enc, OLD_KEY)).toThrow();
  });
});
