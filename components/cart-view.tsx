"use client";

import Image from "next/image";
import Link from "next/link";
import { colorOf, formatPrice, getProduct } from "@/lib/catalog";
import { calcTax, TAX_LABEL } from "@/lib/tax";
import { linePrice, useCart } from "./cart";

export function CartView() {
  const { lines, ready, subtotal, setQty, remove } = useCart();

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
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y divide-line rounded-2xl border border-line">
        {lines.map((line) => {
          const product = getProduct(line.slug)!;
          const variant = product.variants.find((v) => v.id === line.variant);
          const color = colorOf(product, line.color);
          const image = color?.image ?? product.image;
          return (
            <li key={`${line.slug}-${line.variant}-${line.color ?? ""}-${line.designId ?? ""}`} className="flex gap-4 p-4">
              <Link href={`/product/${product.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-mist">
                {line.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user design preview served by our API
                  <img src={line.preview} alt="Your design" className="absolute inset-0 h-full w-full object-contain p-1" />
                ) : image ? (
                  <Image src={image} alt="" fill sizes="96px" className="object-contain p-2" />
                ) : (
                  <span className="absolute inset-0 bg-gradient-to-br from-navy to-navy-700" />
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/product/${product.slug}`} className="font-semibold hover:text-navy">{product.name}</Link>
                    <p className="text-sm text-ink/60">
                      {color && `Color: ${color.label} · `}
                      {product.variantLabel}: {variant?.label}
                    </p>
                    {line.designId && (
                      <Link href={`/design/${product.slug}?design=${line.designId}`} className="text-xs font-medium text-magenta hover:underline">
                        Custom design · edit
                      </Link>
                    )}
                  </div>
                  <span className="font-semibold text-navy">{formatPrice(linePrice(line) * line.qty)}</span>
                </div>
                <div className="mt-auto flex items-center gap-4 pt-3">
                  {!product.noQty && (
                    <div className="flex items-center rounded-full border border-line text-sm">
                      <button className="h-8 w-8" onClick={() => setQty(line, line.qty - 1)} aria-label="Decrease">−</button>
                      <span className="w-8 text-center">{line.qty}</span>
                      <button className="h-8 w-8" onClick={() => setQty(line, line.qty + 1)} aria-label="Increase">+</button>
                    </div>
                  )}
                  <button className="text-sm text-ink/50 hover:text-magenta" onClick={() => remove(line)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-2xl bg-mist p-6">
        <h2 className="font-semibold text-navy">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold">{formatPrice(subtotal)}</dd></div>
          <div className="flex justify-between text-ink/60"><dt>Sales tax ({TAX_LABEL})</dt><dd>{formatPrice(calcTax(subtotal))}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 font-semibold text-navy"><dt>Total</dt><dd>{formatPrice(subtotal + calcTax(subtotal))}</dd></div>
          <p className="text-xs text-ink/50">Local delivery is quoted separately. <Link href="/ordering" className="underline hover:text-navy">How it works</Link></p>
        </dl>
        <Link href="/checkout" className="btn-primary mt-6 w-full">Checkout</Link>
        <Link href="/shop" className="mt-3 block text-center text-sm text-navy hover:underline">Continue shopping</Link>
      </aside>
    </div>
  );
}
