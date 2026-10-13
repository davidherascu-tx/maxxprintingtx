"use client";

import { useActionState } from "react";
import { staffSignIn } from "@/lib/admin-actions";

export function StaffSignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(staffSignIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      {state?.error && <p className="rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
