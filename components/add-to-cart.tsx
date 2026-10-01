"use client";

import Link from "next/link";
import { useState } from "react";
import { formatPrice, type Product } from "@/lib/catalog";
import { useCart } from "./cart";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(product.minQty);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId)!;

  return (
    <div className="mt-8">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-navy">{formatPrice(variant.price)}</span>
        <span className="text-sm text-ink/50">each</span>
      </div>

      <fieldset className="mt-6">
        <legend className="label">{product.variantLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVariantId(v.id)}
              aria-pressed={v.id === variantId}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                v.id === variantId ? "border-navy bg-navy text-white" : "border-line hover:border-navy/40"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="qty" className="label">Quantity</label>
          <div className="flex items-center rounded-full border border-line">
            <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">−</button>
            <input
              id="qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-14 bg-transparent text-center outline-none [appearance:textfield]"
            />
            <button type="button" className="h-11 w-11 text-lg" onClick={() => setQty((q) => q + 1)} aria-label="Increase">+</button>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary flex-1 py-3.5"
          onClick={() => {
            add({ slug: product.slug, variant: variantId, qty });
            setAdded(true);
          }}
        >
          Add to cart · {formatPrice(variant.price * qty)}
        </button>
      </div>

      {added && (
        <p className="mt-4 flex items-center justify-between rounded-xl bg-cyan/10 px-4 py-3 text-sm text-navy" role="status">
          Added to your cart.
          <Link href="/cart" className="font-semibold underline">View cart →</Link>
        </p>
      )}
    </div>
  );
}
