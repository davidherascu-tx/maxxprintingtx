"use client";

import { useEffect, useRef } from "react";
import { useCart } from "./cart";

/** Empties the cart once it has loaded; rendered after a successful order. */
export function ClearCart() {
  const { ready, clear } = useCart();
  const done = useRef(false);
  useEffect(() => {
    if (ready && !done.current) {
      done.current = true;
      clear();
    }
  }, [ready, clear]);
  return null;
}
