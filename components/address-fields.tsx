"use client";

import { useActionState, useState } from "react";
import type { Address } from "@/lib/address";

type FormState = { error?: string; ok?: string } | undefined;

/** Inputs for one address, named `<prefix>.<field>` (read on the server with readAddress). */
export function AddressFields({ prefix, value, required, idPrefix = prefix }: { prefix: string; value?: Address; required?: boolean; idPrefix?: string }) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const field = (k: keyof Address, label: string, opts: { auto?: string; half?: boolean; optional?: boolean; inputMode?: "numeric" | "tel" } = {}) => (
    <div className={opts.half ? "" : "sm:col-span-2"}>
      <label htmlFor={id(k)} className="label">
        {label} {opts.optional && <span className="text-ink/40">(optional)</span>}
      </label>
      <input
        id={id(k)}
        name={`${prefix}.${k}`}
        defaultValue={value?.[k] ?? ""}
        autoComplete={opts.auto}
        inputMode={opts.inputMode}
        required={required && !opts.optional}
        className="field"
      />
    </div>
  );
  const section = idPrefix.includes("ship") ? "shipping" : "billing";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field("name", "Full name", { auto: `${section} name` })}
      {field("company", "Company", { auto: `${section} organization`, optional: true })}
      {field("line1", "Street address", { auto: `${section} address-line1` })}
      {field("line2", "Apt, suite, unit", { auto: `${section} address-line2`, optional: true })}
      {field("city", "City", { auto: `${section} address-level2`, half: true })}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={id("state")} className="label">State</label>
          <input id={id("state")} name={`${prefix}.state`} defaultValue={value?.state ?? "TX"} autoComplete={`${section} address-level1`} maxLength={2} required={required} className="field uppercase" />
        </div>
        <div>
          <label htmlFor={id("zip")} className="label">ZIP</label>
          <input id={id("zip")} name={`${prefix}.zip`} defaultValue={value?.zip ?? ""} autoComplete={`${section} postal-code`} inputMode="numeric" required={required} className="field" />
        </div>
      </div>
      {field("phone", "Phone", { auto: `${section} tel`, optional: true, inputMode: "tel" })}
    </div>
  );
}

/** Billing + shipping ("same as billing" by default when no shipping address is saved). */
export function AddressBook({
  action,
  billing,
  shipping,
  hidden,
  submit = "Save addresses",
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  billing?: Address;
  shipping?: Address;
  /** Extra hidden fields, e.g. the customer id for staff. */
  hidden?: Record<string, string>;
  submit?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [same, setSame] = useState(!shipping);
  return (
    <form action={formAction} className="space-y-5">
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <fieldset>
        <legend className="mb-2 font-semibold text-navy">Billing address</legend>
        <AddressFields prefix="billing" value={billing} idPrefix="book-bill" />
      </fieldset>
      <fieldset>
        <legend className="mb-2 font-semibold text-navy">Shipping address</legend>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="shippingSame" checked={same} onChange={(e) => setSame(e.target.checked)} className="h-4 w-4 accent-navy" />
          Same as billing address
        </label>
        {!same && <AddressFields prefix="shipping" value={shipping} idPrefix="book-ship" required />}
      </fieldset>
      {state?.error && <p className="rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta" role="alert">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-cyan/10 px-3 py-2 text-sm text-navy" role="status">{state.ok}</p>}
      <button type="submit" disabled={pending} className="btn-outline w-full">{pending ? "Saving…" : submit}</button>
    </form>
  );
}

/**
 * My account → Addresses: billing and shipping as two cards, each with its own Edit button
 * that opens the form in place.
 */
export function AddressCards({
  action,
  billing,
  shipping,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  billing?: Address;
  shipping?: Address;
}) {
  const [editing, setEditing] = useState<"billing" | "shipping" | null>(null);
  const [same, setSame] = useState(!shipping);
  const [state, formAction, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await action(prev, form);
    if (result?.ok) setEditing(null);
    return result;
  }, undefined);

  const lines = (a: Address) => [a.name, a.company, a.line1, a.line2, `${a.city}, ${a.state} ${a.zip}`, a.phone].filter(Boolean);
  const card = (kind: "billing" | "shipping", title: string, hint: string, address: Address | undefined, empty: string) => (
    <section className={`rounded-2xl border bg-white p-6 ${editing === kind ? "border-navy ring-2 ring-navy/10 sm:col-span-2" : "border-line"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy">{title}</h2>
          <p className="text-sm text-ink/50">{hint}</p>
        </div>
        {editing !== kind && (
          <button type="button" onClick={() => { setEditing(kind); setSame(!shipping); }} className="btn-outline shrink-0 px-4 py-2">
            {address || (kind === "shipping" && billing) ? "Edit" : "Add"}
          </button>
        )}
      </div>

      {editing === kind ? (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="kind" value={kind} />
          {kind === "shipping" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="shippingSame" checked={same} onChange={(e) => setSame(e.target.checked)} className="h-4 w-4 accent-navy" />
              Same as my billing address
            </label>
          )}
          {(kind === "billing" || !same) && <AddressFields prefix={kind} value={address ?? (kind === "shipping" ? billing : undefined)} idPrefix={`card-${kind}`} required />}
          {state?.error && <p className="rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta" role="alert">{state.error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      ) : address ? (
        <address className="text-sm not-italic leading-relaxed text-ink/80">{lines(address).map((l, i) => <span key={i} className="block">{l}</span>)}</address>
      ) : (
        <p className="text-sm text-ink/50">{empty}</p>
      )}
    </section>
  );

  return (
    <div className="space-y-4">
      {state?.ok && !editing && <p className="rounded-lg bg-cyan/10 px-3 py-2 text-sm text-navy" role="status">{state.ok}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {card("billing", "Billing address", "Goes on your invoices.", billing, "No billing address yet. We'll ask for it at checkout.")}
        {card("shipping", "Shipping address", "Where we deliver local orders.", shipping, billing ? "Same as your billing address." : "No shipping address yet.")}
      </div>
    </div>
  );
}
