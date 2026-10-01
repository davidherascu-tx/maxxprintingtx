"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getProduct } from "@/lib/catalog";

export type CartLine = { slug: string; variant: string; qty: number; designId?: string; preview?: string };

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  subtotal: number;
  add: (line: CartLine) => void;
  setQty: (line: CartLine, qty: number) => void;
  remove: (line: CartLine) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "maxx-cart";

export function linePrice(line: CartLine) {
  const product = getProduct(line.slug);
  return product?.variants.find((v) => v.id === line.variant)?.price ?? 0;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount
      if (Array.isArray(saved)) setLines(saved.filter((l) => getProduct(l.slug)));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {}
  }, [lines, ready]);

  const value = useMemo<CartContextValue>(() => {
    const same = (a: CartLine, b: CartLine) =>
      a.slug === b.slug && a.variant === b.variant && (a.designId ?? null) === (b.designId ?? null);
    return {
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + linePrice(l) * l.qty, 0),
      add: (line) =>
        setLines((prev) =>
          prev.some((l) => same(l, line))
            ? prev.map((l) => (same(l, line) ? { ...l, qty: l.qty + line.qty } : l))
            : [...prev, line],
        ),
      setQty: (line, qty) =>
        setLines((prev) => prev.map((l) => (same(l, line) ? { ...l, qty: Math.max(1, qty) } : l))),
      remove: (line) => setLines((prev) => prev.filter((l) => !same(l, line))),
      clear: () => setLines((prev) => (prev.length ? [] : prev)),
    };
  }, [lines, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
