import type { Metadata } from "next";
import Link from "next/link";
import { orderViewCounts, searchOrders } from "@/lib/db";
import type { DesignSource } from "@/lib/design-config";
import { orderView } from "@/lib/order-views";
import { requireStaff } from "@/lib/staff-session";
import { sourceLabel } from "@/components/approval";
import { OrderCards } from "@/components/admin/order-cards";
import { Pagination } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Orders" };

const SOURCES: DesignSource[] = ["studio", "dtf", "none"];
/** The main steps, left to right, and the other lists shown as small buttons. */
const STEP_VIEWS = ["check", "print", "printing", "ready"];
const OTHER_VIEWS = ["open", "waiting", "refunds", "done", "all", "unpaid"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; source?: string; page?: string }> }) {
  await requireStaff("/admin/orders");
  const sp = await searchParams;
  // Searching looks through every order; otherwise show the chosen tab (default: "To check").
  const view = orderView(sp.view) ?? (sp.q ? orderView("all")! : orderView("open")!);
  const source = SOURCES.find((s) => s === sp.source);
  const [counts, { orders, total, page, pages }] = await Promise.all([orderViewCounts(), searchOrders({
    q: sp.q,
    approval: view.approval,
    status: view.status,
    payment: view.payment ?? "placed",
    open: view.open,
    refund: view.refund,
    source,
    page: Number(sp.page) || 1,
  })]);

  return (
    <>
      <h1 className="font-display text-3xl text-navy sm:text-4xl">📦 Orders</h1>
      <p className="mt-1 text-ink/60">Orders move from left to right. Tap a box to see the orders waiting at that step.</p>

      <form method="get" className="mt-5 flex flex-wrap gap-2">
        <input type="hidden" name="view" value={view.key} />
        <input name="q" defaultValue={sp.q} placeholder="🔍 Find an order: number, name, email or company" aria-label="Search orders" className="field min-w-0 flex-1 py-3.5 text-base" />
        <select name="source" defaultValue={source ?? ""} aria-label="Design" className="field w-auto py-3.5 text-base">
          <option value="">Any design</option>
          {SOURCES.map((s) => <option key={s} value={s}>{sourceLabel[s]}</option>)}
        </select>
        <button type="submit" className="btn-primary px-6 text-base">Search</button>
      </form>

      <nav aria-label="Order steps" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STEP_VIEWS.map((key, i) => {
          const v = orderView(key)!;
          const n = counts[key] ?? 0;
          const active = v.key === view.key;
          return (
            <Link
              key={key}
              href={`/admin/orders?view=${key}`}
              aria-current={active ? "page" : undefined}
              className={`relative rounded-2xl border-2 p-4 transition ${
                active ? "border-navy bg-navy text-white shadow-lg" : n > 0 ? "border-yellow bg-white text-navy hover:shadow-md" : "border-line bg-white text-navy/60 hover:bg-mist"
              }`}
            >
              <span className={`text-xs font-bold uppercase tracking-wide ${active ? "text-white/70" : "text-ink/40"}`}>Step {i + 1}</span>
              <span className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold leading-none">{n}</span>
                <span className="text-base font-semibold">{v.icon} {v.label}</span>
              </span>
              {i < STEP_VIEWS.length - 1 && <span aria-hidden className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-xl text-ink/30 lg:block">→</span>}
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Other lists" className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-ink/50">Also:</span>
        {OTHER_VIEWS.map((key) => {
          const v = orderView(key)!;
          const n = counts[key] ?? 0;
          const active = v.key === view.key;
          const alert = key === "refunds" && n > 0;
          return (
            <Link
              key={key}
              href={`/admin/orders?view=${key}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
                active ? "bg-navy text-white" : alert ? "bg-magenta/15 text-magenta ring-1 ring-magenta/40" : "bg-white text-navy ring-1 ring-line hover:bg-mist"
              }`}
            >
              {v.icon} {v.label} <span className="opacity-60">({n})</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-5 rounded-2xl bg-mist px-5 py-4">
        <p className="text-lg font-bold text-navy">
          {view.icon} {view.label}: {total} {total === 1 ? "order" : "orders"}
        </p>
        <p className="text-ink/70">{view.hint}</p>
      </div>

      <div className="mt-4">
        <OrderCards orders={orders} empty={sp.q ? "No orders match your search." : `Nothing here right now. 🎉`} />
      </div>
      <Pagination page={page} pages={pages} base="/admin/orders" params={{ view: view.key, q: sp.q, source }} />
    </>
  );
}
