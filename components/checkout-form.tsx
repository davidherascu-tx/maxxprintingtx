"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { placeOrder } from "@/lib/actions";
import { colorOf, formatPrice } from "@/lib/catalog";
import { calcTax, taxLabel } from "@/lib/tax";
import { linePrice, useCart } from "./cart";
import { useCatalog, useStoreSettings } from "./store";
import { AddressFields } from "./address-fields";
import type { Address } from "@/lib/address";

export function CheckoutForm({ billing, shipping, name, phone, company }: { billing?: Address; shipping?: Address; name: string; phone?: string; company?: string }) {
  const [shipSame, setShipSame] = useState(!shipping);
  const { lines, ready, subtotal } = useCart();
  const catalog = useCatalog();
  const { taxRate, pickup, delivery, returnPolicy } = useStoreSettings();
  const options = (
    [
      ["pickup", "Store pickup", pickup],
      ["delivery", "Local delivery", delivery],
    ] as const
  ).filter(([, , o]) => o.enabled);
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(options[0]?.[0] ?? "pickup");
  const tax = calcTax(subtotal, taxRate);
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
            {options.length === 0 && (
              <p className="text-sm text-magenta sm:col-span-2">Online ordering is paused right now. Please call us to place your order.</p>
            )}
            {options.map(([value, title, { note: text }]) => (
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
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 font-medium text-navy">Delivery address</p>
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" name="shippingSame" checked={shipSame} onChange={(e) => setShipSame(e.target.checked)} className="h-4 w-4 accent-navy" />
                Same as billing address
              </label>
              {!shipSame && <AddressFields prefix="shipping" value={shipping} idPrefix="checkout-ship" required />}
            </div>
          )}
        </fieldset>

        <fieldset className="rounded-2xl border border-line p-6">
          <legend className="px-2 font-semibold text-navy">Billing address</legend>
          <p className="mb-3 text-sm text-ink/60">This goes on your invoice.</p>
          <AddressFields prefix="billing" value={billing ?? { name, company, phone, line1: "", city: "", state: "TX", zip: "" }} idPrefix="checkout-bill" required />
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" name="saveAddresses" defaultChecked className="h-4 w-4 accent-navy" />
            Save these addresses to my account
          </label>
        </fieldset>

        <fieldset className="rounded-2xl border border-line p-6">
          <legend className="px-2 font-semibold text-navy">Artwork & notes</legend>
          <label htmlFor="notes" className="label">
            Tell us about your design: text, colors, placement, deadlines…
          </label>
          <textarea id="notes" name="notes" rows={5} className="field" placeholder="e.g. Logo on front left chest, names on back. Need by Friday." />
          <p className="mt-2 text-sm text-ink/50">No design yet? We&apos;ll email you to collect your artwork files.</p>
        </fieldset>
      </div>

      <aside className="h-fit rounded-2xl bg-mist p-6">
        <h2 className="font-semibold text-navy">Order summary</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {lines.map((l) => {
            const p = catalog.getProduct(l.slug)!;
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
                <span className="font-medium">{formatPrice(linePrice(catalog, l) * l.qty)}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-between border-t border-line pt-4 font-semibold">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm text-ink/60">
          <span>Sales tax ({taxLabel(taxRate)})</span>
          <span>{formatPrice(tax)}</span>
        </div>
        {fulfillment === "delivery" && (
          <div className="mt-2 flex justify-between text-sm text-ink/60">
            <span>Delivery</span>
            <span>Quoted separately</span>
          </div>
        )}
        <div className="mt-3 flex justify-between border-t border-line pt-3 text-lg font-bold text-navy">
          <span>Total</span>
          <span>{formatPrice(subtotal + tax)}</span>
        </div>
        <p className="mt-2 text-xs text-ink/50">
          You&apos;ll pay securely by card on the next page (powered by Stripe). We check your design before anything prints.{" "}
          <Link href="/ordering" className="underline hover:text-navy">How it works</Link>
        </p>
        <details className="mt-3 text-xs text-ink/60">
          <summary className="cursor-pointer font-medium text-navy hover:underline">Returns &amp; refunds</summary>
          <p className="mt-1 leading-relaxed">{returnPolicy}</p>
        </details>
        {state?.error && <p className="mt-4 rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta">{state.error}</p>}
        <button type="submit" disabled={pending || options.length === 0} className="btn-primary mt-6 w-full">
          {pending ? "Redirecting to payment…" : "Continue to payment"}
        </button>
      </aside>
    </form>
  );
}
