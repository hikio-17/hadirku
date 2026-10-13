import { describe, expect, it } from "vitest";

import { makeSheetsStore, seedTab } from "@/test/fakes/sheets-store";
import {
  ABSENSI_COLUMNS,
  GURU_COLUMNS,
  JADWAL_COLUMNS,
  KELAS_COLUMNS,
  LOG_PERUBAHAN_COLUMNS,
  MAPEL_COLUMNS,
  PENGAJUAN_IZIN_COLUMNS,
  PENGATURAN_COLUMNS,
  PENUGASAN_COLUMNS,
  SISWA_COLUMNS,
  TAHUN_AJARAN_COLUMNS,
  USERS_COLUMNS,
} from "@/lib/storage/sheets/columns";
import {
  approveIzin,
  editAbsensi,
  getDashboardGuru,
  getGuruProfil,
  getRekap,
  hariIndonesia,
  listRiwayat,
  saveAbsensi,
  todayWIB,
} from "./guru";

function makeStore() {
  return makeSheetsStore({
    users: seedTab(
      [...USERS_COLUMNS],
      [
        {
          id: "u-g1",
          nama: "Guru Satu",
          username: "guru.satu",
          password_hash: "h",
          role: "guru",
          aktif: "TRUE",
          wajib_ganti_password: "FALSE",
          dibuat_pada: "",
        },
        {
          id: "u-g2",
          nama: "Guru Dua",
          username: "guru.dua",
          password_hash: "h",
          role: "guru",
          aktif: "TRUE",
          wajib_ganti_password: "FALSE",
          dibuat_pada: "",
        },
        {
          id: "u-s1",
          nama: "Siswa Satu",
          username: "siswa.satu",
          password_hash: "h",
          role: "siswa",
          aktif: "TRUE",
          wajib_ganti_password: "FALSE",
          dibuat_pada: "",
        },
        {
          id: "u-s2",
          nama: "Siswa Dua",
          username: "siswa.dua",
          password_hash: "h",
          role: "siswa",
          aktif: "TRUE",
          wajib_ganti_password: "FALSE",
          dibuat_pada: "",
        },
      ]
    ),
    guru: seedTab(
      [...GURU_COLUMNS],
      [
        {
          id: "g1",
          user_id: "u-g1",
          nip: "",
          nama: "Guru Satu",
          is_wali_kelas: "TRUE",
          kelas_wali_id: "k1",
          aktif: "TRUE",
        },
        {
          id: "g2",
          user_id: "u-g2",
          nip: "",
          nama: "Guru Dua",
          is_wali_kelas: "FALSE",
          kelas_wali_id: "",
          aktif: "TRUE",
        },
      ]
    ),
    kelas: seedTab(
      [...KELAS_COLUMNS],
      [{ id: "k1", nama: "VII-A", tingkat: "7", tahun_ajaran_id: "ta1" }]
    ),
    mapel: seedTab([...MAPEL_COLUMNS], [{ id: "m1", nama: "Matematika", kode: "MTK" }]),
    tahun_ajaran: seedTab(
      [...TAHUN_AJARAN_COLUMNS],
      [{ id: "ta1", nama: "2026/2027", semester: "Ganjil", aktif: "TRUE" }]
    ),
    penugasan: seedTab(
      [...PENUGASAN_COLUMNS],
      [
        { id: "p1", guru_id: "g1", kelas_id: "k1", mapel_id: "m1", tahun_ajaran_id: "ta1" },
        { id: "p2", guru_id: "g2", kelas_id: "k1", mapel_id: "m1", tahun_ajaran_id: "ta1" },
      ]
    ),
    jadwal: seedTab(
      [...JADWAL_COLUMNS],
      [
        { id: "j1", penugasan_id: "p1", hari: "Senin", jam_mulai: "07:00", jam_selesai: "07:45" },
        { id: "j2", penugasan_id: "p2", hari: "Senin", jam_mulai: "08:00", jam_selesai: "08:45" },
      ]
    ),
    siswa: seedTab(
      [...SISWA_COLUMNS],
      [
        {
          id: "s1",
          user_id: "u-s1",
          nis: "1",
          nama: "Siswa Satu",
          kelas_id: "k1",
          jenis_kelamin: "L",
          aktif: "TRUE",
        },
        {
          id: "s2",
          user_id: "u-s2",
          nis: "2",
          nama: "Siswa Dua",
          kelas_id: "k1",
          jenis_kelamin: "P",
          aktif: "TRUE",
        },
      ]
    ),
    absensi: seedTab([...ABSENSI_COLUMNS], []),
    pengajuan_izin: seedTab([...PENGAJUAN_IZIN_COLUMNS], []),
    log_perubahan: seedTab([...LOG_PERUBAHAN_COLUMNS], []),
    pengaturan: seedTab(
      [...PENGATURAN_COLUMNS],
      [{ kunci: "ambang_kehadiran_rendah", nilai: "75" }]
    ),
  });
}

