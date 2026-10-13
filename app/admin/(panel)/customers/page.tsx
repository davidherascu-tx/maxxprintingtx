import type { Metadata } from "next";
import Link from "next/link";
import { formatPrice } from "@/lib/catalog";
import { searchCustomers } from "@/lib/db";
import { requireStaff } from "@/lib/staff-session";
import { Card, date, PageHeader, Pagination } from "@/components/admin/ui";
import { activationRequired } from "@/lib/email";

export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireStaff("/admin/customers");
  const sp = await searchParams;
  const { customers, total, page, pages } = await searchCustomers({ q: sp.q, page: Number(sp.page) || 1 });
  const activation = activationRequired();

  return (
    <>
      <PageHeader title="Customers" />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Name, email, company or phone" aria-label="Search customers" className="field w-full sm:w-80" />
        <button type="submit" className="btn-primary px-5">Search</button>
      </form>
      <p className="mb-3 text-sm text-ink/60">{total} {total === 1 ? "account" : "accounts"}</p>
      <Card>
        {customers.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/50">No customers found.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-ink/50">
                <tr>
                  <th className="px-5 py-2 font-medium">Customer</th>
                  <th className="px-2 py-2 font-medium">Phone</th>
                  <th className="px-2 py-2 font-medium">Joined</th>
                  <th className="px-2 py-2 text-right font-medium">Orders</th>
                  <th className="px-2 py-2 text-right font-medium">Spent</th>
                  <th className="px-5 py-2 font-medium">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-mist/60">
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium text-navy hover:underline">{c.name}</Link>
                      {activation && !c.emailVerifiedAt && <span className="ml-2 rounded-full bg-yellow/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-navy">Not activated</span>}
                      <span className="block text-xs text-ink/50">{c.email}{c.company && ` · ${c.company}`}</span>
                    </td>
                    <td className="px-2 py-2.5 text-ink/70">{c.phone ?? "—"}</td>
                    <td className="px-2 py-2.5 text-ink/70">{date(c.createdAt)}</td>
                    <td className="px-2 py-2.5 text-right">{c.orders}</td>
                    <td className="px-2 py-2.5 text-right font-medium">{formatPrice(c.spent)}</td>
                    <td className="px-5 py-2.5 text-ink/70">{c.lastOrder ? date(c.lastOrder) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Pagination page={page} pages={pages} base="/admin/customers" params={{ q: sp.q }} />
    </>
  );
}
