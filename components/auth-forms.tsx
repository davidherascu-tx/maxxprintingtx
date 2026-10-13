"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { resendActivation, signIn, signUp, updateProfile } from "@/lib/actions";

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta" role="alert">{message}</p>;
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <ErrorNote message={state?.error} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-ink/60">
        New to Maxx?{" "}
        <Link href={`/signup${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-navy hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

/** Shown instead of the sign-up form once the activation email is on its way. */
function CheckYourEmail({ message }: { message: string }) {
  return (
    <div className="space-y-4 text-center" role="status">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cyan/15 text-navy" aria-hidden>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </div>
      <p className="font-semibold text-navy">Check your email</p>
      <p className="text-sm text-ink/70">{message}</p>
      <p className="text-xs text-ink/50">Can&apos;t find it? Look in your spam or promotions folder. The link works for 48 hours.</p>
      <Link href="/signin" className="btn-outline w-full">Back to sign in</Link>
    </div>
  );
}

/** "Didn't get the activation email?" on the sign-in page. */
export function ResendActivation({ next }: { next: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(resendActivation, undefined);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full text-center text-sm text-ink/60 hover:text-navy hover:underline">
        Didn&apos;t get the activation email?
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-xl bg-mist p-4">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="resend-email" className="label">Send a new activation link to</label>
      <input id="resend-email" name="email" type="email" autoComplete="email" required className="field" />
      <ErrorNote message={state?.error} />
      {state?.ok && <p className="text-sm text-navy" role="status">{state.ok}</p>}
      <button type="submit" disabled={pending} className="btn-outline w-full">{pending ? "Sending…" : "Send new link"}</button>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  if (state?.ok) return <CheckYourEmail message={state.ok} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="name" className="label">Full name</label>
        <input id="name" name="name" autoComplete="name" required className="field" />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="label">Phone <span className="text-ink/40">(optional)</span></label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" className="field" />
        </div>
        <div>
          <label htmlFor="company" className="label">Company <span className="text-ink/40">(optional)</span></label>
          <input id="company" name="company" autoComplete="organization" className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
        <p className="mt-1 text-xs text-ink/50">At least 8 characters.</p>
      </div>
      <ErrorNote message={state?.error} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-ink/60">
        Already have an account?{" "}
        <Link href={`/signin${next !== "/account" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-navy hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ProfileForm({ user }: { user: { name: string; email: string; phone?: string; company?: string } }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="label">Full name</label>
        <input id="name" name="name" defaultValue={user.name} required className="field" />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" value={user.email} disabled className="field bg-mist text-ink/60" />
      </div>
      <div>
        <label htmlFor="phone" className="label">Phone</label>
        <input id="phone" name="phone" type="tel" defaultValue={user.phone} className="field" />
      </div>
      <div>
        <label htmlFor="company" className="label">Company</label>
        <input id="company" name="company" defaultValue={user.company} className="field" />
      </div>
      <ErrorNote message={state?.error} />
      {state?.ok && <p className="text-sm text-navy" role="status">{state.ok}</p>}
      <button type="submit" disabled={pending} className="btn-outline w-full">
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
