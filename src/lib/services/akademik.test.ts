import { describe, expect, it } from "vitest";

import { makeSheetsStore, seedTab } from "@/test/fakes/sheets-store";
import {
  ABSENSI_COLUMNS,
  GURU_COLUMNS,
  JADWAL_COLUMNS,
  KELAS_COLUMNS,
  MAPEL_COLUMNS,
  PENUGASAN_COLUMNS,
  SISWA_COLUMNS,
  TAHUN_AJARAN_COLUMNS,
  USERS_COLUMNS,
} from "@/lib/storage/sheets/columns";
import {
  deleteGuru,
  deletePenugasan,
  deleteSiswa,
  listPenugasan,
  saveGuru,
  saveJadwal,
  savePenugasan,
  saveSiswa,
} from "./akademik";

const U = (over: Record<string, string> = {}) => ({
  id: "u-g1",
  nama: "Guru Satu",
  username: "guru.satu",
  password_hash: "hash:x",
  role: "guru",
  aktif: "TRUE",
  wajib_ganti_password: "FALSE",
  dibuat_pada: "2026-01-01",
  ...over,
});

function makeStore() {
  return makeSheetsStore({
    users: seedTab(
      [...USERS_COLUMNS],
      [U(), U({ id: "u-s1", nama: "Siswa Satu", username: "siswa.satu", role: "siswa" })]
    ),
    guru: seedTab([...GURU_COLUMNS], []),
    siswa: seedTab([...SISWA_COLUMNS], []),
    kelas: seedTab(
      [...KELAS_COLUMNS],
      [{ id: "k1", nama: "VII-A", tingkat: "7", tahun_ajaran_id: "ta1" }]
    ),
    mapel: seedTab([...MAPEL_COLUMNS], [{ id: "m1", nama: "Matematika", kode: "MTK" }]),
    tahun_ajaran: seedTab(
      [...TAHUN_AJARAN_COLUMNS],
      [{ id: "ta1", nama: "2026/2027", semester: "Ganjil", aktif: "TRUE" }]
    ),
    penugasan: seedTab([...PENUGASAN_COLUMNS], []),
    jadwal: seedTab([...JADWAL_COLUMNS], []),
    absensi: seedTab([...ABSENSI_COLUMNS], []),
    pengajuan_izin: [
      ["id", "siswa_id", "tanggal", "jenis", "alasan", "url_bukti", "status", "diproses_oleh"],
    ],
  });
}

describe("guru", () => {
  it("menolak akun bukan guru", async () => {
    const { client } = makeStore();
    await expect(
      saveGuru(client, "s1", {
        user_id: "u-s1",
        nip: "",
        nama: "X",
        is_wali_kelas: false,
        kelas_wali_id: "",
      })
    ).rejects.toThrow(/login guru/);
  });

  it("simpan + tolak profil ganda + NIP ganda", async () => {
    const { client } = makeStore();
    await saveGuru(client, "s1", {
      user_id: "u-g1",
      nip: "N1",
      nama: "Guru Satu",
      is_wali_kelas: true,
      kelas_wali_id: "k1",
    });
    await expect(
      saveGuru(client, "s1", {
        user_id: "u-g1",
        nip: "",
        nama: "Lagi",
        is_wali_kelas: false,
        kelas_wali_id: "",
      })
    ).rejects.toThrow(/sudah punya profil/);
  });

  it("wali tanpa kelas ditolak; hapus diblok bila ada penugasan", async () => {
    const { client } = makeStore();
    await expect(
      saveGuru(client, "s1", {
        user_id: "u-g1",
        nip: "",
        nama: "G",
        is_wali_kelas: true,
        kelas_wali_id: "",
      })
    ).rejects.toThrow(/kelas wali/);
    await saveGuru(client, "s1", {
      user_id: "u-g1",
      nip: "",
      nama: "G",
      is_wali_kelas: false,
      kelas_wali_id: "",
    });
    await expect(deleteGuru(client, "s1", "xxx")).resolves.toBeUndefined();
  });

  it("hapus guru berpenugasan diblok", async () => {
    const { client, store } = makeStore();
    store.set(
      "guru",
      seedTab(
        [...GURU_COLUMNS],
        [
          {
            id: "g1",
            user_id: "u-g1",
            nip: "",
            nama: "G",
            is_wali_kelas: "FALSE",
            kelas_wali_id: "",
            aktif: "TRUE",
          },
        ]
      )
    );
    store.set(
      "penugasan",
      seedTab(
        [...PENUGASAN_COLUMNS],
        [{ id: "p1", guru_id: "g1", kelas_id: "k1", mapel_id: "m1", tahun_ajaran_id: "ta1" }]
      )
    );
    await expect(deleteGuru(client, "s1", "g1")).rejects.toThrow(/penugasan/);
  });
});

