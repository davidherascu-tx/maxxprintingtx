import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/checkout");

  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl text-navy">Checkout</h1>
      <p className="mt-2 text-ink/60">
        Ordering as <span className="font-medium text-ink">{user.name}</span> ({user.email})
      </p>
      <CheckoutForm />
    </div>
  );
}
