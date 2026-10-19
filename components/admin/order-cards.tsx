import Link from "next/link";
import { formatPrice } from "@/lib/catalog";
import type { AdminOrder } from "@/lib/db";
import { designSource } from "@/lib/design-config";
import { nextStep } from "@/lib/order-steps";
import { SourceBadge } from "@/components/approval";
import { dateTime } from "./ui";

/** Orders as big, easy cards: who, what, what to do next, and one Open button. */
export function OrderCards({ orders, empty }: { orders: AdminOrder[]; empty: string }) {
  if (orders.length === 0) return <p className="rounded-3xl border-2 border-dashed border-line p-8 text-center text-ink/60">{empty}</p>;
  return (
    <ul className="space-y-3">
      {orders.map((o) => {
        const next = nextStep(o);
        return (
          <li key={o.id}>
            <Link
              href={`/admin/orders/${o.number}`}
              className={`flex flex-wrap items-center gap-4 rounded-2xl border-2 bg-white p-4 transition hover:border-navy/40 hover:shadow-md ${next.yourTurn ? "border-yellow" : "border-line"}`}
            >
              <span aria-hidden className="text-3xl">{next.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-navy">
                  {o.number} · {o.customer.name}
                </p>
                <p className={`text-base ${next.yourTurn ? "font-semibold text-ink" : "text-ink/60"}`}>
                  {next.yourTurn ? "👉 " : ""}
                  {next.text}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink/50">
                  {dateTime(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} items · {o.fulfillment === "pickup" ? "Pickup" : "Delivery"}
                  {[...new Set(o.items.map(designSource))].map((s) => <SourceBadge key={s} source={s} />)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-navy">{formatPrice(o.subtotal + o.tax + o.shipping)}</p>
                <span className="mt-1 inline-block rounded-full bg-navy px-4 py-1.5 text-sm font-bold text-white">Open →</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
