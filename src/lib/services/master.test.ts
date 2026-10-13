import { describe, expect, it } from "vitest";

import { makeSheetsStore, seedTab } from "@/test/fakes/sheets-store";
import { KELAS_COLUMNS, SISWA_COLUMNS, TAHUN_AJARAN_COLUMNS } from "@/lib/storage/sheets/columns";
import {
  deleteKelas,
  deleteTahunAjaran,
  getPengaturan,
  listTahunAjaran,
  saveKelas,
  savePengaturan,
  saveTahunAjaran,
} from "./master";

const TA = seedTab(
  [...TAHUN_AJARAN_COLUMNS],
  [{ id: "ta1", nama: "2026/2027", semester: "Ganjil", aktif: "TRUE" }]
);

function makeStore() {
  return makeSheetsStore({
    tahun_ajaran: TA.map((r) => [...r]),
    kelas: seedTab(
      [...KELAS_COLUMNS],
      [{ id: "k1", nama: "VII-A", tingkat: "7", tahun_ajaran_id: "ta1" }]
    ),
    siswa: seedTab([...SISWA_COLUMNS], []),
    penugasan: [["id", "guru_id", "kelas_id", "mapel_id", "tahun_ajaran_id"]],
    pengaturan: [["kunci", "nilai"]],
  });
}

describe("master kelas", () => {
  it("menolak tahun ajaran tak dikenal", async () => {
    const { client } = makeStore();
    await expect(
      saveKelas(client, "s1", { nama: "VII-B", tingkat: "7", tahun_ajaran_id: "tak-ada" })
    ).rejects.toThrow(/Tahun ajaran/);
  });

  it("tambah kelas valid", async () => {
    const { client, store } = makeStore();
    await saveKelas(client, "s1", { nama: "VII-B", tingkat: "7", tahun_ajaran_id: "ta1" });
    expect(store.get("kelas")).toHaveLength(3);
  });

  it("hapus diblok bila dipakai siswa", async () => {
    const { client: c2, store: s2 } = makeSheetsStore({
      tahun_ajaran: TA.map((r) => [...r]),
      kelas: seedTab(
        [...KELAS_COLUMNS],
        [{ id: "k1", nama: "VII-A", tingkat: "7", tahun_ajaran_id: "ta1" }]
      ),
      siswa: seedTab(
        [...SISWA_COLUMNS],
        [
          {
            id: "s1",
            user_id: "u1",
            nis: "1",
            nama: "Ani",
            kelas_id: "k1",
            jenis_kelamin: "P",
            aktif: "TRUE",
          },
        ]
      ),
      penugasan: [["id", "guru_id", "kelas_id", "mapel_id", "tahun_ajaran_id"]],
    });
    await expect(
      deleteKelas(c2, "s1", "k1", {
        siswaCount: async (kelasId) =>
          s2
            .get("siswa")!
            .slice(1)
            .filter((r) => r[4] === kelasId && r[6] === "TRUE").length,
        penugasanCount: async () => 0,
      })
    ).rejects.toThrow(/dipakai siswa/);
  });
});

describe("tahun ajaran", () => {
  it("hanya satu yang aktif", async () => {
    const { client } = makeStore();
    await saveTahunAjaran(client, "s1", { nama: "2027/2028", semester: "Ganjil", aktif: true });
    const semua = await listTahunAjaran(client, "s1");
    expect(semua.filter((t) => t.aktif)).toHaveLength(1);
    expect(semua.find((t) => t.aktif)?.nama).toBe("2027/2028");
  });

  it("hapus diblok bila dipakai", async () => {
    const { client } = makeStore();
    await expect(
      deleteTahunAjaran(client, "s1", "ta1", { usedCount: async () => 2 })
    ).rejects.toThrow(/dipakai/);
  });
});

describe("pengaturan", () => {
  it("ambang di luar 0–100 ditolak", async () => {
    const { client } = makeStore();
    await expect(savePengaturan(client, "s1", { ambang_kehadiran_rendah: "150" })).rejects.toThrow(
      /0–100/
    );
  });

  it("upsert insert lalu update", async () => {
    const { client } = makeStore();
    await savePengaturan(client, "s1", { nama_sekolah: "SMPN 1", jam_pelajaran: "6 JP" });
    expect(await getPengaturan(client, "s1")).toMatchObject({ nama_sekolah: "SMPN 1" });
    await savePengaturan(client, "s1", { nama_sekolah: "SMPN 1 Bandung" });
    expect((await getPengaturan(client, "s1"))["nama_sekolah"]).toBe("SMPN 1 Bandung");
  });
});
