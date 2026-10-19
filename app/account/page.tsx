import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { designsForUser, eventsForOrders, ordersForUser } from "@/lib/db";
import { ApprovalBadge, ApprovalHistory } from "@/components/approval";
import { STEPS, stepsDone } from "@/lib/order-steps";
import { RefundRequest } from "@/components/refund-request";
import { payOrder, saveMyAddress, signOut } from "@/lib/actions";
import { confirmCheckoutSession } from "@/lib/payments";
import { formatPrice } from "@/lib/catalog";
import { getCatalog } from "@/lib/store";
import { ChangePasswordForm, ProfileForm } from "@/components/auth-forms";
import { AddressCards } from "@/components/address-fields";
import { ClearCart } from "@/components/clear-cart";
import { DeleteDesignButton } from "@/components/delete-design-button";

export const metadata: Metadata = { title: "My account" };

const statusColor: Record<string, string> = {
  Received: "bg-cyan/15 text-navy",
  "In production": "bg-yellow/30 text-navy",
  Ready: "bg-magenta/15 text-magenta",
  Completed: "bg-mist text-ink/60",
};

const TABS = [
  { key: "orders", label: "Orders", icon: "📦" },
  { key: "designs", label: "Designs", icon: "🎨" },
  { key: "addresses", label: "Addresses", icon: "🏠" },
  { key: "profile", label: "Profile", icon: "👤" },
] as const;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; session_id?: string; cancelled?: string; payment_error?: string; activated?: string; password_reset?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();
  const catalog = await getCatalog();
  if (!user) redirect("/signin");
  const { order: placed, session_id, cancelled, payment_error, activated, password_reset, tab: tabParam } = await searchParams;
  const tab = TABS.find((x) => x.key === tabParam)?.key ?? "orders";
  // Back from Stripe: confirm the payment here too, in case the webhook is a moment behind.
  if (session_id) await confirmCheckoutSession(session_id, user.id);
  const [orders, designs] = await Promise.all([ordersForUser(user.id), designsForUser(user.id)]);
  const placedOrders = orders.filter((o) => o.paymentStatus !== "unpaid");
  const events = await eventsForOrders(placedOrders.map((o) => o.id));
  const eventsOf = (id: string) => events.filter((e) => e.orderId === id);
  const lastEvent = (id: string, kind: string) => eventsOf(id).filter((e) => e.kind === kind).at(-1);
  const needsYou = placedOrders.filter((o) => o.approval === "artwork_issue");
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

      {password_reset && (
        <div className="mt-8 rounded-2xl border border-cyan/40 bg-cyan/10 p-5 text-navy" role="status">
          <p className="font-semibold">Your new password is saved.</p>
          <p className="mt-1 text-sm text-navy/80">You&apos;re signed in. Other devices were signed out for your safety.</p>
        </div>
      )}
      {activated && (
        <div className="mt-8 rounded-2xl border border-cyan/40 bg-cyan/10 p-5 text-navy" role="status">
          <p className="font-semibold">Your account is active. Welcome, {user.name.split(" ")[0]}!</p>
          <p className="mt-1 text-sm text-navy/80">You&apos;re signed in and ready to order.</p>
        </div>
      )}
      {justPlaced && (
        <div className="mt-8 rounded-2xl border border-cyan/40 bg-cyan/10 p-5 text-navy" role="status">
          <ClearCart />
          <p className="font-semibold">Thank you! Payment received for order {justPlaced}.</p>
          <p className="mt-1 text-sm text-navy/80">
            We&apos;ll email you at every step: design check, printing, and when your order is ready.
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

      {needsYou.length > 0 && (
        <div className="mt-8 rounded-2xl border border-magenta/30 bg-magenta/5 p-5 text-navy" role="status">
          <p className="font-semibold">
            {needsYou.length === 1 ? `Order ${needsYou[0].number} needs your attention.` : `${needsYou.length} orders need your attention.`}
          </p>
          <p className="mt-1 text-sm text-navy/80">We need a change to your design before we can print. See the message below.</p>
        </div>
      )}

      <nav aria-label="My account" className="mt-8 flex gap-2 overflow-x-auto border-b border-line pb-px">
        {TABS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "orders" ? "/account" : `/account?tab=${x.key}`}
            aria-current={tab === x.key ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
              tab === x.key ? "border-navy text-navy" : "border-transparent text-ink/60 hover:text-navy"
            }`}
          >
            <span aria-hidden>{x.icon}</span>
            {x.label}
            {x.key === "orders" && needsYou.length > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-magenta px-1 text-[11px] font-bold text-white">{needsYou.length}</span>
            )}
            {x.key === "designs" && designs.length > 0 && <span className="text-xs font-normal text-ink/40">{designs.length}</span>}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "orders" && (
          <section aria-label="Orders">
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
                      <span className="flex flex-wrap gap-2">
                        {o.approval !== "approved" && <ApprovalBadge approval={o.approval} customer />}
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[o.status]}`}>{o.status}</span>
                      </span>
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
                      {o.fulfillment === "pickup" ? "Store pickup" : "Shipping"}
                      {o.tax > 0 && ` · includes ${formatPrice(o.tax)} tax`}
                    </span>
                    <span className="flex items-center gap-3">
                      {o.paymentStatus !== "unpaid" && (
                        <Link href={`/account/orders/${o.number}/invoice`} className="rounded-full border border-navy/20 px-3 py-1 text-xs font-semibold text-navy hover:bg-mist">
                          📄 Invoice
                        </Link>
                      )}
                      <span className="font-semibold text-navy">{formatPrice(o.subtotal + o.tax + o.shipping)}</span>
                    </span>
                  </div>
                  {o.paymentStatus !== "unpaid" && (
                    <ol className="mt-4 grid grid-cols-6 gap-1" aria-label={`Progress of order ${o.number}`}>
                      {STEPS.map((s, i) => {
                        const done = i < stepsDone(o);
                        const current = i === stepsDone(o);
                        return (
                          <li
                            key={s.label}
                            aria-current={current ? "step" : undefined}
                            className={`rounded-lg px-1 py-1.5 text-center text-[11px] font-semibold leading-tight ${
                              done ? "bg-navy text-white" : current ? "bg-yellow/30 text-navy ring-1 ring-yellow" : "bg-mist text-ink/40"
                            }`}
                          >
                            <span aria-hidden className="block text-sm">{done ? "✔" : s.icon}</span>
                            {s.label}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {o.paymentStatus !== "unpaid" && o.approval === "artwork_issue" && (
                    <div className="mt-4 rounded-xl border border-magenta/30 bg-magenta/5 p-4">
                      <p className="font-semibold text-magenta">We need a change to your design</p>
                      {lastEvent(o.id, "artwork_issue")?.note && <p className="mt-2 whitespace-pre-wrap text-sm">{lastEvent(o.id, "artwork_issue")!.note}</p>}
                      <p className="mt-2 text-sm text-ink/70">Please reply by email or give us a call, and mention order {o.number}.</p>
                    </div>
                  )}
                  {o.refundStatus === "requested" && (
                    <p className="mt-3 rounded-lg bg-yellow/20 px-3 py-2 text-sm text-navy">↩️ Refund requested. We&apos;ll get back to you within 1 to 2 business days.</p>
                  )}
                  {o.refundAmount > 0 && (
                    <p className="mt-3 rounded-lg bg-cyan/10 px-3 py-2 text-sm text-navy">
                      ↩️ {formatPrice(o.refundAmount)} refunded{o.refundedAt && ` on ${new Date(o.refundedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}`}.
                    </p>
                  )}
                  {o.refundStatus === "declined" && (
                    <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-sm text-ink/70">Your refund request was declined. We emailed you the reason; reply to it with any questions.</p>
                  )}
                  {o.paymentStatus !== "unpaid" && o.refundStatus !== "requested" && o.refundStatus !== "refunded" && <RefundRequest orderId={o.id} />}
                  {o.paymentStatus !== "unpaid" && eventsOf(o.id).length > 0 && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-ink/60 hover:text-navy">Order history</summary>
                      <div className="mt-3"><ApprovalHistory events={eventsOf(o.id)} orderId={o.id} forCustomer /></div>
                    </details>
                  )}
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

          </section>
        )}

        {tab === "designs" && (
          <section aria-label="Designs">
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
                    <p className="truncate text-sm font-medium">{catalog.findProduct(d.slug)?.name}</p>
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
        )}

        {tab === "addresses" && (
          <section aria-label="Addresses" className="max-w-4xl">
            <p className="mb-4 text-sm text-ink/60">We fill these in for you at checkout.</p>
            <AddressCards action={saveMyAddress} billing={user.billingAddress} shipping={user.shippingAddress} />
          </section>
        )}

        {tab === "profile" && (
          <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
            <section aria-label="Your details" className="h-fit rounded-2xl border border-line bg-white p-6">
              <h2 className="text-lg font-semibold text-navy">Your details</h2>
              <p className="mb-5 text-sm text-ink/50">How we reach you about your orders.</p>
              <ProfileForm user={user} />
            </section>
            <section aria-label="Change password" className="h-fit rounded-2xl border border-line bg-white p-6">
              <h2 className="text-lg font-semibold text-navy">Change password</h2>
              <p className="mb-5 text-sm text-ink/50">You stay signed in here; other devices are signed out.</p>
              <ChangePasswordForm />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
