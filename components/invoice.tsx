import { addressLines } from "@/lib/address";
import { formatPrice } from "@/lib/catalog";
import type { Order } from "@/lib/db";
import type { Site } from "@/lib/site";
import { taxLabel } from "@/lib/tax";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "America/Chicago" });

/**
 * A printable invoice for a placed order (paid or invoiced). The browser's Print dialog
 * saves it as a PDF. The tax rate shown is the one charged on this order.
 */
export function Invoice({ order, customer, site }: { order: Order; customer: { name: string; email: string; phone?: string; company?: string }; site: Site }) {
  const billTo = order.billingAddress ? addressLines(order.billingAddress) : [customer.name, customer.company, customer.email, customer.phone].filter((l): l is string => !!l);
  const shipTo = order.fulfillment === "pickup" ? ["Store pickup", site.address.line1, `${site.address.city}, ${site.address.state} ${site.address.zip}`] : order.shippingAddress ? addressLines(order.shippingAddress) : (order.address ?? "").split("\n");
  const rate = order.subtotal > 0 ? order.tax / order.subtotal : 0;
  const paid = order.paymentStatus === "paid";
  const fullyRefunded = order.refundStatus === "refunded";

  return (
    <article className="rounded-2xl border border-line bg-white p-8 sm:p-10 print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-wrap justify-between gap-6 border-b border-line pb-6">
        <div>
          <p className="font-display text-2xl text-navy">{site.name}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">
            {site.legalName}<br />
            {site.address.line1}{site.address.line2 && `, ${site.address.line2}`}<br />
            {site.address.city}, {site.address.state} {site.address.zip}<br />
            {site.phoneDisplay} · {site.email}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold uppercase tracking-wide text-navy">Invoice</p>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-0.5 text-sm">
            <dt className="text-ink/50">Invoice no.</dt><dd className="font-semibold">{order.number}</dd>
            <dt className="text-ink/50">Date</dt><dd>{day(order.createdAt)}</dd>
            <dt className="text-ink/50">Status</dt>
            <dd className={paid ? "font-semibold text-navy" : "font-semibold text-magenta"}>{paid ? `Paid${order.paidAt ? ` ${day(order.paidAt)}` : ""}` : "Payment due"}</dd>
          </dl>
        </div>
      </header>

      <section className="grid gap-6 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Bill to</p>
          <p className="mt-1 text-sm leading-relaxed">{billTo.map((l, i) => <span key={i} className="block">{l}</span>)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">{order.fulfillment === "pickup" ? "Pickup" : "Ship to"}</p>
          <p className="mt-1 text-sm leading-relaxed">{shipTo.filter(Boolean).map((l, i) => <span key={i} className="block">{l}</span>)}</p>
        </div>
      </section>

      <table className="w-full text-left text-sm">
        <thead className="border-y border-line text-ink/50">
          <tr>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {order.items.map((i, n) => (
            <tr key={n}>
              <td className="py-2.5">
                {i.name}
                <span className="block text-xs text-ink/50">{[i.color, i.variant, i.designId && "custom design"].filter(Boolean).join(" · ")}</span>
              </td>
              <td className="py-2.5 text-right">{i.qty}</td>
              <td className="py-2.5 text-right">{formatPrice(i.price)}</td>
              <td className="py-2.5 text-right">{formatPrice(i.price * i.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The PAID stamp sits beside the totals, clear of the invoice details at the top. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-6">
        {paid ? (
          <span
            className={`ml-2 inline-block rotate-[-8deg] rounded-lg border-4 px-5 py-1.5 text-3xl font-black tracking-widest print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact] ${
              fullyRefunded ? "border-magenta text-magenta" : "border-cyan text-cyan"
            }`}
            aria-label={fullyRefunded ? "Refunded" : "Paid"}
          >
            {fullyRefunded ? "REFUNDED" : "PAID"}
          </span>
        ) : (
          <span />
        )}
      <dl className="w-full max-w-64 space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Sales tax{rate > 0 && ` (${taxLabel(Math.round(rate * 10000) / 10000)})`}</dt><dd>{formatPrice(order.tax)}</dd></div>
        {order.fulfillment === "delivery" && <div className="flex justify-between text-ink/60"><dt>Delivery</dt><dd>Billed separately</dd></div>}
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-navy"><dt>Total</dt><dd>{formatPrice(order.subtotal + order.tax)}</dd></div>
        {paid && <div className="flex justify-between text-ink/60"><dt>Amount paid</dt><dd>{formatPrice(order.subtotal + order.tax)}</dd></div>}
        {order.refundAmount > 0 && (
          <div className="flex justify-between text-magenta">
            <dt>Refunded{order.refundedAt && ` ${day(order.refundedAt)}`}</dt>
            <dd>−{formatPrice(order.refundAmount)}</dd>
          </div>
        )}
        <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd>{formatPrice(paid ? 0 : order.subtotal + order.tax)}</dd></div>
      </dl>
      </div>

      <footer className="mt-10 border-t border-line pt-4 text-center text-xs text-ink/50">
        Thank you for your business! Questions about this invoice? Call {site.phoneDisplay} or email {site.email}.
      </footer>
    </article>
  );
}
