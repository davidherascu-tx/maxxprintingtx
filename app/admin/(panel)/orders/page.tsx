import type { Metadata } from "next";
import { APPROVALS, ORDER_STATUSES, PAYMENT_FILTERS, searchOrders, type PaymentFilter } from "@/lib/db";
import type { DesignSource } from "@/lib/design-config";
import { sourceLabel, staffApprovalLabel } from "@/components/approval";
import { requireStaff } from "@/lib/staff-session";
import { Card, PageHeader, Pagination } from "@/components/admin/ui";
import { OrderTable } from "@/components/admin/order-table";

export const metadata: Metadata = { title: "Orders" };

const paymentNames: Record<PaymentFilter, string> = {
  placed: "Paid & invoiced",
  paid: "Paid",
  invoice: "Invoiced",
  unpaid: "Awaiting payment",
  all: "Everything",
};

const SOURCES: DesignSource[] = ["studio", "dtf", "none"];

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; payment?: string; approval?: string; source?: string; page?: string }>;
}) {
  await requireStaff("/admin/orders");
  const sp = await searchParams;
  const payment = PAYMENT_FILTERS.find((p) => p === sp.payment) ?? "placed";
  const status = ORDER_STATUSES.find((s) => s === sp.status);
  const approval = APPROVALS.find((a) => a === sp.approval);
  const source = SOURCES.find((s) => s === sp.source);
  const { orders, total, page, pages } = await searchOrders({ q: sp.q, status, payment, approval, source, page: Number(sp.page) || 1 });

  return (
    <>
      <PageHeader title="Orders" />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Order #, name, email or company" aria-label="Search orders" className="field w-full sm:w-72" />
        <select name="status" defaultValue={status ?? ""} aria-label="Status" className="field w-auto">
          <option value="">Any status</option>
          {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select name="approval" defaultValue={approval ?? ""} aria-label="Approval" className="field w-auto">
          <option value="">Any approval</option>
          {APPROVALS.map((a) => <option key={a} value={a}>{staffApprovalLabel[a]}</option>)}
        </select>
        <select name="source" defaultValue={source ?? ""} aria-label="Design" className="field w-auto">
          <option value="">Any design</option>
          {SOURCES.map((s) => <option key={s} value={s}>{sourceLabel[s]}</option>)}
        </select>
        <select name="payment" defaultValue={payment} aria-label="Payment" className="field w-auto">
          {PAYMENT_FILTERS.map((p) => <option key={p} value={p}>{paymentNames[p]}</option>)}
        </select>
        <button type="submit" className="btn-primary px-5">Filter</button>
      </form>
      <p className="mb-3 text-sm text-ink/60">
        {total} {total === 1 ? "order" : "orders"}
        {payment === "placed" && " · orders still awaiting payment are hidden (choose “Awaiting payment” to see them)"}
      </p>
      <Card>
        <OrderTable orders={orders} />
      </Card>
      <Pagination page={page} pages={pages} base="/admin/orders" params={{ q: sp.q, status, approval, source, payment: payment === "placed" ? undefined : payment }} />
    </>
  );
}
