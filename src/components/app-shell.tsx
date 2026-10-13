"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import type { NavItem } from "@/lib/nav";
import { logoutAction } from "@/app/s/[slug]/(terlindungi)/actions";

export interface ShellUser {
  name: string;
  username: string;
  role: string;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const cls = active ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100";
  const inner = (
    <>
      <item.icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      {item.soon && (
        <span className="ml-auto rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
          Segera
        </span>
      )}
    </>
  );
  if (item.soon) {
    return (
      <span
        title="Modul tahap berikutnya"
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm opacity-60 ${cls}`}
      >
        {inner}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${cls}`}
    >
      {inner}
    </Link>
  );
}

/**
 * Kerangka aplikasi: sidebar di desktop, bottom-nav di mobile.
 * Konten modul dirender sebagai children.
 */
export function AppShell({
  slug,
  schoolName,
  user,
  nav,
  children,
}: {
  slug: string;
  schoolName: string;
  user: ShellUser;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-50 md:flex">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white px-4 py-6 md:flex">
        <div className="px-1">
          <p className="text-sm font-bold">Hadirku</p>
          <p className="truncate text-xs text-zinc-500">{schoolName}</p>
        </div>
        <p className="mb-1 mt-6 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Menu
        </p>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-zinc-200 px-2 pt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs capitalize text-zinc-500">{user.role}</p>
          </div>
          <form action={logoutAction.bind(null, slug)}>
            <button
              type="submit"
              title="Keluar"
              aria-label="Keluar"
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Kolom konten */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header mobile */}
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3 md:hidden">
          <div className="min-w-0">
            <p className="text-sm font-bold">Hadirku</p>
            <p className="truncate text-xs text-zinc-500">{schoolName}</p>
          </div>
          <form action={logoutAction.bind(null, slug)}>
            <button
              type="submit"
              aria-label="Keluar"
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-28 pt-6 md:pb-10">{children}</main>

        {/* Bottom-nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-2 md:hidden">
          <div className="flex justify-around">
            {nav.slice(0, 5).map((item) => {
              const active = pathname === item.href;
              const body = (
                <>
                  <item.icon className="h-5 w-5" aria-hidden />
                  <span className="mt-0.5 max-w-16 truncate text-[10px]">{item.label}</span>
                </>
              );
              const cls = `flex min-w-14 flex-col items-center rounded-lg px-1 py-1.5 ${
                active ? "font-semibold text-zinc-950" : "text-zinc-500"
              }`;
              return item.soon ? (
                <span key={item.href} className={`${cls} opacity-50`}>
                  {body}
                </span>
              ) : (
                <Link key={item.href} href={item.href} className={cls}>
                  {body}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
