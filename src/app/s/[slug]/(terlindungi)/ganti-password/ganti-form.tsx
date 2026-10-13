"use client";

import { useActionState } from "react";

import { changePasswordAction } from "./actions";

const inputCls =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base outline-none focus:border-zinc-950";

export function GantiPasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Password lama</span>
        <span className="mt-1 block">
          <input
            name="oldPassword"
            type="password"
            required
            autoComplete="current-password"
            className={inputCls}
          />
        </span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password baru (min. 8 karakter)</span>
        <span className="mt-1 block">
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputCls}
          />
        </span>
      </label>
      {state?.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.error}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Simpan password"}
      </button>
    </form>
  );
}
