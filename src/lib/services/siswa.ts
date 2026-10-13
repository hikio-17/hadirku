import "server-only";

import { Readable } from "node:stream";
import { SheetsTable } from "@/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import {
  ABSENSI_COLUMNS,
  JADWAL_COLUMNS,
  KELAS_COLUMNS,
  MAPEL_COLUMNS,
  PENGAJUAN_IZIN_COLUMNS,
  PENUGASAN_COLUMNS,
  SISWA_COLUMNS,
} from "@/lib/storage/sheets/columns";
import type { AbsensiRow, PengajuanIzinRow, SiswaRow } from "@/lib/storage/types";
import type { StatusKehadiran } from "@/types";
import { getTahunAktifId } from "@/lib/services/guru";
import type { Cache } from "@/lib/redis";
import { tenantKey } from "@/lib/redis";
import { BUKTI_EXT, BUKTI_MAX_BYTES, BUKTI_MIME, ajukanIzinSchema } from "@/lib/validations/siswa";

/** Profil siswa untuk user login. */
export async function getSiswaProfil(
  sheets: SheetsValuesClient,
  sid: string,
  userId: string
): Promise<SiswaRow | null> {
  const rows = await new SheetsTable<SiswaRow>(sheets, sid, "siswa", {
    columns: [...SISWA_COLUMNS],
  }).findAll();
  return rows.find((s) => s.user_id === userId) ?? null;
}

function absensiTable(sheets: SheetsValuesClient, sid: string) {
  return new SheetsTable<AbsensiRow>(sheets, sid, "absensi", { columns: [...ABSENSI_COLUMNS] });
}
function izinTable(sheets: SheetsValuesClient, sid: string) {
  return new SheetsTable<PengajuanIzinRow>(sheets, sid, "pengajuan_izin", {
    columns: [...PENGAJUAN_IZIN_COLUMNS],
  });
}

interface Cakupan {
  jadwalTaAktif: Set<string>;
  kelasNama: string;
}

/** Jadwal semester aktif + nama kelas untuk satu siswa. */
async function cakupanSiswa(
  sheets: SheetsValuesClient,
  sid: string,
  siswa: SiswaRow
): Promise<Cakupan> {
  const [taAktif, tugas, jadwal, kelas] = await Promise.all([
    getTahunAktifId(sheets, sid),
    new SheetsTable(sheets, sid, "penugasan", { columns: [...PENUGASAN_COLUMNS] }).findAll(),
    new SheetsTable(sheets, sid, "jadwal", { columns: [...JADWAL_COLUMNS] }).findAll(),
    new SheetsTable(sheets, sid, "kelas", { columns: [...KELAS_COLUMNS] }).findById(siswa.kelas_id),
  ]);
  const tugasIds = new Set(
    (tugas as { id: string; kelas_id: string; tahun_ajaran_id: string }[])
      .filter((t) => t.kelas_id === siswa.kelas_id && (!taAktif || t.tahun_ajaran_id === taAktif))
      .map((t) => t.id)
  );
  const jadwalTaAktif = new Set(
    (jadwal as { id: string; penugasan_id: string }[])
      .filter((j) => tugasIds.has(j.penugasan_id))
      .map((j) => j.id)
  );
  return { jadwalTaAktif, kelasNama: (kelas as { nama?: string } | null)?.nama ?? "-" };
}

export interface BerandaSiswa {
  persen: number;
  counts: { hadir: number; izin: number; sakit: number; alpha: number; total: number };
  perMapel: { mapel_id: string; mapel_nama: string; persen: number; total: number }[];
  kalender: { tanggal: string; status: StatusKehadiran | null }[];
  bulan: string;
  riwayat: { tanggal: string; mapel_nama: string; status: StatusKehadiran }[];
}

const BOBOT: Record<StatusKehadiran, number> = { A: 4, S: 3, I: 2, H: 1 };

