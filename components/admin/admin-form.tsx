"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/admin-actions";

/** A form for an action that reports back ("Saved." or an error) under its fields. */
export function AdminForm({
  action,
  children,
  submit,
  className = "space-y-4",
  confirm,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  /** Ask before submitting. */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
      className={className}
    >
      {children}
      {state?.error && <p className="rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta" role="alert">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-cyan/10 px-3 py-2 text-sm text-navy" role="status">{state.ok}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Saving…" : submit}
      </button>
    </form>
  );
}

/** Submit button for a plain action form; optionally asks first. */
export function SubmitButton({ children, className = "btn-outline px-3 py-1.5 text-sm", confirm }: { children: React.ReactNode; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {pending ? "…" : children}
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary print:hidden">
      Print
    </button>
  );
}
