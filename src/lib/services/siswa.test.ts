import { describe, expect, it, vi } from "vitest";

import { createMemoryCache } from "@/lib/redis";
import { makeSheetsStore, seedTab } from "@/test/fakes/sheets-store";
import {
  ABSENSI_COLUMNS,
  JADWAL_COLUMNS,
  KELAS_COLUMNS,
  MAPEL_COLUMNS,
  PENGAJUAN_IZIN_COLUMNS,
  PENUGASAN_COLUMNS,
  SISWA_COLUMNS,
  TAHUN_AJARAN_COLUMNS,
} from "@/lib/storage/sheets/columns";
import {
  ajukanIzin,
  batalkanIzin,
  getBerandaSiswa,
  getSiswaProfil,
  listIzinSaya,
  uploadBuktiIzin,
} from "./siswa";

function makeStore() {
  return makeSheetsStore({
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
      ]
    ),
    kelas: seedTab(
      [...KELAS_COLUMNS],
      [{ id: "k1", nama: "VII-A", tingkat: "7", tahun_ajaran_id: "ta1" }]
    ),
    mapel: seedTab(
      [...MAPEL_COLUMNS],
      [
        { id: "m1", nama: "Matematika", kode: "MTK" },
        { id: "m2", nama: "IPA", kode: "IPA" },
      ]
    ),
    tahun_ajaran: seedTab(
      [...TAHUN_AJARAN_COLUMNS],
      [{ id: "ta1", nama: "2026/2027", semester: "Ganjil", aktif: "TRUE" }]
    ),
    penugasan: seedTab(
      [...PENUGASAN_COLUMNS],
      [
        { id: "p1", guru_id: "g1", kelas_id: "k1", mapel_id: "m1", tahun_ajaran_id: "ta1" },
        { id: "p2", guru_id: "g1", kelas_id: "k1", mapel_id: "m2", tahun_ajaran_id: "ta1" },
      ]
    ),
    jadwal: seedTab(
      [...JADWAL_COLUMNS],
      [
        { id: "j1", penugasan_id: "p1", hari: "Senin", jam_mulai: "07:00", jam_selesai: "07:45" },
        { id: "j2", penugasan_id: "p2", hari: "Senin", jam_mulai: "08:00", jam_selesai: "08:45" },
      ]
    ),
    absensi: seedTab(
      [...ABSENSI_COLUMNS],
      [
        {
          id: "a1",
          tanggal: "2026-10-05",
          jadwal_id: "j1",
          siswa_id: "s1",
          status: "H",
          catatan: "",
          diinput_oleh: "u-g1",
          diinput_pada: "",
          diubah_pada: "",
        },
        {
          id: "a2",
          tanggal: "2026-10-05",
          jadwal_id: "j2",
          siswa_id: "s1",
          status: "A",
          catatan: "",
          diinput_oleh: "u-g1",
          diinput_pada: "",
          diubah_pada: "",
        },
        {
          id: "a3",
          tanggal: "2026-10-06",
          jadwal_id: "j1",
          siswa_id: "s1",
          status: "I",
          catatan: "",
          diinput_oleh: "u-g1",
          diinput_pada: "",
          diubah_pada: "",
        },
      ]
    ),
    pengajuan_izin: seedTab([...PENGAJUAN_IZIN_COLUMNS], []),
  });
}

describe("beranda siswa", () => {
  it("persen, per mapel, kalender status terberat, riwayat", async () => {
    const { client } = makeStore();
    const siswa = (await getSiswaProfil(client, "s1", "u-s1"))!;
    expect(siswa.nama).toBe("Siswa Satu");
    const b = await getBerandaSiswa(client, "s1", siswa, "2026-10");
    expect(b.counts).toMatchObject({ hadir: 1, izin: 1, alpha: 1, total: 3 });
    expect(b.persen).toBe(33);
    expect(b.perMapel).toHaveLength(2);
    expect(b.perMapel.find((m) => m.mapel_nama === "Matematika")).toMatchObject({
      persen: 50,
      total: 2,
    });
    // 5 Okt: H + A → tampil A (terberat)
    expect(b.kalender.find((k) => k.tanggal === "2026-10-05")).toMatchObject({ status: "A" });
    expect(b.kalender.find((k) => k.tanggal === "2026-10-06")).toMatchObject({ status: "I" });
    expect(b.kalender.find((k) => k.tanggal === "2026-10-07")).toMatchObject({ status: null });
    expect(b.kalender).toHaveLength(31);
    expect(b.riwayat[0]).toMatchObject({ tanggal: "2026-10-06" });
  });

  it("tanpa data → 100% kosong", async () => {
    const { client } = makeStore();
    const siswa = (await getSiswaProfil(client, "s1", "u-s1"))!;
    const b = await getBerandaSiswa(client, "s1", { ...siswa, id: "s-lain" }, "2026-10");
    expect(b.persen).toBe(100);
    expect(b.perMapel).toEqual([]);
  });

  it("profil tak ada → null", async () => {
    const { client } = makeStore();
    expect(await getSiswaProfil(client, "s1", "hantu")).toBeNull();
  });
});

