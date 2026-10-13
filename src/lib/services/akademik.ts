import "server-only";

import { SheetsTable, booleanCodec } from "@/lib/storage/sheets/SheetsTable";
import type { SheetsValuesClient } from "@/lib/storage/sheets/SheetsTable";
import {
  ABSENSI_COLUMNS,
  GURU_COLUMNS,
  JADWAL_COLUMNS,
  KELAS_COLUMNS,
  MAPEL_COLUMNS,
  PENGAJUAN_IZIN_COLUMNS,
  PENUGASAN_COLUMNS,
  SISWA_COLUMNS,
  TAHUN_AJARAN_COLUMNS,
  USERS_COLUMNS,
} from "@/lib/storage/sheets/columns";
import type { GuruRow, JadwalRow, PenugasanRow, SiswaRow, UserRow } from "@/lib/storage/types";
import {
  upsertGuruSchema,
  upsertJadwalSchema,
  upsertPenugasanSchema,
  upsertSiswaSchema,
} from "@/lib/validations/admin";

function guruTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<GuruRow>(sheets, spreadsheetId, "guru", {
    columns: [...GURU_COLUMNS],
    codecs: { is_wali_kelas: booleanCodec, aktif: booleanCodec },
  });
}

function siswaTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<SiswaRow>(sheets, spreadsheetId, "siswa", {
    columns: [...SISWA_COLUMNS],
    codecs: { aktif: booleanCodec },
  });
}

function usersTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<UserRow>(sheets, spreadsheetId, "users", {
    columns: [...USERS_COLUMNS],
    codecs: { aktif: booleanCodec, wajib_ganti_password: booleanCodec },
  });
}

function penugasanTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<PenugasanRow>(sheets, spreadsheetId, "penugasan", {
    columns: [...PENUGASAN_COLUMNS],
  });
}

function jadwalTable(sheets: SheetsValuesClient, spreadsheetId: string) {
  return new SheetsTable<JadwalRow>(sheets, spreadsheetId, "jadwal", {
    columns: [...JADWAL_COLUMNS],
  });
}

// --- Guru ---
export interface GuruView extends GuruRow {
  username: string;
  kelas_wali_nama: string;
}

