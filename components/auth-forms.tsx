"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { changePassword, requestPasswordReset, resendActivation, resetPassword, signIn, signUp, updateProfile } from "@/lib/actions";

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
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="label">Password</label>
          <Link href="/forgot-password" className="text-sm font-medium text-navy hover:underline">Forgot password?</Link>
        </div>
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

/** A form row for the account Profile tab: label on the left, field on the right (stacked on phones). */
function Row({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[8.5rem_1fr] sm:items-center sm:gap-4">
      <label htmlFor={id} className="text-sm font-medium text-ink/80">{label}</label>
      <div>
        {children}
        {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
      </div>
    </div>
  );
}

export function ProfileForm({ user }: { user: { name: string; email: string; phone?: string; company?: string } }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <Row id="name" label="Full name">
        <input id="name" name="name" defaultValue={user.name} autoComplete="name" required className="field" />
      </Row>
      <Row id="email" label="Email" hint="Used to sign in. Call us to change it.">
        <input id="email" value={user.email} disabled className="field bg-mist text-ink/60" />
      </Row>
      <Row id="phone" label="Phone">
        <input id="phone" name="phone" type="tel" defaultValue={user.phone} autoComplete="tel" className="field" />
      </Row>
      <Row id="company" label="Company">
        <input id="company" name="company" defaultValue={user.company} autoComplete="organization" className="field" />
      </Row>
      <ErrorNote message={state?.error} />
      {state?.ok && <p className="rounded-lg bg-cyan/10 px-3 py-2 text-sm text-navy" role="status">{state.ok}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary px-6 py-2.5">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  if (state?.ok) return <CheckYourEmail message={state.ok} />;
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <ErrorNote message={state?.error} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Sending…" : "Email me a reset link"}
      </button>
      <p className="text-center text-sm text-ink/60">
        Remembered it? <Link href="/signin" className="font-semibold text-navy hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="label">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
        <p className="mt-1 text-xs text-ink/50">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">Repeat new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="field" />
      </div>
      <ErrorNote message={state?.error} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Row id="current-password" label="Current">
        <input id="current-password" name="current" type="password" autoComplete="current-password" required className="field" />
      </Row>
      <Row id="new-password" label="New" hint="At least 8 characters.">
        <input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
      </Row>
      <Row id="confirm-password" label="Repeat new">
        <input id="confirm-password" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="field" />
      </Row>
      <ErrorNote message={state?.error} />
      {state?.ok && <p className="rounded-lg bg-cyan/10 px-3 py-2 text-sm text-navy" role="status">{state.ok}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/forgot-password" className="text-xs font-medium text-navy hover:underline">Forgot your current password?</Link>
        <button type="submit" disabled={pending} className="btn-primary px-6 py-2.5">
          {pending ? "Saving…" : "Change"}
        </button>
      </div>
    </form>
  );
}
