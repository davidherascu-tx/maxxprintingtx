import type { Metadata } from "next";
import Link from "next/link";
import { formatPrice } from "@/lib/catalog";
import { dashboardStats, searchOrders } from "@/lib/db";
import { requireStaff } from "@/lib/staff-session";
import { Card } from "@/components/admin/ui";
import { OrderCards } from "@/components/admin/order-cards";
import { RevenueChart, type Day } from "@/components/admin/revenue-chart";

export const metadata: Metadata = { title: "Home" };

/** The last 30 days (Houston time) as YYYY-MM-DD, oldest first, with days without sales filled in. */
function last30(data: Day[]): Day[] {
  const byDay = new Map(data.map((d) => [d.day, d]));
  return Array.from({ length: 30 }, (_, i) => {
    const key = new Date(Date.now() - (29 - i) * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    return byDay.get(key) ?? { day: key, revenue: 0, orders: 0 };
  });
}

function greeting() {
  const hour = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** One big to-do card: how many, what it means, and the one button to press. */
function Todo({ count, icon, title, hint, button, href, tone }: { count: number; icon: string; title: string; hint: string; button: string; href: string; tone: string }) {
  return (
    <div className={`flex flex-col rounded-3xl border-2 p-5 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden className="text-4xl">{icon}</span>
        <span className="text-5xl font-black leading-none">{count}</span>
      </div>
      <p className="mt-3 text-lg font-bold">{title}</p>
      <p className="mt-1 flex-1 text-sm opacity-80">{hint}</p>
      <Link href={href} className="mt-4 inline-flex items-center justify-center rounded-full bg-navy px-5 py-3 text-base font-bold text-white hover:bg-navy-700">
        {button} →
      </Link>
    </div>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-mist p-4">
      <p className="text-sm font-medium text-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{formatPrice(value)}</p>
    </div>
  );
}

export default async function AdminHome() {
  const staff = await requireStaff();
  const [stats, recent] = await Promise.all([dashboardStats(), searchOrders({ payment: "placed" })]);
  const days = last30(stats.daily);
  const t = stats.todo;
  const todos = [
    { count: t.refunds, icon: "↩️", title: t.refunds === 1 ? "Refund request" : "Refund requests", hint: "A customer asked for money back. Refund it or say why not.", button: "Answer", href: "/admin/orders?view=refunds", tone: "border-magenta/40 bg-magenta/5 text-navy" },
    { count: t.toCheck, icon: "🎨", title: t.toCheck === 1 ? "Design to check" : "Designs to check", hint: "Orders made in the Design Studio. Look at the design and approve it.", button: "Check now", href: "/admin/orders?view=check", tone: "border-yellow bg-yellow/15 text-navy" },
    { count: t.toPrint, icon: "🖨️", title: "Ready to print", hint: "Paid, and the design is approved (or there's none to check). Time to print!", button: "Start printing", href: "/admin/orders?view=print", tone: "border-cyan bg-cyan/10 text-navy" },
    { count: t.printing, icon: "⚙️", title: "Being printed", hint: "When an order is finished, press Ready.", button: "See them", href: "/admin/orders?view=printing", tone: "border-line bg-white text-navy" },
    { count: t.ready, icon: "📦", title: "Ready to hand over", hint: "Finished. Give it to the customer (or deliver it), then press Done.", button: "See them", href: "/admin/orders?view=ready", tone: "border-line bg-white text-navy" },
  ].filter((x) => x.count > 0);

  return (
    <>
      <h1 className="font-display text-3xl text-navy sm:text-4xl">
        {greeting()}, {staff.name.split(" ")[0]}! 👋
      </h1>
      <p className="mt-2 text-lg text-ink/70">
        {todos.length === 0 ? "Here's how the shop is doing." : "Here's what needs doing. Start with the first card."}
      </p>

      <section className="mt-6">
        <h2 className="mb-3 text-xl font-bold text-navy">✅ Your to-do list</h2>
        {todos.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-cyan bg-cyan/5 p-8 text-center">
            <p className="text-5xl" aria-hidden>🎉</p>
            <p className="mt-3 text-2xl font-bold text-navy">All done!</p>
            <p className="mt-1 text-ink/70">Nothing needs doing right now. New orders will show up here.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {todos.map((x) => <Todo key={x.href} {...x} />)}
          </div>
        )}
        {t.waiting > 0 && (
          <p className="mt-3 rounded-2xl bg-mist px-4 py-3 text-sm text-ink/70">
            ⏳ {t.waiting} {t.waiting === 1 ? "order is" : "orders are"} waiting for the customer to change their design. Nothing to do until they reply.{" "}
            <Link href="/admin/orders?view=waiting" className="font-semibold text-navy underline">See them</Link>
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold text-navy">💵 Money in</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Money label="Today" value={stats.revenue.today} />
          <Money label="Last 7 days" value={stats.revenue.week} />
          <Money label="Last 30 days" value={stats.revenue.month} />
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-bold text-navy">🧾 Newest orders</h2>
          <Link href="/admin/orders?view=all" className="font-semibold text-navy hover:underline">See all orders →</Link>
        </div>
        <OrderCards orders={recent.orders.slice(0, 5)} empty="No orders yet. When a customer orders, it shows up here." />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold text-navy">⚡ Quick buttons</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/admin/products", icon: "🏷️", label: "Change a price" },
            { href: "/admin/products?show=sale", icon: "💥", label: "See what's on sale" },
            { href: "/admin/customers", icon: "👥", label: "Find a customer" },
            { href: "/admin/settings", icon: "⚙️", label: "Shop settings" },
          ].map((q) => (
            <Link key={q.href} href={q.href} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-base font-semibold text-navy hover:border-navy/30 hover:bg-mist">
              <span aria-hidden className="text-2xl">{q.icon}</span> {q.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card title="📈 Sales, last 30 days">
          <RevenueChart days={days} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink/60 hover:text-navy">Show as a table</summary>
            <table className="mt-2 w-full text-left">
              <thead className="text-ink/50">
                <tr><th className="py-1 font-medium">Day</th><th className="py-1 text-right font-medium">Orders</th><th className="py-1 text-right font-medium">Money</th></tr>
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

        <Card title="🏆 Best sellers, last 30 days">
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-ink/50">Nothing sold yet.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {stats.topProducts.map((p, i) => (
                <li key={p.slug} className="flex justify-between gap-3">
                  <Link href={`/admin/products/${p.slug}`} className="min-w-0 truncate font-medium hover:text-navy hover:underline">
                    {["🥇", "🥈", "🥉"][i] ?? "•"} {p.name}
                  </Link>
                  <span className="shrink-0 text-ink/60">{p.qty} sold · <b className="text-navy">{formatPrice(p.revenue)}</b></span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
