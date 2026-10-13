"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
    >
      {pending ? "Menyimpan…" : children}
    </button>
  );
}

export function ConfirmButton({
  children,
  message,
  danger,
}: {
  children: React.ReactNode;
  message: string;
  danger?: boolean;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
        danger ? "text-red-700 hover:bg-red-50" : "text-zinc-600 hover:bg-zinc-100"
      }`}
    >
      {children}
    </button>
  );
}
