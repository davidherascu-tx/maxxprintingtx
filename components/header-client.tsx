"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOutAll } from "@/lib/actions";
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
  staff,
}: {
  categories: { slug: string; name: string }[];
  /** A customer is signed in. */
  signedIn: boolean;
  /** A staff member is signed in. */
  staff: boolean;
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
            {staff && <Link href="/admin" className="rounded-lg px-3 py-2 font-medium text-navy hover:bg-mist">Admin</Link>}
            {signedIn && <Link href="/account" className="rounded-lg px-3 py-2 font-medium text-navy hover:bg-mist">My account</Link>}
            {signedIn || staff ? (
              <form action={signOutAll}>
                <button type="submit" className="w-full rounded-lg px-3 py-2 text-left font-medium text-ink/70 hover:bg-mist hover:text-magenta">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/signin" className="rounded-lg px-3 py-2 font-medium text-navy hover:bg-mist">Sign in / Create account</Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

/**
 * "Hi, Name" (or "Admin" for staff who aren't signed in as a customer), opening a small
 * menu with the account links and Sign out, so the header stays on one line.
 */
export function AccountMenu({ name, customer, staff }: { name?: string; customer: boolean; staff: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item = "block w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm hover:bg-mist";
  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium hover:bg-mist"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </svg>
        {customer && name ? `Hi, ${name}` : "Admin"}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden className={`transition ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 min-w-44 rounded-xl border border-line bg-white p-1.5 shadow-lg" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {customer && (
            <Link href="/account" role="menuitem" className={item}>My account</Link>
          )}
          {staff && (
            <Link href="/admin" role="menuitem" className={`${item} font-semibold text-navy`}>Admin</Link>
          )}
          <form action={signOutAll} className="mt-1 border-t border-line pt-1">
            <button type="submit" role="menuitem" className={`${item} text-ink/70 hover:text-magenta`}>Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
