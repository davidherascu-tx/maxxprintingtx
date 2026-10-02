"use client";

import Link from "next/link";
import { useState } from "react";
import { colorOf, formatPrice, type Product } from "@/lib/catalog";
import { useCart } from "./cart";
import { useColor } from "./product-color";
import { VariantPicker } from "./variant-picker";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [qty, setQty] = useState(product.minQty);
  const [added, setAdded] = useState(false);
  const [colorId, setColorId] = useColor();
  const color = colorOf(product, colorId);
  const variant = product.variants.find((v) => v.id === variantId)!;
  const price = variant.price;

  return (
    <div className="mt-8">
      <div className="flex items-baseline gap-2">
        {variant.price === null ? (
          <span className="text-2xl font-bold text-navy">Price on request</span>
        ) : (
          <>
            <span className="text-3xl font-bold text-navy">{formatPrice(variant.price)}</span>
            <span className="text-sm text-ink/50">each</span>
          </>
        )}
      </div>

      {product.colors && (
        <fieldset className="mt-6">
          <legend className="label">
            Color: <span className="font-normal text-ink/60">{color?.label}</span>
          </legend>
          <div className="flex flex-wrap gap-3">
            {product.colors.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColorId(c.id)}
                aria-pressed={c.id === color?.id}
                aria-label={c.label}
                title={c.label}
                className={`h-10 w-10 rounded-full border border-line ring-offset-2 transition ${
                  c.id === color?.id ? "ring-2 ring-navy" : "hover:ring-2 hover:ring-navy/30"
                }`}
                style={{ background: c.swatch }}
              />
            ))}
          </div>
        </fieldset>
      )}

      <VariantPicker product={product} value={variantId} onChange={setVariantId} />

      {price === null ? (
        <div className="mt-6 rounded-xl bg-mist p-4">
          <p className="text-sm text-ink/70">This size is priced on request. Contact us for a quote.</p>
          <Link href="/contact" className="btn-primary mt-3 w-full py-3.5">Request a quote</Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-end gap-3">
          {!product.noQty && (
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
          )}
          <button
            type="button"
            className="btn-primary flex-1 py-3.5"
            onClick={() => {
              add({ slug: product.slug, variant: variantId, color: color?.id, qty: product.noQty ? 1 : qty });
              setAdded(true);
            }}
          >
            Add to cart · {formatPrice(price * (product.noQty ? 1 : qty))}
          </button>
        </div>

      )}

      {added && (
        <p className="mt-4 flex items-center justify-between rounded-xl bg-cyan/10 px-4 py-3 text-sm text-navy" role="status">
          Added to your cart.
          <Link href="/cart" className="font-semibold underline">View cart →</Link>
        </p>
      )}
    </div>
  );
}
