import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getServerRegistry } from "@/lib/google/tenant-client";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  hak: "Anda tidak punya akses ke halaman tersebut.",
  sekolah: "Data sekolah tidak ditemukan.",
};

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string; error?: string; baru?: string }>;
}) {
  const { slug } = await params;
  const { next = "", error = "", baru = "" } = await searchParams;

  let schoolName = slug;
  try {
    const school = await getServerRegistry().findBySlug(slug);
    if (!school || school.status === "nonaktif") notFound();
    schoolName = school.nama_sekolah;
  } catch {
    // Tanpa kredensial platform tetap tampilkan form (verify saat submit).
  }

  const session = await auth().catch(() => null);
  if (session?.user && session.user.slug === slug && !session.user.mustChange) {
    redirect(`/s/${slug}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm font-semibold text-zinc-500">Hadirku</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">{schoolName}</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Masuk dengan username dan password dari operator sekolah.
      </p>
      {baru && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Password tersimpan. Silakan masuk dengan password baru.
        </div>
      )}
      {error && ERRORS[error] && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {ERRORS[error]}
        </div>
      )}
      <LoginForm slug={slug} next={next} />
      <p className="mt-6 text-xs leading-5 text-zinc-500">
        Login pertama? Anda akan diminta mengganti password setelah masuk. Lupa password? Hubungi
        admin sekolah untuk reset.
      </p>
    </main>
  );
}
