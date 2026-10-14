import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findOrderByNumber } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSite } from "@/lib/store";
import { Invoice } from "@/components/invoice";
import { PrintButton } from "@/components/print-button";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Invoice ${(await params).number}`, robots: { index: false } };
}

/** The customer's invoice for one of their orders, ready to print or save as PDF. */
export default async function CustomerInvoice({ params }: Props) {
  const { number } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/account/orders/${number}/invoice`)}`);
  const [order, site] = await Promise.all([findOrderByNumber(number), getSite()]);
  // Only the customer's own placed orders have an invoice.
  if (!order || order.userId !== user.id || order.paymentStatus === "unpaid") notFound();

  return (
    <div className="container-x max-w-4xl py-10 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/account" className="font-semibold text-navy hover:underline">← My account</Link>
        <div className="flex items-center gap-3">
          <p className="hidden text-sm text-ink/60 sm:block">Tip: choose &ldquo;Save as PDF&rdquo; in the print window to download it.</p>
          <PrintButton label="Print or save as PDF" />
        </div>
      </div>
      <Invoice order={order} customer={order.customer} site={site} />
    </div>
  );
}
