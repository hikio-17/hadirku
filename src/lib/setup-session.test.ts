import { describe, expect, it } from "vitest";

import { createMemoryCache } from "@/lib/redis";
import { createSetupSession, deleteSetupSession, getSetupSession } from "./setup-session";

describe("setup session", () => {
  it("buat → baca → hapus", async () => {
    const cache = createMemoryCache();
    const id = await createSetupSession(
      {
        email: "op@sekolah.id",
        name: "Operator",
        refreshTokenEnc: "enc",
        createdAt: new Date().toISOString(),
      },
      cache
    );
    expect(id).not.toBe("");
    expect(await getSetupSession(id, cache)).toMatchObject({ email: "op@sekolah.id" });
    await deleteSetupSession(id, cache);
    expect(await getSetupSession(id, cache)).toBeNull();
  });

  it("ID tak dikenal → null", async () => {
    expect(await getSetupSession("tidak-ada", createMemoryCache())).toBeNull();
  });
});
