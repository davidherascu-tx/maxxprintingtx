import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl text-navy">Your cart</h1>
      <CartView />
    </div>
  );
}
