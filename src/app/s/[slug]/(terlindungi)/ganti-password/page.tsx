import { auth } from "@/auth";
import { GantiPasswordForm } from "./ganti-form";

export const dynamic = "force-dynamic";

export default async function GantiPasswordPage() {
  const session = await auth();
  const must = session?.user.mustChange === true;
  return (
    <div className="mx-auto w-full max-w-md py-4">
      <h1 className="text-2xl font-bold tracking-tight">Ganti password</h1>
      <p className="mt-1 text-sm text-zinc-600">
        {must
          ? "Akun Anda wajib mengganti password sebelum melanjutkan."
          : "Ganti password akun Anda kapan saja."}{" "}
        Setelah berhasil, Anda akan diminta login ulang.
      </p>
      <GantiPasswordForm />
    </div>
  );
}