export async function getBerandaSiswa(
  sheets: SheetsValuesClient,
  sid: string,
  siswa: SiswaRow,
  bulan: string
): Promise<BerandaSiswa> {
  const [cakupan, absensiSemua, mapelRows] = await Promise.all([
    cakupanSiswa(sheets, sid, siswa),
    absensiTable(sheets, sid).findAll(),
    new SheetsTable(sheets, sid, "mapel", { columns: [...MAPEL_COLUMNS] }).findAll(),
  ]);
  const milik = absensiSemua.filter(
    (a) => a.siswa_id === siswa.id && cakupan.jadwalTaAktif.has(a.jadwal_id)
  );
  const count = (st: StatusKehadiran) => milik.filter((a) => a.status === st).length;
  const counts = {
    hadir: count("H"),
    izin: count("I"),
    sakit: count("S"),
    alpha: count("A"),
    total: milik.length,
  };
  const persen = counts.total === 0 ? 100 : Math.round((counts.hadir / counts.total) * 100);

  const mapelNama = new Map(
    (mapelRows as { id: string; nama: string }[]).map((m) => [m.id, m.nama])
  );
  const perJadwalMapel = new Map<string, string>();
  {
    const [tugas, jadwal] = await Promise.all([
      new SheetsTable(sheets, sid, "penugasan", { columns: [...PENUGASAN_COLUMNS] }).findAll(),
      new SheetsTable(sheets, sid, "jadwal", { columns: [...JADWAL_COLUMNS] }).findAll(),
    ]);
    const tMap = new Map(
      (tugas as { id: string; mapel_id: string }[]).map((t) => [t.id, t.mapel_id])
    );
    for (const j of jadwal as { id: string; penugasan_id: string }[]) {
      const mid = tMap.get(j.penugasan_id);
      if (mid) perJadwalMapel.set(j.id, mid);
    }
  }
  const agg = new Map<string, { h: number; total: number }>();
  for (const a of milik) {
    const mid = perJadwalMapel.get(a.jadwal_id) ?? "?";
    const e = agg.get(mid) ?? { h: 0, total: 0 };
    e.total += 1;
    if (a.status === "H") e.h += 1;
    agg.set(mid, e);
  }
  const perMapel = [...agg.entries()]
    .map(([mapel_id, e]) => ({
      mapel_id,
      mapel_nama: mapelNama.get(mapel_id) ?? "-",
      persen: e.total === 0 ? 100 : Math.round((e.h / e.total) * 100),
      total: e.total,
    }))
    .sort((a, b) => a.mapel_nama.localeCompare(b.mapel_nama));

  // Kalender bulan berjalan: status terberat per tanggal.
  const [th, bl] = bulan.split("-").map(Number);
  const nHari = new Date(th, bl, 0).getDate();
  const perTanggal = new Map<string, StatusKehadiran[]>();
  for (const a of milik) {
    if (!a.tanggal.startsWith(bulan)) continue;
    const list = perTanggal.get(a.tanggal) ?? [];
    list.push(a.status);
    perTanggal.set(a.tanggal, list);
  }
  const kalender: BerandaSiswa["kalender"] = [];
  for (let d = 1; d <= nHari; d++) {
    const tanggal = `${bulan}-${String(d).padStart(2, "0")}`;
    const list = perTanggal.get(tanggal) ?? [];
    list.sort((a, b) => BOBOT[b] - BOBOT[a]);
    kalender.push({ tanggal, status: list[0] ?? null });
  }

  const riwayat = [...milik]
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    .slice(0, 20)
    .map((a) => ({
      tanggal: a.tanggal,
      mapel_nama: mapelNama.get(perJadwalMapel.get(a.jadwal_id) ?? "") ?? "-",
      status: a.status,
    }));

  return { persen, counts, perMapel, kalender, bulan, riwayat };
}

// --- Pengajuan izin/sakit ---
export interface IzinSaya extends PengajuanIzinRow {
  bisaBatal: boolean;
}

export async function listIzinSaya(
  sheets: SheetsValuesClient,
  sid: string,
  siswaId: string
): Promise<IzinSaya[]> {
  const rows = await izinTable(sheets, sid).findWhere((p) => p.siswa_id === siswaId);
  rows.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  return rows.slice(0, 20).map((r) => ({ ...r, bisaBatal: r.status === "menunggu" }));
}