describe("tanggal WIB", () => {
  it("format YYYY-MM-DD dan nama hari", () => {
    expect(todayWIB(new Date("2026-10-12T17:00:00Z"))).toBe("2026-10-13"); // 00:00 WIB
    expect(hariIndonesia("2026-10-12")).toBe("Senin");
    expect(hariIndonesia("2026-10-13")).toBe("Selasa");
  });
});

describe("saveAbsensi", () => {
  it("baru → diubah → tetap + log", async () => {
    const { client, store, calls } = makeStore();
    const meta = { guruId: "g1", olehUserId: "u-g1" };
    const r1 = await saveAbsensi(
      client,
      "s1",
      {
        jadwalId: "j1",
        tanggal: "2026-10-12",
        entries: [
          { siswaId: "s1", status: "H", catatan: "" },
          { siswaId: "s2", status: "I", catatan: "pamit" },
        ],
      },
      meta
    );
    expect(r1).toEqual({ baru: 2, diubah: 0, tetap: 0 });

    const r2 = await saveAbsensi(
      client,
      "s1",
      {
        jadwalId: "j1",
        tanggal: "2026-10-12",
        entries: [
          { siswaId: "s1", status: "H", catatan: "" },
          { siswaId: "s2", status: "I", catatan: "pamit" },
        ],
      },
      meta
    );
    expect(r2).toEqual({ baru: 0, diubah: 0, tetap: 2 });

    const r3 = await saveAbsensi(
      client,
      "s1",
      {
        jadwalId: "j1",
        tanggal: "2026-10-12",
        entries: [
          { siswaId: "s1", status: "S", catatan: "demam" },
          { siswaId: "s2", status: "I", catatan: "pamit" },
        ],
      },
      meta
    );
    expect(r3).toEqual({ baru: 0, diubah: 1, tetap: 1 });
    expect(store.get("log_perubahan")).toHaveLength(2); // header + 1 log
    const log = store.get("log_perubahan")![1];
    expect(log[1]).toBe("absensi");
    expect(JSON.parse(log[4])).toMatchObject({ status: "H" });
    expect(JSON.parse(log[5])).toMatchObject({ status: "S", catatan: "demam" });
    // Hemat request: 1 append insert + 1 batchUpdate + 1 append log
    expect(calls.batchUpdate).toBe(1);
    expect(calls.append).toBe(2);
  });

  it("menolak jadwal milik guru lain", async () => {
    const { client } = makeStore();
    await expect(
      saveAbsensi(
        client,
        "s1",
        {
          jadwalId: "j2",
          tanggal: "2026-10-12",
          entries: [{ siswaId: "s1", status: "H", catatan: "" }],
        },
        { guruId: "g1", olehUserId: "u-g1" }
      )
    ).rejects.toThrow(/bukan penugasan/);
  });

  it("menolak siswa luar kelas", async () => {
    const { client } = makeStore();
    await expect(
      saveAbsensi(
        client,
        "s1",
        {
          jadwalId: "j1",
          tanggal: "2026-10-12",
          entries: [{ siswaId: "s-lain", status: "H", catatan: "" }],
        },
        { guruId: "g1", olehUserId: "u-g1" }
      )
    ).rejects.toThrow(/luar kelas/);
  });
});

describe("editAbsensi", () => {
  it("ubah milik sendiri + log; tolak milik orang", async () => {
    const { client, store } = makeStore();
    await saveAbsensi(
      client,
      "s1",
      {
        jadwalId: "j1",
        tanggal: "2026-10-12",
        entries: [{ siswaId: "s1", status: "H", catatan: "" }],
      },
      { guruId: "g1", olehUserId: "u-g1" }
    );
    const id = store.get("absensi")![1][0];
    await editAbsensi(
      client,
      "s1",
      { id, status: "A", catatan: "tanpa kabar" },
      { guruId: "g1", olehUserId: "u-g1" }
    );
    expect(store.get("absensi")![1][4]).toBe("A");
    expect(store.get("log_perubahan")).toHaveLength(2);
    // g2 mencoba ubah data g1
    await expect(
      editAbsensi(
        client,
        "s1",
        { id, status: "H", catatan: "" },
        { guruId: "g2", olehUserId: "u-g2" }
      )
    ).rejects.toThrow(/bukan dari kelas/);
  });
});