describe("pengajuan izin", () => {
  it("sukses + duplikat pending diblok + validasi", async () => {
    const { client, store } = makeStore();
    const row = await ajukanIzin(
      client,
      "s1",
      "s1",
      {
        tanggal: "2026-10-20",
        jenis: "sakit",
        alasan: "Demam tinggi sejak malam",
      },
      "https://drive.google.com/file/d/x/view"
    );
    expect(row.status).toBe("menunggu");
    expect(store.get("pengajuan_izin")).toHaveLength(2);
    await expect(
      ajukanIzin(client, "s1", "s1", {
        tanggal: "2026-10-20",
        jenis: "izin",
        alasan: "Ada acara keluarga penting",
      })
    ).rejects.toThrow(/menunggu/);
    await expect(
      ajukanIzin(client, "s1", "s1", { tanggal: "2026-10-21", jenis: "izin", alasan: "pendek" })
    ).rejects.toThrow(/10 karakter/);
    const saya = await listIzinSaya(client, "s1", "s1");
    expect(saya[0]).toMatchObject({ bisaBatal: true });
  });

  it("batalkan: milik + menunggu saja", async () => {
    const { client } = makeStore();
    const row = await ajukanIzin(client, "s1", "s1", {
      tanggal: "2026-10-20",
      jenis: "izin",
      alasan: "Ada acara keluarga penting",
    });
    await batalkanIzin(client, "s1", "s1", row.id);
    expect(await listIzinSaya(client, "s1", "s1")).toHaveLength(0);
    await expect(batalkanIzin(client, "s1", "s-lain", row.id)).rejects.toThrow(/ditemukan/);
  });
});

describe("uploadBuktiIzin", () => {
  function makeDrive() {
    return {
      list: vi.fn(async () => ({ data: { files: [] } })),
      create: vi.fn(async (p: { requestBody: { name?: string; mimeType?: string } }) => ({
        data:
          p.requestBody.mimeType === "application/vnd.google-apps.folder"
            ? { id: "folder-1" }
            : { id: "file-1", webViewLink: "https://drive.google.com/file/d/file-1/view" },
      })),
    };
  }

  it("buat folder sekali, pakai ulang dari cache", async () => {
    const drive = { files: makeDrive() };
    const cache = createMemoryCache();
    const file = {
      buffer: new Uint8Array([1, 2, 3]),
      filename: "surat.jpg",
      mimeType: "image/jpeg",
    };
    const r1 = await uploadBuktiIzin(drive, cache, "sch1", file, "izin-s1-2026-10-20");
    expect(r1).toMatchObject({ fileId: "file-1", url: expect.stringContaining("file-1") });
    await uploadBuktiIzin(drive, cache, "sch1", file, "izin-s1-2026-10-21");
    expect(drive.files.list).toHaveBeenCalledTimes(1); // folder dari cache
    expect(drive.files.create).toHaveBeenCalledTimes(3); // 1 folder + 2 file
    const namaFile = drive.files.create.mock.calls[1][0].requestBody.name as string;
    expect(namaFile).toContain("izin-s1-2026-10-20");
  });

  it("validasi ukuran dan tipe", async () => {
    const drive = { files: makeDrive() };
    const cache = createMemoryCache();
    await expect(
      uploadBuktiIzin(
        drive,
        cache,
        "sch1",
        { buffer: new Uint8Array(3 * 1024 * 1024), filename: "a.jpg", mimeType: "image/jpeg" },
        "x"
      )
    ).rejects.toThrow(/2 MB/);
    await expect(
      uploadBuktiIzin(
        drive,
        cache,
        "sch1",
        { buffer: new Uint8Array([1]), filename: "a.exe", mimeType: "application/x-msdownload" },
        "x"
      )
    ).rejects.toThrow(/jpg, png/);
    await expect(
      uploadBuktiIzin(
        drive,
        cache,
        "sch1",
        { buffer: new Uint8Array(0), filename: "a.jpg", mimeType: "image/jpeg" },
        "x"
      )
    ).rejects.toThrow(/kosong/);
  });
});
