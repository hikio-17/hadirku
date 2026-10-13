import { describe, expect, it, vi } from "vitest";

import { SCHOOL_TABS, provisionSchoolSpreadsheet, type ProvisionSheetsLike } from "./provision";

describe("SCHOOL_TABS", () => {
  it("12 tab sesuai skema §4", () => {
    expect(SCHOOL_TABS.map((t) => t.name)).toEqual([
      "users",
      "guru",
      "siswa",
      "kelas",
      "mapel",
      "penugasan",
      "jadwal",
      "absensi",
      "pengajuan_izin",
      "log_perubahan",
      "tahun_ajaran",
      "pengaturan",
    ]);
  });

  it("header tab kunci sesuai spek", () => {
    const byName = new Map(SCHOOL_TABS.map((t) => [t.name, t.headers]));
    expect(byName.get("users")).toContain("password_hash");
    expect(byName.get("absensi")).toContain("status");
    expect(byName.get("pengaturan")).toEqual(["kunci", "nilai"]);
    expect(byName.get("tahun_ajaran")).toEqual(["id", "nama", "semester", "aktif"]);
  });
});

describe("provisionSchoolSpreadsheet", () => {
  it("create + tulis header, kembalikan ID", async () => {
    const provisioner: ProvisionSheetsLike = {
      createSpreadsheet: vi.fn(async () => "spread-1"),
      writeHeaders: vi.fn(async () => {}),
    };
    const id = await provisionSchoolSpreadsheet(provisioner, "Hadirku - SMPN 1");
    expect(id).toBe("spread-1");
    expect(provisioner.createSpreadsheet).toHaveBeenCalledWith("Hadirku - SMPN 1", SCHOOL_TABS);
    expect(provisioner.writeHeaders).toHaveBeenCalledWith("spread-1", SCHOOL_TABS);
  });

  it("gagal bila Google tidak mengembalikan ID", async () => {
    const provisioner: ProvisionSheetsLike = {
      createSpreadsheet: async () => "",
      writeHeaders: async () => {},
    };
    await expect(provisionSchoolSpreadsheet(provisioner, "X")).rejects.toThrow(
      /membuat spreadsheet/
    );
  });
});
