import type { Metadata } from "next";
import Link from "next/link";
import { searchOrders } from "@/lib/db";
import type { DesignSource } from "@/lib/design-config";
import { ORDER_VIEWS, orderView } from "@/lib/order-views";
import { requireStaff } from "@/lib/staff-session";
import { sourceLabel } from "@/components/approval";
import { OrderCards } from "@/components/admin/order-cards";
import { Pagination } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Orders" };

const SOURCES: DesignSource[] = ["studio", "dtf", "none"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; source?: string; page?: string }> }) {
  await requireStaff("/admin/orders");
  const sp = await searchParams;
  // Searching looks through every order; otherwise show the chosen tab (default: "To check").
  const view = orderView(sp.view) ?? (sp.q ? orderView("all")! : orderView("check")!);
  const source = SOURCES.find((s) => s === sp.source);
  const { orders, total, page, pages } = await searchOrders({
    q: sp.q,
    approval: view.approval,
    status: view.status,
    payment: view.payment ?? "placed",
    open: view.open,
    refund: view.refund,
    source,
    page: Number(sp.page) || 1,
  });

  return (
    <>
      <h1 className="font-display text-3xl text-navy sm:text-4xl">📦 Orders</h1>

      <nav aria-label="Order lists" className="mt-5 flex flex-wrap gap-2">
        {ORDER_VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/admin/orders?view=${v.key}`}
            aria-current={v.key === view.key ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-base font-semibold transition ${
              v.key === view.key ? "bg-navy text-white shadow" : "bg-white text-navy ring-1 ring-line hover:bg-mist"
            }`}
          >
            <span aria-hidden>{v.icon}</span> {v.label}
          </Link>
        ))}
      </nav>

      <div className="mt-4 rounded-2xl bg-mist px-5 py-4">
        <p className="text-lg font-bold text-navy">
          {view.icon} {view.label}: {total} {total === 1 ? "order" : "orders"}
        </p>
        <p className="text-ink/70">{view.hint}</p>
      </div>

      <form method="get" className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="view" value={view.key} />
        <input name="q" defaultValue={sp.q} placeholder="🔍 Search: order number, name, email or company" aria-label="Search orders" className="field min-w-0 flex-1 py-3.5 text-base" />
        <select name="source" defaultValue={source ?? ""} aria-label="Design" className="field w-auto py-3.5 text-base">
          <option value="">Any design</option>
          {SOURCES.map((s) => <option key={s} value={s}>{sourceLabel[s]}</option>)}
        </select>
        <button type="submit" className="btn-primary px-6 text-base">Search</button>
      </form>

      <div className="mt-5">
        <OrderCards orders={orders} empty={sp.q ? "No orders match your search." : `Nothing here right now. 🎉`} />
      </div>
      <Pagination page={page} pages={pages} base="/admin/orders" params={{ view: view.key, q: sp.q, source }} />
    </>
  );
}
