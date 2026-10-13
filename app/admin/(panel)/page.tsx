import type { Metadata } from "next";
import Link from "next/link";
import { formatPrice } from "@/lib/catalog";
import { dashboardStats, ORDER_STATUSES, searchOrders } from "@/lib/db";
import { requireStaff } from "@/lib/staff-session";
import { Card, PageHeader, StatusBadge } from "@/components/admin/ui";
import { OrderTable } from "@/components/admin/order-table";
import { ApprovalBadge } from "@/components/approval";
import type { Approval } from "@/lib/db";
import { RevenueChart, type Day } from "@/components/admin/revenue-chart";

export const metadata: Metadata = { title: "Dashboard" };

/** The last 30 days (Houston time) as YYYY-MM-DD, oldest first, with days without sales filled in. */
function last30(data: Day[]): Day[] {
  const byDay = new Map(data.map((d) => [d.day, d]));
  return Array.from({ length: 30 }, (_, i) => {
    const key = new Date(Date.now() - (29 - i) * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    return byDay.get(key) ?? { day: key, revenue: 0, orders: 0 };
  });
}

function Stat({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink/50">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-2xl border border-line bg-white p-4 transition hover:border-navy/30">{body}</Link>
  ) : (
    <div className="rounded-2xl border border-line bg-white p-4">{body}</div>
  );
}

export default async function AdminDashboard() {
  await requireStaff();
  const [stats, recent] = await Promise.all([dashboardStats(), searchOrders({ payment: "placed" })]);
  const days = last30(stats.daily);

  return (
    <>
      <PageHeader title="Dashboard">
        <Link href="/admin/orders" className="btn-outline px-4 py-2">All orders</Link>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Revenue today" value={formatPrice(stats.revenue.today)} />
        <Stat label="Last 7 days" value={formatPrice(stats.revenue.week)} />
        <Stat label="Last 30 days" value={formatPrice(stats.revenue.month)} sub={`${stats.monthOrders} paid orders`} />
        <Stat label="Open orders" value={String(stats.openOrders)} sub="Paid or invoiced, not completed" href="/admin/orders" />
        <Stat label="Awaiting payment" value={String(stats.awaitingPayment)} sub="Checkout not finished" href="/admin/orders?payment=unpaid" />
        <Stat label="Customers" value={String(stats.customers.total)} sub={`${stats.customers.new30} new in 30 days`} href="/admin/customers" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["review", "New orders to check"],
            ["changes_requested", "Send an updated proof"],
            ["proof_sent", "Waiting for the customer"],
            ["approved", "Ready for production"],
          ] as [Approval, string][]
        ).map(([a, hint]) => (
          <Link key={a} href={`/admin/orders?approval=${a}`} className="rounded-2xl border border-line bg-white p-4 transition hover:border-navy/30">
            <ApprovalBadge approval={a} />
            <p className="mt-2 text-2xl font-bold text-navy">{stats.byApproval[a] ?? 0}</p>
            <p className="text-xs text-ink/50">{hint}</p>
          </Link>
        ))}
      </div>
      {(stats.byApproval.artwork_issue ?? 0) > 0 && (
        <Link href="/admin/orders?approval=artwork_issue" className="mt-3 block rounded-xl bg-magenta/10 px-4 py-2 text-sm text-magenta hover:underline">
          {stats.byApproval.artwork_issue} {stats.byApproval.artwork_issue === 1 ? "order is" : "orders are"} waiting for new artwork from the customer →
        </Link>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${encodeURIComponent(s)}`} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm hover:border-navy/30">
            <StatusBadge status={s} />
            <span className="font-semibold text-navy">{stats.byStatus[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card title="Paid revenue, last 30 days">
          <RevenueChart days={days} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink/60 hover:text-navy">View as table</summary>
            <table className="mt-2 w-full text-left">
              <thead className="text-ink/50">
                <tr><th className="py-1 font-medium">Day</th><th className="py-1 text-right font-medium">Orders</th><th className="py-1 text-right font-medium">Revenue</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {days.filter((d) => d.orders > 0).map((d) => (
                  <tr key={d.day}><td className="py-1">{d.day}</td><td className="py-1 text-right">{d.orders}</td><td className="py-1 text-right">{formatPrice(d.revenue)}</td></tr>
                ))}
                {days.every((d) => d.orders === 0) && <tr><td colSpan={3} className="py-2 text-ink/50">No paid orders in the last 30 days.</td></tr>}
              </tbody>
            </table>
          </details>
        </Card>

        <Card title="Top products, last 30 days">
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-ink/50">No paid orders yet.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {stats.topProducts.map((p) => (
                <li key={p.slug} className="flex justify-between gap-3">
                  <Link href={`/admin/products/${p.slug}`} className="min-w-0 truncate hover:text-navy hover:underline">{p.name}</Link>
                  <span className="shrink-0 text-ink/60">{p.qty} sold · <b className="text-navy">{formatPrice(p.revenue)}</b></span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card title="Recent orders" className="mt-6">
        <OrderTable orders={recent.orders.slice(0, 8)} />
      </Card>
    </>
  );
}