export async function listGuru(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<GuruView[]> {
  const [guru, users, kelas] = await Promise.all([
    guruTable(sheets, spreadsheetId).findAll(),
    usersTable(sheets, spreadsheetId).findAll(),
    new SheetsTable(sheets, spreadsheetId, "kelas", { columns: [...KELAS_COLUMNS] }).findAll(),
  ]);
  const usernameOf = new Map(users.map((u) => [u.id, u.username]));
  const kelasOf = new Map((kelas as { id: string; nama: string }[]).map((k) => [k.id, k.nama]));
  return guru.map((g) => ({
    ...g,
    username: usernameOf.get(g.user_id) ?? "-",
    kelas_wali_nama: g.kelas_wali_id ? (kelasOf.get(g.kelas_wali_id) ?? "-") : "-",
  }));
}

/** Akun login role guru yang belum punya profil (untuk select form). */
export async function listGuruTersedia(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<UserRow[]> {
  const [users, guru] = await Promise.all([
    usersTable(sheets, spreadsheetId).findAll(),
    guruTable(sheets, spreadsheetId).findAll(),
  ]);
  const terpakai = new Set(guru.map((g) => g.user_id));
  return users.filter((u) => u.role === "guru" && u.aktif && !terpakai.has(u.id));
}

export async function saveGuru(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown
): Promise<void> {
  const input = upsertGuruSchema.parse(raw);
  const user = await usersTable(sheets, spreadsheetId).findById(input.user_id);
  if (!user || user.role !== "guru") throw new Error("Akun login guru tidak valid.");
  if (input.nip) {
    const sama = await guruTable(sheets, spreadsheetId).findWhere(
      (g) => g.nip === input.nip && g.id !== (input.id ?? "")
    );
    if (sama.length > 0) throw new Error(`NIP "${input.nip}" sudah dipakai.`);
  }
  if (input.is_wali_kelas) {
    if (!input.kelas_wali_id) throw new Error("Pilih kelas wali bila menjadi wali kelas.");
    const kelas = await new SheetsTable(sheets, spreadsheetId, "kelas", {
      columns: [...KELAS_COLUMNS],
    }).findById(input.kelas_wali_id);
    if (!kelas) throw new Error("Kelas wali tidak ditemukan.");
  }
  const table = guruTable(sheets, spreadsheetId);
  if (input.id) {
    const updated = await table.update(input.id, {
      user_id: input.user_id,
      nip: input.nip,
      nama: input.nama,
      is_wali_kelas: input.is_wali_kelas,
      kelas_wali_id: input.is_wali_kelas ? input.kelas_wali_id : "",
      aktif: true,
    });
    if (!updated) throw new Error("Data guru tidak ditemukan.");
  } else {
    const ada = await table.findWhere((g) => g.user_id === input.user_id);
    if (ada.length > 0) throw new Error("Akun ini sudah punya profil guru.");
    await table.insert({
      id: "",
      user_id: input.user_id,
      nip: input.nip,
      nama: input.nama,
      is_wali_kelas: input.is_wali_kelas,
      kelas_wali_id: input.is_wali_kelas ? input.kelas_wali_id : "",
      aktif: true,
    });
  }
}

export async function deleteGuru(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  id: string
): Promise<void> {
  const dipakai = await penugasanTable(sheets, spreadsheetId).findWhere((p) => p.guru_id === id);
  if (dipakai.length > 0) throw new Error("Guru masih punya penugasan. Hapus penugasannya dulu.");
  await guruTable(sheets, spreadsheetId).softDelete(id);
}

// --- Siswa ---
export interface SiswaView extends SiswaRow {
  username: string;
  kelas_nama: string;
}

export async function listSiswa(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<SiswaView[]> {
  const [siswa, users, kelas] = await Promise.all([
    siswaTable(sheets, spreadsheetId).findAll(),
    usersTable(sheets, spreadsheetId).findAll(),
    new SheetsTable(sheets, spreadsheetId, "kelas", { columns: [...KELAS_COLUMNS] }).findAll(),
  ]);
  const usernameOf = new Map(users.map((u) => [u.id, u.username]));
  const kelasOf = new Map((kelas as { id: string; nama: string }[]).map((k) => [k.id, k.nama]));
  return siswa.map((s) => ({
    ...s,
    username: usernameOf.get(s.user_id) ?? "-",
    kelas_nama: kelasOf.get(s.kelas_id) ?? "-",
  }));
}

export async function listSiswaTersedia(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<UserRow[]> {
  const [users, siswa] = await Promise.all([
    usersTable(sheets, spreadsheetId).findAll(),
    siswaTable(sheets, spreadsheetId).findAll(),
  ]);
  const terpakai = new Set(siswa.map((s) => s.user_id));
  return users.filter((u) => u.role === "siswa" && u.aktif && !terpakai.has(u.id));
}

export async function saveSiswa(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown
): Promise<void> {
  const input = upsertSiswaSchema.parse(raw);
  const user = await usersTable(sheets, spreadsheetId).findById(input.user_id);
  if (!user || user.role !== "siswa") throw new Error("Akun login siswa tidak valid.");
  const kelas = await new SheetsTable(sheets, spreadsheetId, "kelas", {
    columns: [...KELAS_COLUMNS],
  }).findById(input.kelas_id);
  if (!kelas) throw new Error("Kelas tidak ditemukan.");
  if (input.nis) {
    const sama = await siswaTable(sheets, spreadsheetId).findWhere(
      (s) => s.nis === input.nis && s.id !== (input.id ?? "")
    );
    if (sama.length > 0) throw new Error(`NIS "${input.nis}" sudah dipakai.`);
  }
  const table = siswaTable(sheets, spreadsheetId);
  if (input.id) {
    const updated = await table.update(input.id, {
      user_id: input.user_id,
      nis: input.nis,
      nama: input.nama,
      kelas_id: input.kelas_id,
      jenis_kelamin: input.jenis_kelamin,
      aktif: true,
    });
    if (!updated) throw new Error("Data siswa tidak ditemukan.");
  } else {
    const ada = await table.findWhere((s) => s.user_id === input.user_id);
    if (ada.length > 0) throw new Error("Akun ini sudah punya profil siswa.");
    await table.insert({
      id: "",
      user_id: input.user_id,
      nis: input.nis,
      nama: input.nama,
      kelas_id: input.kelas_id,
      jenis_kelamin: input.jenis_kelamin,
      aktif: true,
    });
  }
}

export async function deleteSiswa(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  id: string
): Promise<void> {
  const absensi = new SheetsTable(sheets, spreadsheetId, "absensi", {
    columns: [...ABSENSI_COLUMNS],
  });
  if ((await absensi.findWhere((a) => a.siswa_id === id)).length > 0) {
    throw new Error("Siswa sudah punya riwayat absensi. Nonaktifkan akunnya saja.");
  }
  const izin = new SheetsTable(sheets, spreadsheetId, "pengajuan_izin", {
    columns: [...PENGAJUAN_IZIN_COLUMNS],
  });
  if ((await izin.findWhere((p) => p.siswa_id === id)).length > 0) {
    throw new Error("Siswa punya pengajuan izin. Nonaktifkan akunnya saja.");
  }
  await siswaTable(sheets, spreadsheetId).softDelete(id);
}

// --- Penugasan ---
export interface PenugasanView extends PenugasanRow {
  guru_nama: string;
  kelas_nama: string;
  mapel_nama: string;
  ta_nama: string;
}

export async function listPenugasan(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<PenugasanView[]> {
  const [tugas, guru, kelas, mapel, ta] = await Promise.all([
    penugasanTable(sheets, spreadsheetId).findAll(),
    guruTable(sheets, spreadsheetId).findAll(),
    new SheetsTable(sheets, spreadsheetId, "kelas", { columns: [...KELAS_COLUMNS] }).findAll(),
    new SheetsTable(sheets, spreadsheetId, "mapel", { columns: [...MAPEL_COLUMNS] }).findAll(),
    new SheetsTable(sheets, spreadsheetId, "tahun_ajaran", {
      columns: [...TAHUN_AJARAN_COLUMNS],
    }).findAll(),
  ]);
  const nama = (rows: { id: string; nama: string }[]) => new Map(rows.map((r) => [r.id, r.nama]));
  const guruMap = nama(guru as { id: string; nama: string }[]);
  const kelasMap = nama(kelas as { id: string; nama: string }[]);
  const mapelMap = nama(mapel as { id: string; nama: string }[]);
  const taMap = nama(ta as { id: string; nama: string }[]);
  return tugas.map((t) => ({
    ...t,
    guru_nama: guruMap.get(t.guru_id) ?? "-",
    kelas_nama: kelasMap.get(t.kelas_id) ?? "-",
    mapel_nama: mapelMap.get(t.mapel_id) ?? "-",
    ta_nama: taMap.get(t.tahun_ajaran_id) ?? "-",
  }));
}

export async function savePenugasan(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown
): Promise<void> {
  const input = upsertPenugasanSchema.parse(raw);
  const [guru, kelas, mapel, ta] = await Promise.all([
    guruTable(sheets, spreadsheetId).findById(input.guru_id),
    new SheetsTable(sheets, spreadsheetId, "kelas", { columns: [...KELAS_COLUMNS] }).findById(
      input.kelas_id
    ),
    new SheetsTable(sheets, spreadsheetId, "mapel", { columns: [...MAPEL_COLUMNS] }).findById(
      input.mapel_id
    ),
    new SheetsTable(sheets, spreadsheetId, "tahun_ajaran", {
      columns: [...TAHUN_AJARAN_COLUMNS],
    }).findById(input.tahun_ajaran_id),
  ]);
  if (!guru) throw new Error("Guru tidak ditemukan.");
  if (!kelas) throw new Error("Kelas tidak ditemukan.");
  if (!mapel) throw new Error("Mapel tidak ditemukan.");
  if (!ta) throw new Error("Tahun ajaran tidak ditemukan.");
  const table = penugasanTable(sheets, spreadsheetId);
  const duplikat = await table.findWhere(
    (p) =>
      p.guru_id === input.guru_id &&
      p.kelas_id === input.kelas_id &&
      p.mapel_id === input.mapel_id &&
      p.tahun_ajaran_id === input.tahun_ajaran_id &&
      p.id !== (input.id ?? "")
  );
  if (duplikat.length > 0) throw new Error("Penugasan yang sama sudah ada.");
  if (input.id) {
    const updated = await table.update(input.id, { ...input });
    if (!updated) throw new Error("Penugasan tidak ditemukan.");
  } else {
    await table.insert({ id: "", ...input });
  }
}

export async function deletePenugasan(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  id: string
): Promise<void> {
  const dipakai = await jadwalTable(sheets, spreadsheetId).findWhere((j) => j.penugasan_id === id);
  if (dipakai.length > 0) throw new Error("Penugasan masih punya jadwal. Hapus jadwalnya dulu.");
  await penugasanTable(sheets, spreadsheetId).softDelete(id);
}

// --- Jadwal ---
export interface JadwalView extends JadwalRow {
  label_penugasan: string;
}

export async function listJadwal(
  sheets: SheetsValuesClient,
  spreadsheetId: string
): Promise<JadwalView[]> {
  const [jadwal, tugas] = await Promise.all([
    jadwalTable(sheets, spreadsheetId).findAll(),
    listPenugasan(sheets, spreadsheetId),
  ]);
  const label = new Map(
    tugas.map((t) => [t.id, `${t.guru_nama} · ${t.kelas_nama} · ${t.mapel_nama}`])
  );
  return jadwal.map((j) => ({ ...j, label_penugasan: label.get(j.penugasan_id) ?? "-" }));
}

export async function saveJadwal(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  raw: unknown
): Promise<void> {
  const input = upsertJadwalSchema.parse(raw);
  const tugas = await penugasanTable(sheets, spreadsheetId).findById(input.penugasan_id);
  if (!tugas) throw new Error("Penugasan tidak ditemukan.");
  const table = jadwalTable(sheets, spreadsheetId);
  if (input.id) {
    const updated = await table.update(input.id, { ...input });
    if (!updated) throw new Error("Jadwal tidak ditemukan.");
  } else {
    await table.insert({ id: "", ...input });
  }
}

export async function deleteJadwal(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  id: string
): Promise<void> {
  // Jadwal boleh dihapus bebas (absensi menunjuk jadwal_id; riwayat lama
  // menampilkan "-" bila jadwal sudah tidak ada — ditangani di Tahap 5).
  await jadwalTable(sheets, spreadsheetId).softDelete(id);
}

// --- Penghitung referensi (untuk guard hapus master) ---
export async function countSiswaDiKelas(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  kelasId: string
): Promise<number> {
  return (
    await siswaTable(sheets, spreadsheetId).findWhere((s) => s.kelas_id === kelasId && s.aktif)
  ).length;
}

export async function countPenugasan(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  field: "kelas_id" | "mapel_id" | "guru_id",
  id: string
): Promise<number> {
  return (await penugasanTable(sheets, spreadsheetId).findWhere((p) => p[field] === id)).length;
}

export async function countPemakaianTA(
  sheets: SheetsValuesClient,
  spreadsheetId: string,
  taId: string
): Promise<number> {
  const [kelas, tugas] = await Promise.all([
    new SheetsTable(sheets, spreadsheetId, "kelas", { columns: [...KELAS_COLUMNS] }).findWhere(
      (k) => String(k["tahun_ajaran_id"]) === taId
    ),
    penugasanTable(sheets, spreadsheetId).findWhere((p) => p.tahun_ajaran_id === taId),
  ]);
  return kelas.length + tugas.length;
}
