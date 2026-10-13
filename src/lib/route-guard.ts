/**
 * Aturan proteksi route sekolah — MURNI (tanpa import Node), dipakai middleware
 * Edge dan di-unit-test langsung. Guard Node di layout (terlindungi) mengulang
 * pemeriksaan login + kecocokan slug sebagai pertahanan berlapis.
 */
export interface SchoolToken {
  slug: string;
  role: string;
  mustChange: boolean;
}

export type AccessDecision = { allow: true } | { redirect: string };

const ROLE_HOME: Record<string, string> = {
  admin: "admin",
  guru: "guru",
  siswa: "siswa",
};

export function decideSchoolAccess(pathname: string, token: SchoolToken | null): AccessDecision {
  const m = pathname.match(/^\/s\/([^/]+)(\/.*)?$/);
  if (!m) return { allow: true };
  const slug = m[1];
  const rest = m[2] ?? "/";
  const seg = rest.split("/").filter(Boolean)[0]; // login | admin | guru | siswa | ganti-password | undefined

  if (seg === "login") {
    if (token && token.slug === slug && !token.mustChange) {
      return { redirect: `/s/${slug}` };
    }
    return { allow: true };
  }

  if (!token) {
    return { redirect: `/s/${slug}/login?next=${encodeURIComponent(pathname)}` };
  }
  // Cegah akses lintas sekolah: sesi sekolah A tidak berlaku di URL sekolah B.
  if (token.slug !== slug) {
    return { redirect: `/s/${token.slug}` };
  }
  if (token.mustChange && seg !== "ganti-password") {
    return { redirect: `/s/${slug}/ganti-password` };
  }
  if (seg === "admin" && token.role !== "admin") return { redirect: `/s/${slug}` };
  if (seg === "guru" && token.role !== "guru") return { redirect: `/s/${slug}` };
  if (seg === "siswa" && token.role !== "siswa") return { redirect: `/s/${slug}` };
  if (seg === undefined && !(token.role in ROLE_HOME)) {
    return { redirect: `/s/${slug}/login?error=hak` };
  }
  return { allow: true };
}
