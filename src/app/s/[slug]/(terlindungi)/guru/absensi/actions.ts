"use server";

import { requireGuru } from "@/lib/admin-guard";
import { saveAbsensi } from "@/lib/services/guru";

export interface SaveState {
  ok?: string;
  error?: string;
}

/** Simpan absensi dari form interaktif (tanpa redirect; status ditangani client). */
export async function saveAbsensiAction(input: {
  jadwalId: string;
  tanggal: string;
  entries: { siswaId: string; status: "H" | "I" | "S" | "A"; catatan: string }[];
}): Promise<SaveState> {
  const g = await requireGuru().catch(() => null);
  if (!g) return { error: "Sesi berakhir. Muat ulang halaman dan login lagi." };
  try {
    const r = await saveAbsensi(g.ctx.sheets, g.ctx.context.spreadsheetId, input, {
      guruId: g.guru.id,
      olehUserId: g.userId,
    });
    const bagian = [r.baru > 0 ? `${r.baru} baru` : "", r.diubah > 0 ? `${r.diubah} diubah` : ""]
      .filter(Boolean)
      .join(", ");
    return { ok: `Tersimpan${bagian ? `: ${bagian}` : " (tidak ada perubahan)"}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menyimpan." };
  }
}
