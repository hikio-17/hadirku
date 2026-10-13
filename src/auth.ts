import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { SESSION_COOKIE_NAME } from "@/lib/auth-cookies";
import { verifyCredentialsProduction } from "@/lib/services/auth";
import type { Role } from "@/types";

declare module "next-auth" {
  interface User {
    username: string;
    role: Role;
    schoolId: string;
    slug: string;
    mustChange: boolean;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      role: Role;
      schoolId: string;
      slug: string;
      mustChange: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    role?: Role;
    schoolId?: string;
    slug?: string;
    mustChange?: boolean;
  }
}

/**
 * Sesi aplikasi (guru/siswa/admin) memakai Credentials + JWT.
 * Google OAuth TIDAK lewat Auth.js: pendaftaran custom (Tahap 2) butuh scope
 * drive.file + refresh token persisten di registry — di luar kapabilitas
 * provider Google Auth.js tanpa adapter database.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        slug: { label: "Sekolah", type: "text" },
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // null untuk SEMUA kegagalan (anti enumerasi). Rate limit dicek di
      // login action sebelum signIn agar pesannya spesifik.
      async authorize(credentials) {
        return verifyCredentialsProduction(credentials);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.username = user.username;
        token.role = user.role;
        token.schoolId = user.schoolId;
        token.slug = user.slug;
        token.mustChange = user.mustChange;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: String(token.id ?? token.sub ?? ""),
        name: String(token.name ?? ""),
        username: String(token.username ?? ""),
        role: (token.role ?? "siswa") as Role,
        schoolId: String(token.schoolId ?? ""),
        slug: String(token.slug ?? ""),
        mustChange: token.mustChange === true,
      };
      return session;
    },
  },
});
