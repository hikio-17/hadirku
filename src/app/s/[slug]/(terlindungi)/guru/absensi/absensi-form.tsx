"use client";

import { useEffect, useState, useTransition } from "react";

import { saveAbsensiAction } from "./actions";

export interface AbsensiSiswa {
  id: string;
  nama: string;
  nis: string;
  status: "" | "H" | "I" | "S" | "A";
  catatan: string;
}

const STATUS = [
  {
    v: "H",
    label: "H",
    penuh: "Hadir",
    aktif: "bg-green-600 text-white",
    pasif: "bg-green-50 text-green-800",
  },
  {
    v: "I",
    label: "I",
    penuh: "Izin",
    aktif: "bg-amber-500 text-white",
    pasif: "bg-amber-50 text-amber-800",
  },
  {
    v: "S",
    label: "S",
    penuh: "Sakit",
    aktif: "bg-sky-600 text-white",
    pasif: "bg-sky-50 text-sky-800",
  },
  {
    v: "A",
    label: "A",
    penuh: "Alpha",
    aktif: "bg-red-600 text-white",
    pasif: "bg-red-50 text-red-800",
  },
] as const;

/**
 * Form input absensi: 1 ketuk per status, tandai semua hadir, catatan,
 * pencarian, progres. Draft tersimpan di localStorage dan dipulihkan bila
 * halaman dibuka ulang / koneksi gagal.
 */
export function AbsensiForm({
  jadwalId,
  tanggal,
  initial,
}: {
  jadwalId: string;
  tanggal: string;
  initial: AbsensiSiswa[];
}) {
  const key = `absensi:${jadwalId}:${tanggal}`;
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((s) => [s.id, s.status]))
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((s) => [s.id, s.catatan]))
  );
  const [query, setQuery] = useState("");
  const [restored, setRestored] = useState(false);
  const [save, setSave] = useState<{
    kind: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        statuses?: Record<string, string>;
        notes?: Record<string, string>;
      };
      if (!d || typeof d !== "object") return;
      const ids = new Set(initial.map((s) => s.id));
      const s: Record<string, string> = {};
      const n: Record<string, string> = {};
      for (const stu of initial) {
        s[stu.id] =
          typeof d.statuses?.[stu.id] === "string" && ids.has(stu.id)
            ? d.statuses[stu.id]
            : stu.status;
        n[stu.id] = typeof d.notes?.[stu.id] === "string" ? d.notes[stu.id] : stu.catatan;
      }
      setStatuses(s);
      setNotes(n);
      setRestored(true);
    } catch {
      // abaikan draft rusak
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ statuses, notes, savedAt: Date.now() }));
    } catch {
      // storage penuh / privat: lanjut tanpa draft
    }
  }, [key, statuses, notes]);

  const filled = initial.filter((s) => statuses[s.id]).length;
  const q = query.trim().toLowerCase();
  const visible = q
    ? initial.filter((s) => `${s.nama} ${s.nis}`.toLowerCase().includes(q))
    : initial;

  function tandaiSemua(v: string) {
    setStatuses(Object.fromEntries(initial.map((s) => [s.id, v])));
  }

  function submit() {
    const kosong = initial.filter((s) => !statuses[s.id]);
    if (kosong.length > 0) {
      setSave({ kind: "error", message: `${kosong.length} siswa belum ditandai.` });
      return;
    }
    setSave({ kind: "saving" });
    startTransition(async () => {
      const res = await saveAbsensiAction({
        jadwalId,
        tanggal,
        entries: initial.map((s) => ({
          siswaId: s.id,
          status: statuses[s.id] as "H" | "I" | "S" | "A",
          catatan: (notes[s.id] ?? "").slice(0, 280),
        })),
      });
      if (res.ok) {
        try {
          localStorage.removeItem(key);
        } catch {
          // abaikan
        }
        setSave({ kind: "saved", message: res.ok });
      } else {
        setSave({
          kind: "error",
          message: `${res.error ?? "Gagal menyimpan."} Draft tersimpan di perangkat ini.`,
        });
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama / NIS…"
          className="h-10 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950"
        />
        <button
          type="button"
          onClick={() => tandaiSemua("H")}
          className="h-10 shrink-0 rounded-lg bg-green-600 px-3 text-sm font-medium text-white"
        >
          Semua hadir
        </button>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>
            Progres {filled}/{initial.length}
          </span>
          {restored && <span>Draft dipulihkan</span>}
        </div>
        <div className="mt-1 h-2 rounded-full bg-zinc-100">
          <div
            className="h-2 rounded-full bg-zinc-950 transition-all"
            style={{
              width: `${initial.length === 0 ? 0 : Math.round((filled / initial.length) * 100)}%`,
            }}
          />
        </div>
      </div>

      {(save.kind === "saved" || save.kind === "error") && (
        <div
          role={save.kind === "error" ? "alert" : "status"}
          className={`mb-3 rounded-lg border px-4 py-3 text-sm ${
            save.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          {save.kind === "saved" ? "Tersimpan. " : "Gagal. "}
          {save.message}
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((s) => (
          <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.nama}</p>
                <p className="text-xs text-zinc-500">{s.nis || "—"}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {STATUS.map((st) => {
                  const aktif = statuses[s.id] === st.v;
                  return (
                    <button
                      key={st.v}
                      type="button"
                      title={st.penuh}
                      aria-label={`${st.penuh} untuk ${s.nama}`}
                      aria-pressed={aktif}
                      onClick={() =>
                        setStatuses((prev) => ({
                          ...prev,
                          [s.id]: prev[s.id] === st.v ? "" : st.v,
                        }))
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${
                        aktif ? st.aktif : st.pasif
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {(statuses[s.id] === "I" || statuses[s.id] === "S" || statuses[s.id] === "A") && (
              <input
                value={notes[s.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                placeholder="Catatan (opsional)…"
                maxLength={280}
                className="mt-2 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-950"
              />
            )}
          </li>
        ))}
        {visible.length === 0 && (
          <li className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            Tidak cocok dengan pencarian.
          </li>
        )}
      </ul>

      <button
        type="button"
        onClick={submit}
        disabled={pending || save.kind === "saving"}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-base font-medium text-white disabled:opacity-60"
      >
        {pending || save.kind === "saving" ? "Menyimpan…" : "Simpan absensi"}
      </button>
    </div>
  );
}
