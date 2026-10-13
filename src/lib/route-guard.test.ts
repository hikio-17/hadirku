import { describe, expect, it } from "vitest";

import { decideSchoolAccess } from "./route-guard";

const guruA = { slug: "smpn-1", role: "guru", mustChange: false };

describe("decideSchoolAccess", () => {
  it("path non-sekolah → allow", () => {
    expect(decideSchoolAccess("/", null)).toEqual({ allow: true });
    expect(decideSchoolAccess("/daftar", null)).toEqual({ allow: true });
  });

  it("login terbuka untuk anonim; user login terlempar ke gerbang", () => {
    expect(decideSchoolAccess("/s/smpn-1/login", null)).toEqual({ allow: true });
    expect(decideSchoolAccess("/s/smpn-1/login", guruA)).toEqual({ redirect: "/s/smpn-1" });
  });

  it("tanpa sesi → login + next", () => {
    expect(decideSchoolAccess("/s/smpn-1", null)).toEqual({
      redirect: "/s/smpn-1/login?next=%2Fs%2Fsmpn-1",
    });
    expect(decideSchoolAccess("/s/smpn-1/guru", null)).toEqual({
      redirect: "/s/smpn-1/login?next=%2Fs%2Fsmpn-1%2Fguru",
    });
  });

  it("lintas sekolah ditolak ke sekolah sendiri", () => {
    expect(decideSchoolAccess("/s/smpn-2/guru", guruA)).toEqual({ redirect: "/s/smpn-1" });
    expect(decideSchoolAccess("/s/smpn-2/login", guruA)).toEqual({ allow: true });
  });

  it("wajib ganti password → hanya ganti-password", () => {
    const wajib = { ...guruA, mustChange: true };
    expect(decideSchoolAccess("/s/smpn-1/guru", wajib)).toEqual({
      redirect: "/s/smpn-1/ganti-password",
    });
    expect(decideSchoolAccess("/s/smpn-1/ganti-password", wajib)).toEqual({ allow: true });
  });

  it("role dijaga per segmen", () => {
    expect(decideSchoolAccess("/s/smpn-1/admin", guruA)).toEqual({ redirect: "/s/smpn-1" });
    expect(decideSchoolAccess("/s/smpn-1/siswa", guruA)).toEqual({ redirect: "/s/smpn-1" });
    expect(decideSchoolAccess("/s/smpn-1/guru", guruA)).toEqual({ allow: true });
    const admin = { ...guruA, role: "admin" };
    expect(decideSchoolAccess("/s/smpn-1/admin", admin)).toEqual({ allow: true });
    expect(decideSchoolAccess("/s/smpn-1/guru", admin)).toEqual({ redirect: "/s/smpn-1" });
  });

  it("role tak dikenal di gerbang → login?error=hak", () => {
    expect(
      decideSchoolAccess("/s/smpn-1", { slug: "smpn-1", role: "tamu", mustChange: false })
    ).toEqual({ redirect: "/s/smpn-1/login?error=hak" });
  });
});