describe("approveIzin", () => {
  it("hanya wali kelas; tolak proses ganda", async () => {
    const { client, store } = makeStore();
    store.set(
      "pengajuan_izin",
      seedTab(
        [...PENGAJUAN_IZIN_COLUMNS],
        [
          {
            id: "z1",
            siswa_id: "s1",
            tanggal: "2026-10-13",
            jenis: "sakit",
            alasan: "demam",
            url_bukti: "",
            status: "menunggu",
            diproses_oleh: "",
          },
        ]
      )
    );
    const wali = (await getGuruProfil(client, "s1", "u-g1"))!;
    await approveIzin(client, "s1", { id: "z1", setuju: true }, { guru: wali, olehUserId: "u-g1" });
    expect(store.get("pengajuan_izin")![1][6]).toBe("disetujui");
    await expect(
      approveIzin(client, "s1", { id: "z1", setuju: false }, { guru: wali, olehUserId: "u-g1" })
    ).rejects.toThrow(/diproses/);
    const bukanWali = (await getGuruProfil(client, "s1", "u-g2"))!;
    store.set(
      "pengajuan_izin",
      seedTab(
        [...PENGAJUAN_IZIN_COLUMNS],
        [
          {
            id: "z2",
            siswa_id: "s1",
            tanggal: "2026-10-14",
            jenis: "izin",
            alasan: "acara",
            url_bukti: "",
            status: "menunggu",
            diproses_oleh: "",
          },
        ]
      )
    );
    await expect(
      approveIzin(client, "s1", { id: "z2", setuju: true }, { guru: bukanWali, olehUserId: "u-g2" })
    ).rejects.toThrow(/wali kelas/);
  });
});

describe("rekap & dashboard", () => {
  async function seedAbsensi() {
    const { client, store } = makeStore();
    await saveAbsensi(
      client,
      "s1",
      {
        jadwalId: "j1",
        tanggal: "2026-10-12",
        entries: [
          { siswaId: "s1", status: "H", catatan: "" },
          { siswaId: "s2", status: "A", catatan: "" },
        ],
      },
      { guruId: "g1", olehUserId: "u-g1" }
    );
    await saveAbsensi(
      client,
      "s1",
      {
        jadwalId: "j1",
        tanggal: "2026-10-13",
        entries: [
          { siswaId: "s1", status: "I", catatan: "" },
          { siswaId: "s2", status: "A", catatan: "" },
        ],
      },
      { guruId: "g1", olehUserId: "u-g1" }
    );
    return { client, store };
  }

  it("rekap: persen + flag rendah", async () => {
    const { client } = await seedAbsensi();
    const { rows } = await getRekap(client, "s1", "g1", {
      dari: "2026-10-12",
      sampai: "2026-10-13",
    });
    const s1 = rows.find((r) => r.siswa_id === "s1")!;
    const s2 = rows.find((r) => r.siswa_id === "s2")!;
    expect(s1).toMatchObject({ hadir: 1, izin: 1, total: 2, persen: 50, rendah: true });
    expect(s2).toMatchObject({ alpha: 2, persen: 0, rendah: true });
  });

  it("riwayat: filter status + pagination", async () => {
    const { client } = await seedAbsensi();
    const res = await listRiwayat(client, "s1", "g1", {
      dari: "2026-10-12",
      sampai: "2026-10-13",
      status: "A",
    });
    expect(res.total).toBe(2);
    expect(res.rows[0]).toMatchObject({ siswa_nama: "Siswa Dua", mapel_nama: "Matematika" });
  });

  it("dashboard: statistik, tren 7 hari, rendah, izin pending", async () => {
    const { client, store } = await seedAbsensi();
    store.set(
      "pengajuan_izin",
      seedTab(
        [...PENGAJUAN_IZIN_COLUMNS],
        [
          {
            id: "z1",
            siswa_id: "s2",
            tanggal: "2026-10-13",
            jenis: "sakit",
            alasan: "demam",
            url_bukti: "",
            status: "menunggu",
            diproses_oleh: "",
          },
        ]
      )
    );
    const guru = (await getGuruProfil(client, "s1", "u-g1"))!;
    const dash = await getDashboardGuru(client, "s1", guru, "2026-10-12");
    expect(dash.statistik).toMatchObject({ total: 2, hadir: 1, izin: 0, alpha: 1, belum: 0 });
    expect(dash.tren).toHaveLength(7);
    expect(dash.tren[6]).toMatchObject({ tanggal: "2026-10-12", adaData: true });
    expect(dash.rendah.map((r) => r.siswa_id).sort()).toEqual(["s1", "s2"]);
    expect(dash.izinPending).toHaveLength(1);
    expect(dash.izinPending[0]).toMatchObject({ bisaSetujui: true, siswa_nama: "Siswa Dua" });
  });
});
