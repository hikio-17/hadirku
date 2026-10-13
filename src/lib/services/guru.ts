import "server-only";

import { SheetsTable, booleanCodec } from "@/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import {
  ABSENSI_COLUMNS,
  GURU_COLUMNS,
  JADWAL_COLUMNS,
  KELAS_COLUMNS,
  LOG_PERUBAHAN_COLUMNS,
  MAPEL_COLUMNS,
  PENGATURAN_COLUMNS,
  PENGAJUAN_IZIN_COLUMNS,
  PENUGASAN_COLUMNS,
  SISWA_COLUMNS,
  TAHUN_AJARAN_COLUMNS,
} from "@/lib/storage/sheets/columns";
import type {
  AbsensiRow,
  GuruRow,
  JadwalRow,
  LogPerubahanRow,
  PengaturanRow,
  PenugasanRow,
  PengajuanIzinRow,
  SiswaRow,
  TahunAjaranRow,
} from "@/lib/storage/types";
import type { StatusKehadiran } from "@/types";
import {
  approveIzinSchema,
  editAbsensiSchema,
  rekapFilterSchema,
  saveAbsensiSchema,
} from "@/lib/validations/guru";

// --- Tanggal (WIB) ---
const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** YYYY-MM-DD hari ini dalam zona Asia/Jakarta. */
export function todayWIB(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

/** Nama hari Indonesia untuk YYYY-MM-DD. */
export function hariIndonesia(tanggal: string): string {
  return HARI_ID[new Date(`${tanggal}T12:00:00`).getDay()];
}

export function tambahHari(tanggal: string, n: number): string {
  const d = new Date(`${tanggal}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// --- Tabel ---
function guruTable(sheets: SheetsValuesClient, sid: string) {
  return new SheetsTable<GuruRow>(sheets, sid, "guru", {
    columns: [...GURU_COLUMNS],
    codecs: { is_wali_kelas: booleanCodec, aktif: booleanCodec },
  });
}
function penugasanTable(sheets: SheetsValuesClient, sid: string) {
  return new SheetsTable<PenugasanRow>(sheets, sid, "penugasan", {
    columns: [...PENUGASAN_COLUMNS],
  });
}
function jadwalTable(sheets: SheetsValuesClient, sid: string) {
  return new SheetsTable<JadwalRow>(sheets, sid, "jadwal", { columns: [...JADWAL_COLUMNS] });
}
function siswaTable(sheets: SheetsValuesClient, sid: string) {
  return new SheetsTable<SiswaRow>(sheets, sid, "siswa", {
    columns: [...SISWA_COLUMNS],
    codecs: { aktif: booleanCodec },
  });
}
function absensiTable(sheets: SheetsValuesClient, sid: string) {
  return new SheetsTable<AbsensiRow>(sheets, sid, "absensi", { columns: [...ABSENSI_COLUMNS] });
}
function izinTable(sheets: SheetsValuesClient, sid: string) {
  return new SheetsTable<PengajuanIzinRow>(sheets, sid, "pengajuan_izin", {
    columns: [...PENGAJUAN_IZIN_COLUMNS],
  });
}
function logTable(sheets: SheetsValuesClient, sid: string) {
  return new SheetsTable<LogPerubahanRow>(sheets, sid, "log_perubahan", {
    columns: [...LOG_PERUBAHAN_COLUMNS],
  });
}

/** Profil guru untuk user login. null bila belum dibuatkan admin. */
export async function getGuruProfil(
  sheets: SheetsValuesClient,
  sid: string,
  userId: string
): Promise<GuruRow | null> {
  const rows = await guruTable(sheets, sid).findWhere((g) => g.user_id === userId && g.aktif);
  return rows[0] ?? null;
}

export async function getTahunAktifId(sheets: SheetsValuesClient, sid: string): Promise<string> {
  const rows = await new SheetsTable<TahunAjaranRow>(sheets, sid, "tahun_ajaran", {
    columns: [...TAHUN_AJARAN_COLUMNS],
    codecs: { aktif: booleanCodec },
  }).findAll();
  return rows.find((t) => t.aktif)?.id ?? "";
}

export async function getAmbangRendah(sheets: SheetsValuesClient, sid: string): Promise<number> {
  const rows = await new SheetsTable<PengaturanRow>(sheets, sid, "pengaturan", {
    columns: [...PENGATURAN_COLUMNS],
    idColumn: "kunci",
  }).findAll();
  const v = Number(rows.find((r) => r.kunci === "ambang_kehadiran_rendah")?.nilai);
  return Number.isFinite(v) && v > 0 && v <= 100 ? v : 75;
}

export interface PenugasanGuruView extends PenugasanRow {
  kelas_nama: string;
  mapel_nama: string;
}

/** Hanya penugasan milik guru ini (penegakan di server). */
export async function listPenugasanGuru(
  sheets: SheetsValuesClient,
  sid: string,
  guruId: string,
  taId?: string
): Promise<PenugasanGuruView[]> {
  const [tugas, kelas, mapel] = await Promise.all([
    penugasanTable(sheets, sid).findWhere(
      (p) => p.guru_id === guruId && (!taId || p.tahun_ajaran_id === taId)
    ),
    new SheetsTable(sheets, sid, "kelas", { columns: [...KELAS_COLUMNS] }).findAll(),
    new SheetsTable(sheets, sid, "mapel", { columns: [...MAPEL_COLUMNS] }).findAll(),
  ]);
  const kelasMap = new Map((kelas as { id: string; nama: string }[]).map((k) => [k.id, k.nama]));
  const mapelMap = new Map((mapel as { id: string; nama: string }[]).map((m) => [m.id, m.nama]));
  return tugas.map((t) => ({
    ...t,
    kelas_nama: kelasMap.get(t.kelas_id) ?? "-",
    mapel_nama: mapelMap.get(t.mapel_id) ?? "-",
  }));
}

export interface JadwalHariIni extends JadwalRow {
  kelas_id: string;
  kelas_nama: string;
  mapel_nama: string;
  total_siswa: number;
  sudah_diabsen: number;
}

export async function getJadwalHariIni(
  sheets: SheetsValuesClient,
  sid: string,
  guruId: string,
  tanggal: string
): Promise<JadwalHariIni[]> {
  const hari = hariIndonesia(tanggal);
  const tugas = await listPenugasanGuru(sheets, sid, guruId);
  const tugasIds = new Set(tugas.map((t) => t.id));
  const [jadwal, siswa, absensi] = await Promise.all([
    jadwalTable(sheets, sid).findWhere((j) => tugasIds.has(j.penugasan_id) && j.hari === hari),
    siswaTable(sheets, sid).findAll(),
    absensiTable(sheets, sid).findWhere((a) => a.tanggal === tanggal && tugasIds.has(a.jadwal_id)),
  ]);
  const tugasMap = new Map(tugas.map((t) => [t.id, t]));
  const siswaPerKelas = new Map<string, number>();
  for (const s of siswa) {
    if (!s.aktif) continue;
    siswaPerKelas.set(s.kelas_id, (siswaPerKelas.get(s.kelas_id) ?? 0) + 1);
  }
  const absenPerJadwal = new Map<string, number>();
  for (const a of absensi) {
    absenPerJadwal.set(a.jadwal_id, (absenPerJadwal.get(a.jadwal_id) ?? 0) + 1);
  }
  return jadwal
    .map((j) => {
      const t = tugasMap.get(j.penugasan_id)!;
      return {
        ...j,
        kelas_id: t.kelas_id,
        kelas_nama: t.kelas_nama,
        mapel_nama: t.mapel_nama,
        total_siswa: siswaPerKelas.get(t.kelas_id) ?? 0,
        sudah_diabsen: absenPerJadwal.get(j.id) ?? 0,
      };
    })
    .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
}

// --- Dashboard ---
export interface DashboardGuru {
  tanggal: string;
  statistik: {
    total: number;
    hadir: number;
    izin: number;
    sakit: number;
    alpha: number;
    belum: number;
  };
  jadwal: JadwalHariIni[];
  tren: { tanggal: string; persen: number; adaData: boolean }[];
  rendah: { siswa_id: string; nama: string; kelas_nama: string; persen: number }[];
  izinPending: IzinPending[];
}

export interface IzinPending extends PengajuanIzinRow {
  siswa_nama: string;
  kelas_nama: string;
  bisaSetujui: boolean;
}

export async function getDashboardGuru(
  sheets: SheetsValuesClient,
  sid: string,
  guru: GuruRow,
  tanggal: string,
  opts?: { kelasId?: string; mapelId?: string }
): Promise<DashboardGuru> {
  const [jadwalHariIniSemua, tugasSemua, siswa, kelas, absensiSemua, izinSemua, ambang] =
    await Promise.all([
      getJadwalHariIni(sheets, sid, guru.id, tanggal),
      listPenugasanGuru(sheets, sid, guru.id),
      siswaTable(sheets, sid).findAll(),
      new SheetsTable(sheets, sid, "kelas", { columns: [...KELAS_COLUMNS] }).findAll(),
      absensiTable(sheets, sid).findAll(),
      izinTable(sheets, sid).findAll(),
      getAmbangRendah(sheets, sid),
    ]);
  const tugas = tugasSemua.filter(
    (t) =>
      (!opts?.kelasId || t.kelas_id === opts.kelasId) &&
      (!opts?.mapelId || t.mapel_id === opts.mapelId)
  );
  const jadwalHariIni = jadwalHariIniSemua.filter((j) =>
    tugas.some((t) => t.id === j.penugasan_id)
  );
  const jadwalMap = new Map<string, { kelas_id: string }>();
  {
    const semuaJadwal = await jadwalTable(sheets, sid).findAll();
    for (const j of semuaJadwal) {
      const t = tugas.find((x) => x.id === j.penugasan_id);
      if (t) jadwalMap.set(j.id, { kelas_id: t.kelas_id });
    }
  }
  const absensiGuru = absensiSemua.filter((a) => jadwalMap.has(a.jadwal_id));
  const kelasMap = new Map((kelas as { id: string; nama: string }[]).map((k) => [k.id, k.nama]));
  const siswaMap = new Map(siswa.map((s) => [s.id, s]));

  // Statistik hari ini.
  const hariIni = absensiGuru.filter((a) => a.tanggal === tanggal);
  const kelasHariIni = new Set(jadwalHariIni.map((j) => j.kelas_id));
  const total = siswa.filter((s) => s.aktif && kelasHariIni.has(s.kelas_id)).length;
  const count = (st: StatusKehadiran) => hariIni.filter((a) => a.status === st).length;
  const hadir = count("H");
  const izin = count("I");
  const sakit = count("S");
  const alpha = count("A");
  const belum = Math.max(0, total - hariIni.length);

  // Tren 7 hari (persen hadir).
  const tren = Array.from({ length: 7 }, (_, i) => tambahHari(tanggal, i - 6)).map((tgl) => {
    const rows = absensiGuru.filter((a) => a.tanggal === tgl);
    return {
      tanggal: tgl,
      persen:
        rows.length === 0
          ? 0
          : Math.round((rows.filter((a) => a.status === "H").length / rows.length) * 100),
      adaData: rows.length > 0,
    };
  });

  // Kehadiran rendah (< ambang) di kelas yang diajar.
  const kelasDiajar = new Set(tugas.map((t) => t.kelas_id));
  const agg = new Map<string, { h: number; total: number }>();
  for (const a of absensiGuru) {
    const e = agg.get(a.siswa_id) ?? { h: 0, total: 0 };
    e.total += 1;
    if (a.status === "H") e.h += 1;
    agg.set(a.siswa_id, e);
  }
  const rendah = [...agg.entries()]
    .map(([siswa_id, e]) => {
      const s = siswaMap.get(siswa_id);
      return {
        siswa_id,
        nama: s?.nama ?? "-",
        kelas_nama: kelasMap.get(s?.kelas_id ?? "") ?? "-",
        persen: e.total === 0 ? 100 : Math.round((e.h / e.total) * 100),
        diKelas: s ? kelasDiajar.has(s.kelas_id) : false,
      };
    })
    .filter((r) => r.diKelas && r.persen < ambang)
    .sort((a, b) => a.persen - b.persen)
    .slice(0, 5);

  // Izin menunggu: bisa disetujui bila wali kelas siswa tersebut.
  const waliKelasId = guru.is_wali_kelas ? guru.kelas_wali_id : "";
  const izinPending: IzinPending[] = izinSemua
    .filter((p) => p.status === "menunggu")
    .map((p) => {
      const s = siswaMap.get(p.siswa_id);
      return {
        ...p,
        siswa_nama: s?.nama ?? "-",
        kelas_nama: kelasMap.get(s?.kelas_id ?? "") ?? "-",
        kelas_id: s?.kelas_id ?? "",
      };
    })
    .filter((p) => {
      const s = siswaMap.get(p.siswa_id);
      return s && (s.kelas_id === waliKelasId || tugas.some((t) => t.kelas_id === s.kelas_id));
    })
    .map((p) => ({ ...p, bisaSetujui: p.kelas_id === waliKelasId && waliKelasId !== "" }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  return {
    tanggal,
    statistik: { total, hadir, izin, sakit, alpha, belum },
    jadwal: jadwalHariIni,
    tren,
    rendah,
    izinPending,
  };
}

export interface JadwalGuruView extends JadwalRow {
  kelas_nama: string;
  mapel_nama: string;
}

const URUT_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Semua jadwal milik guru (untuk pemilih form absensi). */
export async function listJadwalGuru(
  sheets: SheetsValuesClient,
  sid: string,
  guruId: string
): Promise<JadwalGuruView[]> {
  const tugas = await listPenugasanGuru(sheets, sid, guruId);
  const ids = new Set(tugas.map((t) => t.id));
  const jadwal = await jadwalTable(sheets, sid).findAll();
  const map = new Map(tugas.map((t) => [t.id, t]));
  return jadwal
    .filter((j) => ids.has(j.penugasan_id))
    .map((j) => ({
      ...j,
      kelas_nama: map.get(j.penugasan_id)!.kelas_nama,
      mapel_nama: map.get(j.penugasan_id)!.mapel_nama,
    }))
    .sort(
      (a, b) =>
        URUT_HARI.indexOf(a.hari) - URUT_HARI.indexOf(b.hari) ||
        a.jam_mulai.localeCompare(b.jam_mulai)
    );
}

// --- Form input absensi ---
export interface AbsensiFormData {
  jadwal: (JadwalRow & { kelas_nama: string; mapel_nama: string }) | null;
  tanggal: string;
  siswa: { id: string; nama: string; nis: string; status: StatusKehadiran | ""; catatan: string }[];
}

export async function getAbsensiForm(
  sheets: SheetsValuesClient,
  sid: string,
  guruId: string,
  jadwalId: string,
  tanggal: string
): Promise<AbsensiFormData> {
  const jadwal = await jadwalTable(sheets, sid).findById(jadwalId);
  if (!jadwal) throw new Error("Jadwal tidak ditemukan.");
  const tugas = await penugasanTable(sheets, sid).findById(jadwal.penugasan_id);
  if (!tugas || tugas.guru_id !== guruId) {
    throw new Error("Jadwal ini bukan penugasan Anda.");
  }
  const [kelas, mapel, siswa, existing] = await Promise.all([
    new SheetsTable(sheets, sid, "kelas", { columns: [...KELAS_COLUMNS] }).findById(tugas.kelas_id),
    new SheetsTable(sheets, sid, "mapel", { columns: [...MAPEL_COLUMNS] }).findById(tugas.mapel_id),
    siswaTable(sheets, sid).findWhere((s) => s.kelas_id === tugas.kelas_id && s.aktif),
    absensiTable(sheets, sid).findWhere((a) => a.jadwal_id === jadwalId && a.tanggal === tanggal),
  ]);
  const ada = new Map(existing.map((a) => [a.siswa_id, a]));
  return {
    jadwal: {
      ...jadwal,
      kelas_nama: (kelas as { nama?: string } | null)?.nama ?? "-",
      mapel_nama: (mapel as { nama?: string } | null)?.nama ?? "-",
    },
    tanggal,
    siswa: siswa
      .sort((a, b) => a.nama.localeCompare(b.nama))
      .map((s) => ({
        id: s.id,
        nama: s.nama,
        nis: s.nis,
        status: (ada.get(s.id)?.status ?? "") as StatusKehadiran | "",
        catatan: ada.get(s.id)?.catatan ?? "",
      })),
  };
}

// --- Simpan absensi (upsert massal + log) ---
export interface SaveAbsensiResult {
  baru: number;
  diubah: number;
  tetap: number;
}

export async function saveAbsensi(
  sheets: SheetsValuesClient,
  sid: string,
  raw: unknown,
  meta: { guruId: string; olehUserId: string }
): Promise<SaveAbsensiResult> {
  const input = saveAbsensiSchema.parse(raw);
  const jadwal = await jadwalTable(sheets, sid).findById(input.jadwalId);
  if (!jadwal) throw new Error("Jadwal tidak ditemukan.");
  const tugas = await penugasanTable(sheets, sid).findById(jadwal.penugasan_id);
  if (!tugas || tugas.guru_id !== meta.guruId) {
    throw new Error("Jadwal ini bukan penugasan Anda.");
  }
  const siswaKelas = await siswaTable(sheets, sid).findWhere(
    (s) => s.kelas_id === tugas.kelas_id && s.aktif
  );
  const valid = new Set(siswaKelas.map((s) => s.id));
  // Entri ganda untuk siswa yang sama: pakai yang terakhir.
  const dedup = new Map(input.entries.map((e) => [e.siswaId, e]));
  for (const id of dedup.keys()) {
    if (!valid.has(id)) throw new Error("Ada siswa di luar kelas penugasan.");
  }

  const table = absensiTable(sheets, sid);
  const existing = await table.findWhere(
    (a) => a.jadwal_id === input.jadwalId && a.tanggal === input.tanggal
  );
  const bySiswa = new Map(existing.map((a) => [a.siswa_id, a]));
  const now = new Date().toISOString();

  const toInsert: AbsensiRow[] = [];
  const toUpdate: AbsensiRow[] = [];
  const logs: LogPerubahanRow[] = [];
  for (const e of dedup.values()) {
    const cur = bySiswa.get(e.siswaId);
    if (!cur) {
      toInsert.push({
        id: "",
        tanggal: input.tanggal,
        jadwal_id: input.jadwalId,
        siswa_id: e.siswaId,
        status: e.status,
        catatan: e.catatan,
        diinput_oleh: meta.olehUserId,
        diinput_pada: now,
        diubah_pada: now,
      });
    } else if (cur.status !== e.status || (cur.catatan ?? "") !== e.catatan) {
      toUpdate.push({ ...cur, status: e.status, catatan: e.catatan, diubah_pada: now });
      logs.push({
        id: "",
        tabel: "absensi",
        record_id: cur.id,
        aksi: "ubah",
        data_lama: JSON.stringify({ status: cur.status, catatan: cur.catatan ?? "" }),
        data_baru: JSON.stringify({ status: e.status, catatan: e.catatan }),
        oleh: meta.olehUserId,
        waktu: now,
      });
    }
  }
  if (toInsert.length > 0) await table.insertMany(toInsert);
  if (toUpdate.length > 0) await table.bulkUpdate(toUpdate);
  if (logs.length > 0) await logTable(sheets, sid).insertMany(logs);
  return {
    baru: toInsert.length,
    diubah: toUpdate.length,
    tetap: dedup.size - toInsert.length - toUpdate.length,
  };
}

// --- Rekap & riwayat ---
export interface RekapRow {
  siswa_id: string;
  nama: string;
  kelas_nama: string;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  total: number;
  persen: number;
  rendah: boolean;
}

export async function getRekap(
  sheets: SheetsValuesClient,
  sid: string,
  guruId: string,
  raw: unknown
): Promise<{ rows: RekapRow[]; dari: string; sampai: string }> {
  const f = rekapFilterSchema.parse(raw);
  const [tugas, jadwalSemua, siswaSemua, kelas, mapel, ambang] = await Promise.all([
    listPenugasanGuru(sheets, sid, guruId),
    jadwalTable(sheets, sid).findAll(),
    siswaTable(sheets, sid).findAll(),
    new SheetsTable(sheets, sid, "kelas", { columns: [...KELAS_COLUMNS] }).findAll(),
    new SheetsTable(sheets, sid, "mapel", { columns: [...MAPEL_COLUMNS] }).findAll(),
    getAmbangRendah(sheets, sid),
  ]);
  const tugasScope = tugas.filter(
    (t) => (!f.kelasId || t.kelas_id === f.kelasId) && (!f.mapelId || t.mapel_id === f.mapelId)
  );
  const jadwalScope = new Set(
    jadwalSemua.filter((j) => tugasScope.some((t) => t.id === j.penugasan_id)).map((j) => j.id)
  );
  const absensi = await absensiTable(sheets, sid).findAll();
  const dalam = absensi.filter(
    (a) => jadwalScope.has(a.jadwal_id) && a.tanggal >= f.dari && a.tanggal <= f.sampai
  );
  const kelasMap = new Map((kelas as { id: string; nama: string }[]).map((k) => [k.id, k.nama]));
  void mapel;
  const kelasScope = new Set(tugasScope.map((t) => t.kelas_id));
  const siswaScope = siswaSemua.filter((s) => s.aktif && kelasScope.has(s.kelas_id));
  const agg = new Map<string, { h: number; i: number; s: number; a: number }>();
  for (const r of dalam) {
    const e = agg.get(r.siswa_id) ?? { h: 0, i: 0, s: 0, a: 0 };
    if (r.status === "H") e.h += 1;
    else if (r.status === "I") e.i += 1;
    else if (r.status === "S") e.s += 1;
    else e.a += 1;
    agg.set(r.siswa_id, e);
  }
  const rows: RekapRow[] = siswaScope.map((s) => {
    const e = agg.get(s.id) ?? { h: 0, i: 0, s: 0, a: 0 };
    const total = e.h + e.i + e.s + e.a;
    const persen = total === 0 ? 100 : Math.round((e.h / total) * 100);
    return {
      siswa_id: s.id,
      nama: s.nama,
      kelas_nama: kelasMap.get(s.kelas_id) ?? "-",
      hadir: e.h,
      izin: e.i,
      sakit: e.s,
      alpha: e.a,
      total,
      persen,
      rendah: total > 0 && persen < ambang,
    };
  });
  rows.sort((a, b) => a.nama.localeCompare(b.nama));
  return { rows, dari: f.dari, sampai: f.sampai };
}

export interface RiwayatRow {
  id: string;
  tanggal: string;
  siswa_nama: string;
  kelas_nama: string;
  mapel_nama: string;
  status: StatusKehadiran;
  catatan: string;
}

export async function listRiwayat(
  sheets: SheetsValuesClient,
  sid: string,
  guruId: string,
  raw: unknown
): Promise<{ rows: RiwayatRow[]; total: number; page: number; pages: number }> {
  const f = rekapFilterSchema.parse(raw);
  const PER = 20;
  const [tugas, jadwalSemua, siswaSemua, kelas, mapel] = await Promise.all([
    listPenugasanGuru(sheets, sid, guruId),
    jadwalTable(sheets, sid).findAll(),
    siswaTable(sheets, sid).findAll(),
    new SheetsTable(sheets, sid, "kelas", { columns: [...KELAS_COLUMNS] }).findAll(),
    new SheetsTable(sheets, sid, "mapel", { columns: [...MAPEL_COLUMNS] }).findAll(),
  ]);
  const tugasScope = tugas.filter(
    (t) => (!f.kelasId || t.kelas_id === f.kelasId) && (!f.mapelId || t.mapel_id === f.mapelId)
  );
  const jadwalMap = new Map(
    jadwalSemua.filter((j) => tugasScope.some((t) => t.id === j.penugasan_id)).map((j) => [j.id, j])
  );
  const tugasMap = new Map(tugasScope.map((t) => [t.id, t]));
  const siswaMap = new Map(siswaSemua.map((s) => [s.id, s]));
  const kelasMap = new Map((kelas as { id: string; nama: string }[]).map((k) => [k.id, k.nama]));
  const mapelMap = new Map((mapel as { id: string; nama: string }[]).map((m) => [m.id, m.nama]));
  const absensi = await absensiTable(sheets, sid).findAll();
  const semua: RiwayatRow[] = [];
  for (const a of absensi) {
    if (!jadwalMap.has(a.jadwal_id)) continue;
    if (a.tanggal < f.dari || a.tanggal > f.sampai) continue;
    if (f.status && a.status !== f.status) continue;
    const s = siswaMap.get(a.siswa_id);
    const t = tugasMap.get(jadwalMap.get(a.jadwal_id)!.penugasan_id);
    if (!s || !t) continue;
    semua.push({
      id: a.id,
      tanggal: a.tanggal,
      siswa_nama: s.nama,
      kelas_nama: kelasMap.get(s.kelas_id) ?? "-",
      mapel_nama: mapelMap.get(t.mapel_id) ?? "-",
      status: a.status,
      catatan: a.catatan ?? "",
    });
  }
  semua.sort(
    (a, b) => b.tanggal.localeCompare(a.tanggal) || a.siswa_nama.localeCompare(b.siswa_nama)
  );
  const total = semua.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const page = Math.min(Math.max(1, f.page), pages);
  return { rows: semua.slice((page - 1) * PER, page * PER), total, page, pages };
}

// --- Ubah absensi + log ---
export async function editAbsensi(
  sheets: SheetsValuesClient,
  sid: string,
  raw: unknown,
  meta: { guruId: string; olehUserId: string }
): Promise<void> {
  const input = editAbsensiSchema.parse(raw);
  const table = absensiTable(sheets, sid);
  const cur = await table.findById(input.id);
  if (!cur) throw new Error("Data absensi tidak ditemukan.");
  const jadwal = await jadwalTable(sheets, sid).findById(cur.jadwal_id);
  const tugas = jadwal ? await penugasanTable(sheets, sid).findById(jadwal.penugasan_id) : null;
  if (!tugas || tugas.guru_id !== meta.guruId) {
    throw new Error("Data ini bukan dari kelas Anda.");
  }
  if (cur.status === input.status && (cur.catatan ?? "") === input.catatan) return;
  const now = new Date().toISOString();
  await table.update(input.id, { status: input.status, catatan: input.catatan, diubah_pada: now });
  await logTable(sheets, sid).insert({
    id: "",
    tabel: "absensi",
    record_id: cur.id,
    aksi: "ubah",
    data_lama: JSON.stringify({ status: cur.status, catatan: cur.catatan ?? "" }),
    data_baru: JSON.stringify({ status: input.status, catatan: input.catatan }),
    oleh: meta.olehUserId,
    waktu: now,
  });
}

export async function getAbsensiDenganLog(
  sheets: SheetsValuesClient,
  sid: string,
  guruId: string,
  absensiId: string
): Promise<{ row: RiwayatRow & { jadwal_id: string }; logs: LogPerubahanRow[] }> {
  const cur = await absensiTable(sheets, sid).findById(absensiId);
  if (!cur) throw new Error("Data absensi tidak ditemukan.");
  const jadwal = await jadwalTable(sheets, sid).findById(cur.jadwal_id);
  const tugas = jadwal ? await penugasanTable(sheets, sid).findById(jadwal.penugasan_id) : null;
  if (!tugas || tugas.guru_id !== guruId) throw new Error("Data ini bukan dari kelas Anda.");
  const [siswa, kelas, mapel] = await Promise.all([
    siswaTable(sheets, sid).findById(cur.siswa_id),
    new SheetsTable(sheets, sid, "kelas", { columns: [...KELAS_COLUMNS] }).findAll(),
    new SheetsTable(sheets, sid, "mapel", { columns: [...MAPEL_COLUMNS] }).findAll(),
  ]);
  const kelasMap = new Map((kelas as { id: string; nama: string }[]).map((k) => [k.id, k.nama]));
  const mapelMap = new Map((mapel as { id: string; nama: string }[]).map((m) => [m.id, m.nama]));
  const logs = await logTable(sheets, sid).findWhere(
    (l) => l.tabel === "absensi" && l.record_id === absensiId
  );
  logs.sort((a, b) => String(b["waktu"]).localeCompare(String(a["waktu"])));
  return {
    row: {
      id: cur.id,
      tanggal: cur.tanggal,
      siswa_nama: siswa?.nama ?? "-",
      kelas_nama: kelasMap.get(siswa?.kelas_id ?? "") ?? "-",
      mapel_nama: mapelMap.get(tugas.mapel_id) ?? "-",
      status: cur.status,
      catatan: cur.catatan ?? "",
      jadwal_id: cur.jadwal_id,
    },
    logs,
  };
}

// --- Persetujuan izin (khusus wali kelas) ---
export async function approveIzin(
  sheets: SheetsValuesClient,
  sid: string,
  raw: unknown,
  meta: { guru: GuruRow; olehUserId: string }
): Promise<void> {
  const input = approveIzinSchema.parse(raw);
  const table = izinTable(sheets, sid);
  const row = await table.findById(input.id);
  if (!row) throw new Error("Pengajuan tidak ditemukan.");
  if (row.status !== "menunggu") throw new Error("Pengajuan sudah diproses.");
  const siswa = await siswaTable(sheets, sid).findById(row.siswa_id);
  if (!siswa || !meta.guru.is_wali_kelas || meta.guru.kelas_wali_id !== siswa.kelas_id) {
    throw new Error("Hanya wali kelas yang boleh memproses pengajuan ini.");
  }
  await table.update(input.id, {
    status: input.setuju ? "disetujui" : "ditolak",
    diproses_oleh: meta.olehUserId,
  });
}
