import { describe, expect, it } from "vitest";

import { isSelfHostMode, selfHostSlug } from "./selfhost";

describe("isSelfHostMode", () => {
  it("true hanya bila DEPLOY_MODE=selfhost", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isSelfHostMode({ DEPLOY_MODE: "selfhost" } as any)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isSelfHostMode({ DEPLOY_MODE: "multitenant" } as any)).toBe(false);
  });
});

describe("selfHostSlug", () => {
  it("default 'sekolah' tanpa env", () => {
    // SELFHOST_SLUG tak diset di env test → default
    expect(selfHostSlug()).toBe("sekolah");
  });
});
