"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrenChart({ data }: { data: { tanggal: string; persen: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: d.tanggal.slice(8) + "/" + d.tanggal.slice(5, 7) }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => [`${v}% hadir`, "Kehadiran"]}
            labelFormatter={(l) => `Tanggal ${l}`}
          />
          <Bar dataKey="persen" fill="#09090b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
