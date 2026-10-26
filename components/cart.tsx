"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Catalog } from "@/lib/catalog";
import { requiresDesign } from "@/lib/design-config";
import { useCatalog, useStoreSettings } from "./store";

export type CartLine = { slug: string; variant: string; color?: string; qty: number; designId?: string; preview?: string };

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  subtotal: number;
  /** False while staff have closed the shop: nothing can be added or checked out. */
  shopOpen: boolean;
  add: (line: CartLine) => void;
  setQty: (line: CartLine, qty: number) => void;
  remove: (line: CartLine) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "maxx-cart";

export function linePrice(catalog: Catalog, line: CartLine) {
  const product = catalog.getProduct(line.slug);
  return product?.variants.find((v) => v.id === line.variant)?.price ?? 0;
}

/**
 * A line can be bought if its product and option exist, aren't hidden or price on request,
 * and it has a design when the product needs one.
 */
const isValid = (catalog: Catalog, l: CartLine) =>
  !!catalog.getProduct(l.slug)?.variants.some((v) => v.id === l.variant && v.price !== null) && (!requiresDesign(l.slug) || !!l.designId);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const catalog = useCatalog();
  const { shopOpen } = useStoreSettings();
  const [saved, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      // Lines that can't be bought are left out of `lines` below rather than deleted here,
      // so they come back if staff show the product again.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount
      if (Array.isArray(stored)) setLines(stored);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {}
  }, [saved, ready]);

  const value = useMemo<CartContextValue>(() => {
    // Staff may hide a product or change an option while it sits in someone's cart.
    const lines = saved.filter((l) => isValid(catalog, l));
    /** Products without a quantity picker are always bought once per option. */
    const capQty = (line: CartLine, qty: number) => (catalog.getProduct(line.slug)?.noQty ? 1 : qty);
    const same = (a: CartLine, b: CartLine) =>
      a.slug === b.slug &&
      a.variant === b.variant &&
      (a.color ?? null) === (b.color ?? null) &&
      (a.designId ?? null) === (b.designId ?? null);
    return {
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + linePrice(catalog, l) * l.qty, 0),
      shopOpen,
      add: (line) =>
        shopOpen &&
        setLines((prev) =>
          prev.some((l) => same(l, line))
            ? prev.map((l) => (same(l, line) ? { ...l, qty: capQty(l, l.qty + line.qty) } : l))
            : [...prev, { ...line, qty: capQty(line, line.qty) }],
        ),
      setQty: (line, qty) =>
        setLines((prev) => prev.map((l) => (same(l, line) ? { ...l, qty: Math.max(1, qty) } : l))),
      remove: (line) => setLines((prev) => prev.filter((l) => !same(l, line))),
      clear: () => setLines((prev) => (prev.length ? [] : prev)),
    };
  }, [saved, ready, catalog, shopOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
