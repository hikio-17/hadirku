import { describe, expect, it } from "vitest";

import { makeSheetsStore, seedTab } from "@/test/fakes/sheets-store";
import { GURU_COLUMNS, USERS_COLUMNS } from "@/lib/storage/sheets/columns";
import {
  createUser,
  resetUserPassword,
  setUserActive,
  updateUser,
  userHasProfile,
} from "./pengguna";

const fakeHash = async (pw: string) => `hash:${pw}`;

function makeStore() {
  return makeSheetsStore({
    users: seedTab(
      [...USERS_COLUMNS],
      [
        {
          id: "u-admin",
          nama: "Admin",
          username: "admin",
          password_hash: "hash:x",
          role: "admin",
          aktif: "TRUE",
          wajib_ganti_password: "FALSE",
          dibuat_pada: "2026-01-01",
        },
      ]
    ),
    guru: seedTab([...GURU_COLUMNS], []),
    siswa: [["id", "user_id", "nis", "nama", "kelas_id", "jenis_kelamin", "aktif"]],
  });
}

describe("pengguna", () => {
  it("username duplikat ditolak", async () => {
    const { client } = makeStore();
    await expect(
      createUser(
        client,
        "s1",
        { nama: "Lain", username: "ADMIN", password: "rahasia123", role: "guru" },
        { hash: fakeHash }
      )
    ).rejects.toThrow(/sudah dipakai/);
  });

  it("buat akun: hash + wajib ganti", async () => {
    const { client, store } = makeStore();
    const row = await createUser(
      client,
      "s1",
      { nama: "Guru Baru", username: "guru.baru", password: "rahasia123", role: "guru" },
      { hash: fakeHash }
    );
    expect(row.password_hash).toBe("hash:rahasia123");
    expect(row.wajib_ganti_password).toBe(true);
    expect(store.get("users")).toHaveLength(3);
  });

  it("tidak bisa menonaktifkan diri sendiri", async () => {
    const { client } = makeStore();
    await expect(setUserActive(client, "s1", "u-admin", false, "u-admin")).rejects.toThrow(
      /sendiri/
    );
    await expect(
      updateUser(
        client,
        "s1",
        { id: "u-admin", nama: "Admin", role: "admin", aktif: false },
        { currentUserId: "u-admin" }
      )
    ).rejects.toThrow(/sendiri/);
  });

  it("ganti role diblok bila punya profil", async () => {
    const { client, store } = makeStore();
    store.set(
      "guru",
      seedTab(
        [...GURU_COLUMNS],
        [
          {
            id: "g1",
            user_id: "u-admin",
            nip: "",
            nama: "Admin",
            is_wali_kelas: "FALSE",
            kelas_wali_id: "",
            aktif: "TRUE",
          },
        ]
      )
    );
    expect(await userHasProfile(client, "s1", "u-admin")).toBe(true);
    await expect(
      updateUser(
        client,
        "s1",
        { id: "u-admin", nama: "Admin", role: "guru", aktif: true },
        { hasProfile: (uid) => userHasProfile(client, "s1", uid) }
      )
    ).rejects.toThrow(/profil/);
  });

  it("reset password: hash baru + wajib ganti", async () => {
    const { client, store } = makeStore();
    await resetUserPassword(
      client,
      "s1",
      { id: "u-admin", tempPassword: "sementara1" },
      { hash: fakeHash }
    );
    const row = store.get("users")![1];
    expect(row[3]).toBe("hash:sementara1");
    expect(row[6]).toBe("TRUE");
  });
});
