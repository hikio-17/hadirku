import {
  ClipboardList,
  Database,
  FileText,
  History,
  Home,
  Inbox,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Rute modul tahap berikutnya: tampil nonaktif sampai tahapnya selesai. */
  soon?: boolean;
}

/** Navigasi per role mengikuti desain (sidebar desktop / bottom-nav mobile). */
export function getNavForRole(role: string, slug: string): NavItem[] {
  const base = `/s/${slug}`;
  if (role === "guru") {
    return [
      { href: `${base}/guru`, label: "Ringkasan", icon: LayoutDashboard },
      { href: `${base}/guru/absensi`, label: "Input Absensi", icon: ClipboardList },
      { href: `${base}/guru/rekap`, label: "Rekap & Riwayat", icon: History },
      { href: `${base}/guru/laporan`, label: "Laporan", icon: FileText, soon: true },
      { href: `${base}/guru/izin`, label: "Pengajuan Izin", icon: Inbox, soon: true },
    ];
  }
  if (role === "siswa") {
    return [
      { href: `${base}/siswa`, label: "Beranda", icon: Home },
      { href: `${base}/siswa/izin`, label: "Izin & Sakit", icon: Inbox, soon: true },
      { href: `${base}/siswa/riwayat`, label: "Riwayat", icon: History, soon: true },
    ];
  }
  return [
    { href: `${base}/admin`, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/admin/data`, label: "Manajemen Data", icon: Database },
    { href: `${base}/admin/laporan`, label: "Laporan", icon: FileText, soon: true },
    { href: `${base}/admin/pengaturan`, label: "Pengaturan", icon: Settings, soon: true },
  ];
}
