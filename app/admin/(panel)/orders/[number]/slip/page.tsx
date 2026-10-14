import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/catalog";
import { findOrderByNumber } from "@/lib/db";
import { requireStaff } from "@/lib/staff-session";
import { getSite } from "@/lib/store";
import { PrintButton } from "@/components/print-button";
import { dateTime, paymentLabel } from "@/components/admin/ui";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Packing slip ${(await params).number}` };
}

/** A printable slip to send with the order or hand over at pickup. */
export default async function PackingSlip({ params }: Props) {
  const { number } = await params;
  await requireStaff(`/admin/orders/${number}/slip`);
  const [order, site] = await Promise.all([findOrderByNumber(number), getSite()]);
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href={`/admin/orders/${order.number}`} className="text-sm text-ink/60 hover:text-navy">← Order {order.number}</Link>
        <PrintButton />
      </div>
      <article className="rounded-2xl border border-line p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap justify-between gap-6 border-b border-line pb-6">
          <div>
            <p className="font-display text-2xl text-navy">{site.name}</p>
            <p className="text-sm text-ink/70">
              {site.address.line1}{site.address.line2 && `, ${site.address.line2}`}<br />
              {site.address.city}, {site.address.state} {site.address.zip}<br />
              {site.phoneDisplay} · {site.email}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">Packing slip</p>
            <p className="text-sm">Order <b>{order.number}</b></p>
            <p className="text-sm text-ink/70">{dateTime(order.createdAt)}</p>
            <p className="text-sm text-ink/70">{paymentLabel[order.paymentStatus]}</p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Customer</p>
            <p className="mt-1 text-sm">
              {order.customer.name}<br />
              {order.customer.company && <>{order.customer.company}<br /></>}
              {order.customer.email}
              {order.customer.phone && <><br />{order.customer.phone}</>}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">{order.fulfillment === "pickup" ? "Store pickup" : "Deliver to"}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{order.fulfillment === "pickup" ? "Customer picks up in store" : order.address}</p>
          </div>
        </section>

        <table className="w-full text-left text-sm">
          <thead className="border-y border-line text-ink/50">
            <tr>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">Option</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Total</th>
              <th className="w-10 py-2 text-right font-medium print:table-cell">✓</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {order.items.map((i, n) => (
              <tr key={n}>
                <td className="py-2">{i.name}{i.designId && <span className="block text-xs text-ink/50">Custom design</span>}</td>
                <td className="py-2">{[i.color, i.variant].filter(Boolean).join(" · ")}</td>
                <td className="py-2 text-right">{i.qty}</td>
                <td className="py-2 text-right">{formatPrice(i.price * i.qty)}</td>
                <td className="py-2 text-right"><span className="inline-block h-4 w-4 border border-ink/40" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Tax</dt><dd>{formatPrice(order.tax)}</dd></div>
          <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>Total</dt><dd>{formatPrice(order.subtotal + order.tax)}</dd></div>
        </dl>
        {order.notes && (
          <section className="mt-6 border-t border-line pt-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Customer notes</p>
            <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
          </section>
        )}
        <p className="mt-8 text-center text-xs text-ink/50">Thank you for your order! Questions? Call {site.phoneDisplay}.</p>
      </article>
    </div>
  );
}
