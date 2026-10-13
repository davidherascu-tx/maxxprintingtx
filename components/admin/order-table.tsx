import Link from "next/link";
import { formatPrice } from "@/lib/catalog";
import type { AdminOrder } from "@/lib/db";
import { designSource } from "@/lib/design-config";
import { ApprovalBadge, SourceBadge } from "@/components/approval";
import { dateTime, PaymentBadge, StatusBadge } from "./ui";

export function OrderTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) return <p className="py-6 text-center text-sm text-ink/50">No orders found.</p>;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="border-b border-line text-ink/50">
          <tr>
            <th className="px-5 py-2 font-medium">Order</th>
            <th className="px-2 py-2 font-medium">Customer</th>
            <th className="px-2 py-2 font-medium">Placed</th>
            <th className="px-2 py-2 font-medium">Payment</th>
            <th className="px-2 py-2 font-medium">Approval</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-5 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-mist/60">
              <td className="px-5 py-2.5">
                <Link href={`/admin/orders/${o.number}`} className="font-semibold text-navy hover:underline">{o.number}</Link>
                <span className="block text-xs text-ink/50">{o.items.reduce((n, i) => n + i.qty, 0)} items · {o.fulfillment === "pickup" ? "Pickup" : "Delivery"}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {[...new Set(o.items.map(designSource))].map((s) => <SourceBadge key={s} source={s} />)}
                </span>
              </td>
              <td className="px-2 py-2.5">
                {o.customer.name}
                <span className="block text-xs text-ink/50">{o.customer.company ?? o.customer.email}</span>
              </td>
              <td className="px-2 py-2.5 text-ink/70">{dateTime(o.createdAt)}</td>
              <td className="px-2 py-2.5"><PaymentBadge status={o.paymentStatus} /></td>
              <td className="px-2 py-2.5">{o.paymentStatus === "unpaid" ? <span className="text-xs text-ink/40">—</span> : <ApprovalBadge approval={o.approval} />}</td>
              <td className="px-2 py-2.5"><StatusBadge status={o.status} /></td>
              <td className="px-5 py-2.5 text-right font-medium">{formatPrice(o.subtotal + o.tax)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