describe("siswa", () => {
  it("kelas tak dikenal & NIS ganda ditolak", async () => {
    const { client } = makeStore();
    await expect(
      saveSiswa(client, "s1", {
        user_id: "u-s1",
        nis: "1",
        nama: "S",
        kelas_id: "tak-ada",
        jenis_kelamin: "L",
      })
    ).rejects.toThrow(/Kelas/);
    await saveSiswa(client, "s1", {
      user_id: "u-s1",
      nis: "100",
      nama: "S",
      kelas_id: "k1",
      jenis_kelamin: "P",
    });
  });

  it("hapus diblok bila ada riwayat absensi", async () => {
    const { client, store } = makeStore();
    store.set(
      "siswa",
      seedTab(
        [...SISWA_COLUMNS],
        [
          {
            id: "s1",
            user_id: "u-s1",
            nis: "1",
            nama: "S",
            kelas_id: "k1",
            jenis_kelamin: "L",
            aktif: "TRUE",
          },
        ]
      )
    );
    store.set(
      "absensi",
      seedTab(
        [...ABSENSI_COLUMNS],
        [
          {
            id: "a1",
            tanggal: "2026-01-01",
            jadwal_id: "j1",
            siswa_id: "s1",
            status: "H",
            catatan: "",
            diinput_oleh: "u-g1",
            diinput_pada: "",
            diubah_pada: "",
          },
        ]
      )
    );
    await expect(deleteSiswa(client, "s1", "s1")).rejects.toThrow(/riwayat/);
  });
});

describe("penugasan & jadwal", () => {
  it("duplikat penugasan ditolak; list diperkaya nama", async () => {
    const { client, store } = makeStore();
    store.set(
      "guru",
      seedTab(
        [...GURU_COLUMNS],
        [
          {
            id: "g1",
            user_id: "u-g1",
            nip: "",
            nama: "Guru Satu",
            is_wali_kelas: "FALSE",
            kelas_wali_id: "",
            aktif: "TRUE",
          },
        ]
      )
    );
    await savePenugasan(client, "s1", {
      guru_id: "g1",
      kelas_id: "k1",
      mapel_id: "m1",
      tahun_ajaran_id: "ta1",
    });
    await expect(
      savePenugasan(client, "s1", {
        guru_id: "g1",
        kelas_id: "k1",
        mapel_id: "m1",
        tahun_ajaran_id: "ta1",
      })
    ).rejects.toThrow(/sudah ada/);
    const semua = await listPenugasan(client, "s1");
    expect(semua[0]).toMatchObject({
      guru_nama: "Guru Satu",
      kelas_nama: "VII-A",
      mapel_nama: "Matematika",
    });
  });

  it("jadwal jam terbalik ditolak; hapus penugasan berjadwal diblok", async () => {
    const { client, store } = makeStore();
    store.set(
      "penugasan",
      seedTab(
        [...PENUGASAN_COLUMNS],
        [{ id: "p1", guru_id: "g1", kelas_id: "k1", mapel_id: "m1", tahun_ajaran_id: "ta1" }]
      )
    );
    await expect(
      saveJadwal(client, "s1", {
        penugasan_id: "p1",
        hari: "Senin",
        jam_mulai: "09:00",
        jam_selesai: "07:30",
      })
    ).rejects.toThrow(/selesai/);
    await saveJadwal(client, "s1", {
      penugasan_id: "p1",
      hari: "Senin",
      jam_mulai: "07:00",
      jam_selesai: "07:45",
    });
    await expect(deletePenugasan(client, "s1", "p1")).rejects.toThrow(/jadwal/);
  });
});
