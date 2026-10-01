"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart";

export function CartButton() {
  const { count, ready } = useCart();
  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
        <circle cx="10" cy="20" r="1.5" />
        <circle cx="17" cy="20" r="1.5" />
      </svg>
      <span>Cart</span>
      {ready && count > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-magenta px-1 text-[11px] font-bold">
          {count}
        </span>
      )}
    </Link>
  );
}

export function MobileMenu({
  categories,
  signedIn,
}: {
  categories: { slug: string; name: string }[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Menu"
        className="grid h-10 w-10 place-items-center rounded-full hover:bg-mist"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav
          className="absolute inset-x-0 top-full border-b border-line bg-white shadow-lg"
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        >
          <div className="container-x grid gap-1 py-4">
            <Link href="/design" className="rounded-lg px-3 py-2 font-semibold text-magenta hover:bg-mist">Design Studio</Link>
            <Link href="/shop" className="rounded-lg px-3 py-2 font-medium hover:bg-mist">Shop all</Link>
            {categories.map((c) => (
              <Link key={c.slug} href={`/category/${c.slug}`} className="rounded-lg px-3 py-2 hover:bg-mist">
                {c.name}
              </Link>
            ))}
            <Link href="/contact" className="rounded-lg px-3 py-2 hover:bg-mist">Contact</Link>
            <Link href={signedIn ? "/account" : "/signin"} className="rounded-lg px-3 py-2 font-medium text-navy hover:bg-mist">
              {signedIn ? "My account" : "Sign in / Create account"}
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
