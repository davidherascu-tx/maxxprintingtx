import Link from "next/link";
import type { Order } from "@/lib/db";

export const statusColor: Record<Order["status"], string> = {
  Received: "bg-cyan/15 text-navy",
  "In production": "bg-yellow/30 text-navy",
  Ready: "bg-magenta/15 text-magenta",
  Completed: "bg-mist text-ink/60",
};

export function StatusBadge({ status }: { status: Order["status"] }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor[status]}`}>{status}</span>;
}

export const paymentLabel: Record<Order["paymentStatus"], string> = { paid: "Paid", unpaid: "Awaiting payment", invoice: "Invoiced" };

export function PaymentBadge({ status }: { status: Order["paymentStatus"] }) {
  const color = status === "paid" ? "bg-cyan/15 text-navy" : status === "unpaid" ? "bg-magenta/15 text-magenta" : "bg-mist text-ink/60";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>{paymentLabel[status]}</span>;
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-display text-3xl text-navy">{title}</h1>
      {children}
    </div>
  );
}

export const dateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" });
export const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "America/Chicago" });

/** Previous / next links that keep the other search params. */
export function Pagination({ page, pages, params, base }: { page: number; pages: number; params: Record<string, string | undefined>; base: string }) {
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: p > 1 ? String(p) : undefined }).filter((e): e is [string, string] => !!e[1]));
    return q.size ? `${base}?${q}` : base;
  };
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
      {page > 1 ? <Link href={href(page - 1)} className="btn-outline px-4 py-2">← Previous</Link> : <span />}
      <span className="text-ink/60">Page {page} of {pages}</span>
      {page < pages ? <Link href={href(page + 1)} className="btn-outline px-4 py-2">Next →</Link> : <span />}
    </nav>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 ${className}`}>
      {title && <h2 className="mb-4 font-semibold text-navy">{title}</h2>}
      {children}
    </section>
  );
}
