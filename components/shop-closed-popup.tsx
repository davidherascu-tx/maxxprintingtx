"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { useStoreSettings } from "./store";

/** Shown on every public page while the shop is closed (Admin → Home → Close the shop). */
export function ShopClosedPopup({ phone }: { phone: string }) {
  const { shopOpen } = useStoreSettings();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  if (shopOpen || dismissed || pathname.startsWith("/admin")) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="shop-closed-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="text-5xl" aria-hidden>🚧</p>
        <h2 id="shop-closed-title" className="mt-3 font-display text-2xl text-navy">The shop is closed right now</h2>
        <p className="mt-2 text-ink/70">
          We aren't taking new orders at the moment. You can still look around, and please check back soon. Questions? Call us at {phone}.
        </p>
        <button onClick={() => setDismissed(true)} className="mt-6 rounded-full bg-navy px-6 py-3 font-bold text-white hover:bg-navy-700">
          OK, got it
        </button>
      </div>
    </div>
  );
}
