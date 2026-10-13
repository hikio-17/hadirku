-- Hadirku — skema PostgreSQL per sekolah (Supabase / Postgres mandiri).
--
-- Cara pakai: satu SCHEMA Postgres per sekolah, mis. "school_smpn1".
-- Ganti __SCHEMA__ dengan nama schema (huruf kecil, angka, garis bawah),
-- mis: sed 's/__SCHEMA__/school_smpn1/g' docs/postgres-schema.sql | psql $DATABASE_URL
--
-- Kolom 1:1 dengan header tab Google Sheets (lihat src/lib/storage/sheets/columns.ts)
-- sehingga migrasi Sheets → Postgres bersifat mekanis.
-- Runtime app memakai PostgresTable (src/lib/storage/postgres/adapter.ts);
-- alihkan storage_adapter sekolah ke "postgres" HANYA setelah migrasi terverifikasi.

CREATE SCHEMA IF NOT EXISTS "__SCHEMA__";

CREATE TABLE "__SCHEMA__".tahun_ajaran (
  id            TEXT PRIMARY KEY,
  nama          TEXT NOT NULL,
  semester      TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
  aktif         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE "__SCHEMA__".users (
  id                   TEXT PRIMARY KEY,
  nama                 TEXT NOT NULL,
  username             TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'siswa')),
  aktif                BOOLEAN NOT NULL DEFAULT TRUE,
  wajib_ganti_password BOOLEAN NOT NULL DEFAULT FALSE,
  dibuat_pada          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "__SCHEMA__".users (role);

CREATE TABLE "__SCHEMA__".kelas (
  id              TEXT PRIMARY KEY,
  nama            TEXT NOT NULL,
  tingkat         TEXT NOT NULL DEFAULT '',
  tahun_ajaran_id TEXT NOT NULL REFERENCES "__SCHEMA__".tahun_ajaran (id)
);
CREATE INDEX ON "__SCHEMA__".kelas (tahun_ajaran_id);

CREATE TABLE "__SCHEMA__".mapel (
  id    TEXT PRIMARY KEY,
  nama  TEXT NOT NULL,
  kode  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE "__SCHEMA__".guru (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES "__SCHEMA__".users (id),
  nip           TEXT NOT NULL DEFAULT '',
  nama          TEXT NOT NULL,
  is_wali_kelas BOOLEAN NOT NULL DEFAULT FALSE,
  kelas_wali_id TEXT REFERENCES "__SCHEMA__".kelas (id),
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (user_id)
);
CREATE INDEX ON "__SCHEMA__".guru (user_id);

CREATE TABLE "__SCHEMA__".siswa (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES "__SCHEMA__".users (id),
  nis           TEXT NOT NULL DEFAULT '',
  nama          TEXT NOT NULL,
  kelas_id      TEXT NOT NULL REFERENCES "__SCHEMA__".kelas (id),
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('L', 'P')),
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (user_id)
);
CREATE INDEX ON "__SCHEMA__".siswa (kelas_id);
CREATE INDEX ON "__SCHEMA__".siswa (user_id);

CREATE TABLE "__SCHEMA__".penugasan (
  id              TEXT PRIMARY KEY,
  guru_id         TEXT NOT NULL REFERENCES "__SCHEMA__".guru (id),
  kelas_id        TEXT NOT NULL REFERENCES "__SCHEMA__".kelas (id),
  mapel_id        TEXT NOT NULL REFERENCES "__SCHEMA__".mapel (id),
  tahun_ajaran_id TEXT NOT NULL REFERENCES "__SCHEMA__".tahun_ajaran (id),
  UNIQUE (guru_id, kelas_id, mapel_id, tahun_ajaran_id)
);
CREATE INDEX ON "__SCHEMA__".penugasan (guru_id);
CREATE INDEX ON "__SCHEMA__".penugasan (kelas_id);

CREATE TABLE "__SCHEMA__".jadwal (
  id           TEXT PRIMARY KEY,
  penugasan_id TEXT NOT NULL REFERENCES "__SCHEMA__".penugasan (id),
  hari         TEXT NOT NULL CHECK (hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu')),
  jam_mulai    TIME NOT NULL,
  jam_selesai  TIME NOT NULL,
  CHECK (jam_mulai < jam_selesai)
);
CREATE INDEX ON "__SCHEMA__".jadwal (penugasan_id, hari);

CREATE TABLE "__SCHEMA__".absensi (
  id          TEXT PRIMARY KEY,
  tanggal     DATE NOT NULL,
  jadwal_id   TEXT NOT NULL REFERENCES "__SCHEMA__".jadwal (id),
  siswa_id    TEXT NOT NULL REFERENCES "__SCHEMA__".siswa (id),
  status      TEXT NOT NULL CHECK (status IN ('H', 'I', 'S', 'A')),
  catatan     TEXT NOT NULL DEFAULT '',
  diinput_oleh TEXT NOT NULL DEFAULT '',
  diinput_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diubah_pada  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (jadwal_id, tanggal, siswa_id)
);
CREATE INDEX ON "__SCHEMA__".absensi (jadwal_id, tanggal);
CREATE INDEX ON "__SCHEMA__".absensi (siswa_id);

CREATE TABLE "__SCHEMA__".pengajuan_izin (
  id           TEXT PRIMARY KEY,
  siswa_id     TEXT NOT NULL REFERENCES "__SCHEMA__".siswa (id),
  tanggal      DATE NOT NULL,
  jenis        TEXT NOT NULL CHECK (jenis IN ('izin', 'sakit')),
  alasan       TEXT NOT NULL DEFAULT '',
  url_bukti    TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'menunggu'
               CHECK (status IN ('menunggu', 'disetujui', 'ditolak')),
  diproses_oleh TEXT NOT NULL DEFAULT ''
);
CREATE INDEX ON "__SCHEMA__".pengajuan_izin (siswa_id, status);

CREATE TABLE "__SCHEMA__".log_perubahan (
  id        TEXT PRIMARY KEY,
  tabel     TEXT NOT NULL,
  record_id TEXT NOT NULL,
  aksi      TEXT NOT NULL,
  data_lama JSONB NOT NULL DEFAULT '{}',
  data_baru JSONB NOT NULL DEFAULT '{}',
  oleh      TEXT NOT NULL DEFAULT '',
  waktu     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "__SCHEMA__".log_perubahan (tabel, record_id);

CREATE TABLE "__SCHEMA__".pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL DEFAULT ''
);
