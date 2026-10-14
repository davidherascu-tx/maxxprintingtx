import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findOrderByNumber } from "@/lib/db";
import { requireStaff } from "@/lib/staff-session";
import { getSite } from "@/lib/store";
import { Invoice } from "@/components/invoice";
import { PrintButton } from "@/components/print-button";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Invoice ${(await params).number}` };
}

/** The same invoice the customer sees in their account. */
export default async function AdminInvoice({ params }: Props) {
  const { number } = await params;
  await requireStaff(`/admin/orders/${number}/invoice`);
  const [order, site] = await Promise.all([findOrderByNumber(number), getSite()]);
  if (!order) notFound();
  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/orders/${order.number}`} className="font-semibold text-navy hover:underline">← Order {order.number}</Link>
        <PrintButton label="Print or save as PDF" />
      </div>
      {order.paymentStatus === "unpaid" && (
        <p className="mb-4 rounded-lg bg-yellow/20 px-3 py-2 text-sm text-navy print:hidden">This order isn&apos;t paid or invoiced yet, so the customer can&apos;t see this invoice.</p>
      )}
      <Invoice order={order} customer={order.customer} site={site} />
    </div>
  );
}
