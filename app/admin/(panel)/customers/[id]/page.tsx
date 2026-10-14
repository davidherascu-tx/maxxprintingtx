import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/catalog";
import { designsForUser, findUserById, ordersForUser } from "@/lib/db";
import { activateCustomer, resendCustomerActivation, resetCustomerPassword, saveCustomerAddresses, updateCustomer } from "@/lib/admin-actions";
import { AddressBook } from "@/components/address-fields";
import { requireStaff } from "@/lib/staff-session";
import { getCatalog } from "@/lib/store";
import { AdminForm, SubmitButton } from "@/components/admin/admin-form";
import { activationRequired } from "@/lib/email";
import { ApprovalBadge, SourceBadge } from "@/components/approval";
import { designSource } from "@/lib/design-config";
import { Card, date, dateTime, PageHeader, PaymentBadge, StatusBadge } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff(`/admin/customers/${id}`);
  const user = await findUserById(id);
  if (!user) notFound();
  const [orders, designs, catalog] = await Promise.all([ordersForUser(id), designsForUser(id), getCatalog()]);
  const placed = orders.filter((o) => o.paymentStatus !== "unpaid");
  const spent = placed.filter((o) => o.paymentStatus === "paid").reduce((n, o) => n + o.subtotal + o.tax, 0);

  return (
    <>
      <Link href="/admin/customers" className="text-sm text-ink/60 hover:text-navy">← Customers</Link>
      <PageHeader title={user.name} />
      <p className="-mt-4 mb-6 text-sm text-ink/60">
        {activationRequired() && !user.emailVerifiedAt && <span className="mr-2 rounded-full bg-yellow/30 px-2.5 py-0.5 text-xs font-semibold text-navy">Not activated</span>}
        Customer since {date(user.createdAt)} · {placed.length} {placed.length === 1 ? "order" : "orders"} · {formatPrice(spent)} paid
      </p>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Orders">
            {orders.length === 0 ? (
              <p className="text-sm text-ink/50">No orders yet.</p>
            ) : (
              <ul className="-my-2 divide-y divide-line">
                {orders.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <Link href={`/admin/orders/${o.number}`} className="font-semibold text-navy hover:underline">{o.number}</Link>
                      <span className="ml-2 text-ink/50">{dateTime(o.createdAt)}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {o.items.map((i, n) => (
                          <span key={n} className="flex items-center gap-1 text-xs text-ink/60">
                            {i.name} × {i.qty} <SourceBadge source={designSource(i)} />
                          </span>
                        ))}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PaymentBadge status={o.paymentStatus} />
                      {o.paymentStatus !== "unpaid" && <ApprovalBadge approval={o.approval} />}
                      <StatusBadge status={o.status} />
                      <span className="w-24 text-right font-medium">{formatPrice(o.subtotal + o.tax)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Saved designs">
            {designs.length === 0 ? (
              <p className="text-sm text-ink/50">No saved designs.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {designs.map((d) => (
                  <li key={d.id} className="overflow-hidden rounded-xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element -- design preview served by our API */}
                    <img src={`/api/designs/${d.id}/${d.sides[0]}-preview.png`} alt="" className="aspect-square w-full bg-mist object-contain" />
                    <div className="p-2 text-xs">
                      <p className="truncate font-medium">{catalog.findProduct(d.slug)?.name ?? d.slug}</p>
                      <p className="mt-1"><SourceBadge source={designSource({ slug: d.slug, designId: d.id })} /></p>
                      <p className="mt-1 text-ink/50">{date(d.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Details">
            <AdminForm action={updateCustomer} submit="Save details">
              <input type="hidden" name="id" value={user.id} />
              <div>
                <label htmlFor="name" className="label">Name</label>
                <input id="name" name="name" defaultValue={user.name} required className="field" />
              </div>
              <div>
                <label htmlFor="email" className="label">Email (used to sign in)</label>
                <input id="email" name="email" type="email" defaultValue={user.email} required className="field" />
              </div>
              <div>
                <label htmlFor="phone" className="label">Phone</label>
                <input id="phone" name="phone" type="tel" defaultValue={user.phone} className="field" />
              </div>
              <div>
                <label htmlFor="company" className="label">Company</label>
                <input id="company" name="company" defaultValue={user.company} className="field" />
              </div>
            </AdminForm>
          </Card>

          {activationRequired() && !user.emailVerifiedAt && (
            <Card title="Account activation">
              <p className="mb-3 text-sm text-ink/60">
                {user.name} hasn&apos;t clicked the activation link yet, so they can&apos;t sign in.
              </p>
              <AdminForm action={resendCustomerActivation} submit="Resend activation email">
                <input type="hidden" name="id" value={user.id} />
              </AdminForm>
              <form action={activateCustomer} className="mt-3 border-t border-line pt-3">
                <input type="hidden" name="id" value={user.id} />
                <SubmitButton confirm={`Activate ${user.name}'s account without the email link? Only do this if you know ${user.email} is really theirs.`}>
                  Activate without email
                </SubmitButton>
              </form>
            </Card>
          )}

          <Card title="🏠 Addresses">
            <AddressBook action={saveCustomerAddresses} billing={user.billingAddress} shipping={user.shippingAddress} hidden={{ id: user.id }} />
          </Card>

          <Card title="Set a new password">
            <p className="mb-3 text-sm text-ink/60">
              For a customer who forgot their password. Choose a temporary one and tell them privately. They&apos;re signed out on all devices until they sign in with it.
            </p>
            <AdminForm action={resetCustomerPassword} submit="Set password" confirm={`Set a new password for ${user.name}?`}>
              <input type="hidden" name="id" value={user.id} />
              <div>
                <label htmlFor="password" className="label">New password</label>
                <input id="password" name="password" type="password" minLength={8} autoComplete="new-password" required className="field" />
              </div>
              <div>
                <label htmlFor="confirm" className="label">Repeat password</label>
                <input id="confirm" name="confirm" type="password" minLength={8} autoComplete="new-password" required className="field" />
              </div>
            </AdminForm>
          </Card>
        </div>
      </div>
    </>
  );
}
