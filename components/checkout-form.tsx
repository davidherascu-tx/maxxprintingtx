"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { placeOrder } from "@/lib/actions";
import { colorOf, formatPrice, getProduct } from "@/lib/catalog";
import { calcTax, TAX_LABEL } from "@/lib/tax";
import { linePrice, useCart } from "./cart";

export function CheckoutForm() {
  const { lines, ready, subtotal } = useCart();
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [state, action, pending] = useActionState(placeOrder, undefined);

  if (!ready) return <div className="mt-8 h-40 animate-pulse rounded-2xl bg-mist" />;
  if (lines.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-line p-12 text-center">
        <p className="text-ink/60">Your cart is empty.</p>
        <Link href="/shop" className="btn-primary mt-6">Start shopping</Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]"
    >
      <input type="hidden" name="cart" value={JSON.stringify(lines)} />

      <div className="space-y-6">
        <fieldset className="rounded-2xl border border-line p-6">
          <legend className="px-2 font-semibold text-navy">Fulfillment</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["pickup", "Store pickup", "12655 Woodforest Blvd, Ste 100, Houston"],
                ["delivery", "Local delivery", "Delivery cost is quoted and invoiced separately"],
              ] as const
            ).map(([value, title, text]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  fulfillment === value ? "border-navy ring-2 ring-navy/15" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="fulfillment"
                  value={value}
                  checked={fulfillment === value}
                  onChange={() => setFulfillment(value)}
                  className="sr-only"
                />
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-ink/60">{text}</span>
              </label>
            ))}
          </div>
          {fulfillment === "delivery" && (
            <div className="mt-4">
              <label htmlFor="address" className="label">Delivery address</label>
              <textarea id="address" name="address" rows={2} required className="field" />
            </div>
          )}
        </fieldset>

        <fieldset className="rounded-2xl border border-line p-6">
          <legend className="px-2 font-semibold text-navy">Artwork & notes</legend>
          <label htmlFor="notes" className="label">
            Tell us about your design: text, colors, placement, deadlines…
          </label>
          <textarea id="notes" name="notes" rows={5} className="field" placeholder="e.g. Logo on front left chest, names on back. Need by Friday." />
          <p className="mt-2 text-sm text-ink/50">We&apos;ll email you to collect artwork files and send a proof.</p>
        </fieldset>
      </div>

      <aside className="h-fit rounded-2xl bg-mist p-6">
        <h2 className="font-semibold text-navy">Order summary</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {lines.map((l) => {
            const p = getProduct(l.slug)!;
            const color = colorOf(p, l.color);
            return (
              <li key={`${l.slug}-${l.variant}-${l.color ?? ""}-${l.designId ?? ""}`} className="flex justify-between gap-3">
                <span>
                  {p.name}
                  <span className="block text-ink/50">
                    {color && `${color.label} · `}
                    {p.variants.find((v) => v.id === l.variant)?.label} × {l.qty}
                    {l.designId && " · custom design"}
                  </span>
                </span>
                <span className="font-medium">{formatPrice(linePrice(l) * l.qty)}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-between border-t border-line pt-4 font-semibold">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm text-ink/60">
          <span>Sales tax ({TAX_LABEL})</span>
          <span>{formatPrice(calcTax(subtotal))}</span>
        </div>
        {fulfillment === "delivery" && (
          <div className="mt-2 flex justify-between text-sm text-ink/60">
            <span>Delivery</span>
            <span>Quoted separately</span>
          </div>
        )}
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-bold text-navy">
          <span>Total</span>
          <span>{formatPrice(subtotal + calcTax(subtotal))}</span>
        </div>
        <p className="mt-2 text-xs text-ink/50">
          You&apos;ll pay securely by card on the next page (powered by Stripe). We send a proof before anything prints.{" "}
          <Link href="/ordering" className="underline hover:text-navy">How it works</Link>
        </p>
        {state?.error && <p className="mt-4 rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn-primary mt-6 w-full">
          {pending ? "Redirecting to payment…" : "Continue to payment"}
        </button>
      </aside>
    </form>
  );
}
