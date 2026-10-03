import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { designsForUser, ordersForUser } from "@/lib/db";
import { payOrder, signOut } from "@/lib/actions";
import { confirmCheckoutSession } from "@/lib/payments";
import { formatPrice, getProduct } from "@/lib/catalog";
import { ProfileForm } from "@/components/auth-forms";
import { ClearCart } from "@/components/clear-cart";
import { DeleteDesignButton } from "@/components/delete-design-button";

export const metadata: Metadata = { title: "My account" };

const statusColor: Record<string, string> = {
  Received: "bg-cyan/15 text-navy",
  "In production": "bg-yellow/30 text-navy",
  Ready: "bg-magenta/15 text-magenta",
  Completed: "bg-mist text-ink/60",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; session_id?: string; cancelled?: string; payment_error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const { order: placed, session_id, cancelled, payment_error } = await searchParams;
  // Back from Stripe: confirm the payment here too, in case the webhook is a moment behind.
  if (session_id) await confirmCheckoutSession(session_id, user.id);
  const [orders, designs] = await Promise.all([ordersForUser(user.id), designsForUser(user.id)]);
  const justPlaced = placed && orders.some((o) => o.number === placed && o.paymentStatus === "paid") ? placed : null;
  const unpaidPlaced = placed && !justPlaced && session_id ? orders.find((o) => o.number === placed && o.paymentStatus === "unpaid") : null;

  return (
    <div className="container-x py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-navy">My account</h1>
          <p className="mt-2 text-ink/60">
            Signed in as {user.email} · member since{" "}
            {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <form action={signOut}>
          <button type="submit" className="btn-outline">Sign out</button>
        </form>
      </div>

      {justPlaced && (
        <div className="mt-8 rounded-2xl border border-cyan/40 bg-cyan/10 p-5 text-navy" role="status">
          <ClearCart />
          <p className="font-semibold">Thank you! Payment received for order {justPlaced}.</p>
          <p className="mt-1 text-sm text-navy/80">
            Our team will contact you shortly to confirm artwork and send a proof. Nothing prints until you approve it.
          </p>
        </div>
      )}
      {unpaidPlaced && (
        <div className="mt-8 rounded-2xl border border-yellow/60 bg-yellow/20 p-5 text-navy" role="status">
          <p className="font-semibold">We&apos;re still confirming your payment for {unpaidPlaced.number}.</p>
          <p className="mt-1 text-sm text-navy/80">Refresh this page in a moment. If it stays unpaid, use Pay now below.</p>
        </div>
      )}
      {(cancelled || payment_error) && (
        <div className="mt-8 rounded-2xl border border-line bg-mist p-5 text-navy" role="status">
          <p className="font-semibold">{payment_error ? "We couldn't start the payment." : `Payment for ${cancelled} wasn't completed.`}</p>
          <p className="mt-1 text-sm text-navy/80">Your order is saved. Use Pay now below when you&apos;re ready.</p>
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-navy">Order history</h2>
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-10 text-center">
              <p className="text-ink/60">You haven&apos;t placed any orders yet.</p>
              <Link href="/shop" className="btn-primary mt-5">Browse products</Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((o) => (
                <li key={o.id} className="rounded-2xl border border-line p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold">{o.number}</span>
                      <span className="ml-3 text-sm text-ink/50">
                        {new Date(o.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </span>
                    </div>
                    {o.paymentStatus === "unpaid" ? (
                      <span className="rounded-full bg-yellow/30 px-3 py-1 text-xs font-semibold text-navy">Awaiting payment</span>
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[o.status]}`}>{o.status}</span>
                    )}
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-ink/70">
                    {o.items.map((i) => (
                      <li key={`${i.slug}-${i.variant}-${i.color ?? ""}-${i.designId ?? ""}`} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-3">
                          {i.preview && (
                            // eslint-disable-next-line @next/next/no-img-element -- user design preview served by our API
                            <img src={i.preview} alt="Design" className="h-10 w-10 rounded-md bg-mist object-contain" />
                          )}
                          {i.name} · {i.color && `${i.color} · `}{i.variant} × {i.qty}
                        </span>
                        <span>{formatPrice(i.price * i.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm">
                    <span className="text-ink/60">
                      {o.fulfillment === "pickup" ? "Store pickup" : "Local delivery · quoted separately"}
                      {o.tax > 0 && ` · includes ${formatPrice(o.tax)} tax`}
                    </span>
                    <span className="font-semibold text-navy">{formatPrice(o.subtotal + o.tax)}</span>
                  </div>
                  {o.paymentStatus === "unpaid" && (
                    <form action={payOrder} className="mt-3">
                      <input type="hidden" name="id" value={o.id} />
                      <button type="submit" className="btn-primary w-full">Pay now</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-4 mt-12 text-lg font-semibold text-navy">My designs</h2>
          {designs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-10 text-center">
              <p className="text-ink/60">Designs you create in the Design Studio show up here.</p>
              <Link href="/design" className="btn-accent mt-5">Open Design Studio</Link>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {designs.map((d) => (
                <li key={d.id} className="overflow-hidden rounded-2xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- user design preview served by our API */}
                  <img src={`/api/designs/${d.id}/${d.sides[0]}-preview.png`} alt="" className="aspect-square w-full bg-mist object-contain" />
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{getProduct(d.slug)?.name}</p>
                    <p className="text-xs text-ink/50">{new Date(d.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Link href={`/design/${d.slug}?design=${d.id}`} className="text-sm font-semibold text-navy hover:underline">
                        Edit & reorder →
                      </Link>
                      <DeleteDesignButton id={d.id} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="h-fit rounded-2xl bg-mist p-6">
          <h2 className="mb-4 text-lg font-semibold text-navy">Profile</h2>
          <ProfileForm user={user} />
        </aside>
      </div>
    </div>
  );
}