export async function ajukanIzin(
  sheets: SheetsValuesClient,
  sid: string,
  siswaId: string,
  raw: unknown,
  buktiUrl = ""
): Promise<PengajuanIzinRow> {
  const input = ajukanIzinSchema.parse(raw);
  const table = izinTable(sheets, sid);
  const ganda = await table.findWhere(
    (p) => p.siswa_id === siswaId && p.tanggal === input.tanggal && p.status === "menunggu"
  );
  if (ganda.length > 0) {
    throw new Error("Sudah ada pengajuan menunggu untuk tanggal tersebut.");
  }
  const [row] = await table.insertMany([
    {
      id: "",
      siswa_id: siswaId,
      tanggal: input.tanggal,
      jenis: input.jenis,
      alasan: input.alasan,
      url_bukti: buktiUrl,
      status: "menunggu",
      diproses_oleh: "",
    },
  ]);
  return row;
}

export async function batalkanIzin(
  sheets: SheetsValuesClient,
  sid: string,
  siswaId: string,
  izinId: string
): Promise<void> {
  const table = izinTable(sheets, sid);
  const row = await table.findById(izinId);
  if (!row || row.siswa_id !== siswaId) throw new Error("Pengajuan tidak ditemukan.");
  if (row.status !== "menunggu")
    throw new Error("Pengajuan sudah diproses, tidak bisa dibatalkan.");
  await table.softDelete(izinId);
}

// --- Upload bukti ke Drive sekolah ---
export interface DriveLike {
  files: {
    list: (params: {
      q: string;
      fields: string;
      spaces: string;
    }) => Promise<{ data: { files?: { id?: string | null }[] } }>;
    create: (params: {
      requestBody: { name: string; mimeType?: string; parents?: string[] };
      media: { mimeType: string; body: unknown };
      fields: string;
    }) => Promise<{ data: { id?: string | null; webViewLink?: string | null } }>;
  };
}

export const FOLDER_BUKTI = "Hadirku - Bukti Izin";

export interface BuktiFile {
  buffer: Uint8Array;
  filename: string;
  mimeType: string;
}

export function sanitasiNamaFile(nama: string): string {
  const base = nama.split("/").pop() ?? "bukti";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "bukti";
}

export async function uploadBuktiIzin(
  drive: DriveLike,
  cache: Cache,
  schoolId: string,
  file: BuktiFile,
  prefix: string
): Promise<{ fileId: string; url: string }> {
  if (file.buffer.byteLength === 0) throw new Error("File bukti kosong.");
  if (file.buffer.byteLength > BUKTI_MAX_BYTES) {
    throw new Error("Ukuran bukti maksimal 2 MB.");
  }
  const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
  if (!(BUKTI_EXT as readonly string[]).includes(ext)) {
    throw new Error("Bukti harus jpg, png, atau pdf.");
  }
  if (!(BUKTI_MIME as readonly string[]).includes(file.mimeType)) {
    throw new Error("Tipe file bukti tidak didukung.");
  }

  const folderKey = tenantKey(schoolId, "drive", "folder-izin");
  let folderId = await cache.get<string>(folderKey);
  if (!folderId) {
    const found = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_BUKTI}' and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });
    folderId = found.data.files?.[0]?.id ?? null;
    if (!folderId) {
      const created = await drive.files.create({
        requestBody: { name: FOLDER_BUKTI, mimeType: "application/vnd.google-apps.folder" },
        media: { mimeType: "application/vnd.google-apps.folder", body: null },
        fields: "id",
      });
      folderId = created.data.id ?? null;
    }
    if (!folderId) throw new Error("Gagal menyiapkan folder bukti di Drive.");
    await cache.set(folderKey, folderId, 24 * 3600);
  }

  const created = await drive.files.create({
    requestBody: { name: `${prefix}-${sanitasiNamaFile(file.filename)}`, parents: [folderId] },
    media: { mimeType: file.mimeType, body: Readable.from(Buffer.from(file.buffer)) },
    fields: "id,webViewLink",
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error("Gagal mengunggah bukti.");
  return {
    fileId,
    url: created.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  };
}
