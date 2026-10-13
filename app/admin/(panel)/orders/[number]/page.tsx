import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/catalog";
import { eventsForOrders, findDesign, findOrderByNumber, ORDER_STATUSES } from "@/lib/db";
import { designSource, flatDims, getDesignConfig, isGang, printSpec } from "@/lib/design-config";
import {
  approveForCustomer, artworkResolved, flagArtwork, recordPayment, saveOrderNotes, sendProof, updateOrderStatus,
} from "@/lib/admin-actions";
import { ApprovalBadge, ApprovalHistory, SourceBadge } from "@/components/approval";
import { requireStaff } from "@/lib/staff-session";
import { getCatalog } from "@/lib/store";
import { AdminForm, SubmitButton } from "@/components/admin/admin-form";
import { Card, dateTime, PageHeader, PaymentBadge, StatusBadge } from "@/components/admin/ui";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Order ${(await params).number}` };
}

const inches = (n: number) => `${+n.toFixed(3)}"`;

export default async function AdminOrder({ params }: Props) {
  const { number } = await params;
  await requireStaff(`/admin/orders/${number}`);
  const order = await findOrderByNumber(number);
  if (!order) notFound();
  const catalog = await getCatalog();
  const ids = [...new Set(order.items.flatMap((i) => (i.designId ? [i.designId] : [])))];
  const designs = new Map((await Promise.all(ids.map((id) => findDesign(id)))).flatMap((d) => (d ? [[d.id, d] as const] : [])));
  const events = await eventsForOrders([order.id]);
  const placed = order.paymentStatus !== "unpaid";
  const canProof = ["review", "changes_requested", "proof_sent"].includes(order.approval);

  return (
    <>
      <Link href="/admin/orders" className="text-sm text-ink/60 hover:text-navy">← Orders</Link>
      <PageHeader title={`Order ${order.number}`}>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentBadge status={order.paymentStatus} />
          {placed && <ApprovalBadge approval={order.approval} />}
          <StatusBadge status={order.status} />
          <Link href={`/admin/orders/${order.number}/slip`} className="btn-outline px-4 py-2">Packing slip</Link>
        </div>
      </PageHeader>
      <p className="-mt-4 mb-6 text-sm text-ink/60">
        Placed {dateTime(order.createdAt)}
        {order.paidAt && ` · paid ${dateTime(order.paidAt)}`}
      </p>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {placed && (
            <Card title="Artwork approval">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <ApprovalBadge approval={order.approval} />
                <p className="text-sm text-ink/60">
                  {order.approval === "review" && "Check the artwork, then send the customer a proof (or tell them what's missing)."}
                  {order.approval === "artwork_issue" && "Waiting for the customer to send new artwork. Mark it received when it arrives."}
                  {order.approval === "proof_sent" && "The customer can approve the proof or ask for changes in their account."}
                  {order.approval === "changes_requested" && "The customer asked for changes (see the history below). Send an updated proof."}
                  {order.approval === "approved" && "Approved. You can move this order to production."}
                </p>
              </div>
              {order.approval !== "approved" && (
                <p className="mb-4 rounded-lg bg-yellow/20 px-3 py-2 text-xs text-navy">
                  The website doesn&apos;t email customers yet: after sending a proof or a message, let the customer know by email or phone.
                </p>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                {canProof && (
                  <div className="rounded-xl border border-line p-4">
                    <p className="mb-3 text-sm font-semibold text-navy">{order.approval === "proof_sent" ? "Send an updated proof" : "Send proof"}</p>
                    <AdminForm action={sendProof} submit="Send proof to customer">
                      <input type="hidden" name="id" value={order.id} />
                      <textarea name="note" rows={3} aria-label="Message to the customer" placeholder="Message to the customer (optional): sizes, colors, placement…" className="field" />
                      <div>
                        <label htmlFor="proof-image" className="label">Proof image (optional, up to 8 MB)</label>
                        <input id="proof-image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="block w-full text-sm" />
                        <p className="mt-1 text-xs text-ink/50">The customer also sees the design previews from their order.</p>
                      </div>
                    </AdminForm>
                  </div>
                )}
                {canProof && (
                  <div className="rounded-xl border border-line p-4">
                    <p className="mb-3 text-sm font-semibold text-navy">Problem with the artwork?</p>
                    <AdminForm action={flagArtwork} submit="Ask customer for artwork">
                      <input type="hidden" name="id" value={order.id} />
                      <textarea name="note" rows={3} required aria-label="What the customer needs to fix" placeholder="e.g. The logo is too low resolution. Please send a larger PNG or a PDF." className="field" />
                    </AdminForm>
                  </div>
                )}
                {order.approval === "artwork_issue" && (
                  <form action={artworkResolved} className="rounded-xl border border-line p-4">
                    <input type="hidden" name="id" value={order.id} />
                    <p className="mb-3 text-sm font-semibold text-navy">New artwork arrived?</p>
                    <textarea name="note" rows={2} aria-label="Note" placeholder="Note (optional), e.g. Received new logo by email" className="field mb-3" />
                    <SubmitButton className="btn-primary">Artwork received · back to review</SubmitButton>
                  </form>
                )}
                {order.approval !== "approved" && (
                  <form action={approveForCustomer} className="rounded-xl border border-line p-4">
                    <input type="hidden" name="id" value={order.id} />
                    <p className="mb-3 text-sm font-semibold text-navy">Approved by phone, email or in store?</p>
                    <textarea name="note" rows={2} aria-label="How it was approved" placeholder="e.g. Approved by phone with Maria, 2:30 pm" className="field mb-3" />
                    <SubmitButton confirm={`Record that the customer approved ${order.number}? It can then go to production.`}>Mark as approved</SubmitButton>
                  </form>
                )}
              </div>

              {events.length > 0 && (
                <div className="mt-6 border-t border-line pt-4">
                  <p className="mb-3 text-sm font-semibold text-navy">History</p>
                  <ApprovalHistory events={events} orderId={order.id} />
                </div>
              )}
            </Card>
          )}

          <Card title="Items">
            <p className="mb-3 text-xs text-ink/50">
              Print files are full size, with bleed, at the DPI shown. PDFs are CMYK with TrimBox/BleedBox set; contour-cut jobs carry the cut line as a CutContour spot color.
            </p>
            <ul className="divide-y divide-line">
              {order.items.map((i, n) => {
                const design = i.designId ? designs.get(i.designId) : undefined;
                const product = catalog.findProduct(i.slug);
                const config = getDesignConfig(i.slug);
                const variant = product?.variants.find((v) => v.label === i.variant);
                const dims = config?.kind === "flat" && variant ? flatDims(i.slug, variant.id) : undefined;
                const spec = config ? printSpec(config, dims) : undefined;
                return (
                  <li key={n} className="flex flex-wrap items-start justify-between gap-4 py-3">
                    <div className="flex items-start gap-3">
                      {i.preview && (
                        // eslint-disable-next-line @next/next/no-img-element -- design preview served by our API
                        <img src={i.preview} alt="Design preview" className="h-16 w-16 rounded-md bg-mist object-contain" />
                      )}
                      <div className="text-sm">
                        <p className="flex flex-wrap items-center gap-2 font-medium">{i.name} × {i.qty} <SourceBadge source={designSource(i)} /></p>
                        <p className="text-ink/60">{i.color && `${i.color} · `}{i.variant} · {formatPrice(i.price)} each</p>
                        {spec && design && (
                          <p className="mt-1 text-xs text-ink/50">
                            {dims && `${inches(dims[0])} × ${inches(dims[1])} trim · `}
                            {spec.dpi} DPI{spec.bleedIn > 0 && ` · ${inches(spec.bleedIn)} bleed`}
                            {spec.cut && " · contour cut"}
                          </p>
                        )}
                        {i.designId && !design && <p className="mt-1 text-xs text-magenta">Design record not found.</p>}
                        {!i.designId && <p className="mt-1 text-xs text-ink/50">No design: customer will send artwork.</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {design?.sides.map((side) => (
                        <span key={side} className="flex flex-wrap gap-2">
                          <a href={`/api/designs/${design.id}/${side}-print.png`} download className="btn-primary px-3 py-1.5 text-sm">
                            Print file{design.sides.length > 1 ? ` (${side})` : ""}
                          </a>
                          {/* Gang sheets are too large to convert to PDF on the server: use the PNG. */}
                          {!(config && isGang(config)) && (
                            <>
                              <a href={`/api/designs/${design.id}/${side}-print.pdf`} download className="btn-outline px-3 py-1.5 text-sm">PDF</a>
                              <a href={`/api/designs/${design.id}/${side}-print.pdf?marks=1`} download className="btn-outline px-3 py-1.5 text-sm">PDF + crop marks</a>
                            </>
                          )}
                          {spec?.cut && (
                            <a href={`/api/designs/${design.id}/${side}-cut.svg`} download className="btn-outline px-3 py-1.5 text-sm">Cut path</a>
                          )}
                        </span>
                      ))}
                      <span className="w-20 text-right font-medium">{formatPrice(i.price * i.qty)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-right text-sm">
              <div className="text-ink/60">Subtotal {formatPrice(order.subtotal)}</div>
              <div className="text-ink/60">Tax {formatPrice(order.tax)}</div>
              <div className="font-semibold text-navy">Total {formatPrice(order.subtotal + order.tax)}</div>
            </dl>
          </Card>

          {order.notes && (
            <Card title="Customer notes">
              <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
            </Card>
          )}

          <Card title="Internal notes">
            <AdminForm action={saveOrderNotes} submit="Save notes">
              <input type="hidden" name="id" value={order.id} />
              <textarea name="notes" rows={4} defaultValue={order.adminNotes} aria-label="Internal notes" placeholder="Only staff see these: proof sent, pickup time, invoice number…" className="field" />
            </AdminForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <form action={updateOrderStatus} className="flex gap-2">
              <input type="hidden" name="id" value={order.id} />
              <select name="status" defaultValue={order.status} aria-label="Order status" className="field">
                {ORDER_STATUSES.map((s) => (
                  <option key={s} disabled={s !== "Received" && order.approval !== "approved"}>{s}</option>
                ))}
              </select>
              <SubmitButton className="btn-primary px-4">Update</SubmitButton>
            </form>
            <p className="mt-2 text-xs text-ink/50">
              {order.approval === "approved"
                ? "The customer sees this status in their account."
                : "The order can go to production once the artwork is approved."}
            </p>
          </Card>

          <Card title="Payment">
            <p className="text-sm"><PaymentBadge status={order.paymentStatus} /></p>
            {order.stripeSessionId && order.paymentStatus === "paid" && <p className="mt-2 text-xs text-ink/50">Paid by card through Stripe.</p>}
            {order.paymentStatus !== "paid" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={recordPayment}>
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="to" value="paid" />
                  <SubmitButton confirm={`Mark ${order.number} as paid? Only do this for a payment taken outside the website (cash, check, card in store).`}>
                    Mark as paid
                  </SubmitButton>
                </form>
                {order.paymentStatus === "unpaid" && (
                  <form action={recordPayment}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="to" value="invoice" />
                    <SubmitButton confirm={`Mark ${order.number} as invoiced? It becomes a real order the customer pays later.`}>
                      Mark as invoiced
                    </SubmitButton>
                  </form>
                )}
              </div>
            )}
            {order.paymentStatus === "unpaid" && (
              <p className="mt-2 text-xs text-ink/50">The customer hasn&apos;t finished paying online. If they start a new checkout, this order is replaced.</p>
            )}
          </Card>

          <Card title="Customer">
            <p className="text-sm font-medium">
              <Link href={`/admin/customers/${order.userId}`} className="text-navy hover:underline">{order.customer.name}</Link>
            </p>
            {order.customer.company && <p className="text-sm text-ink/70">{order.customer.company}</p>}
            <p className="text-sm"><a href={`mailto:${order.customer.email}`} className="underline">{order.customer.email}</a></p>
            {order.customer.phone && <p className="text-sm"><a href={`tel:${order.customer.phone}`} className="underline">{order.customer.phone}</a></p>}
          </Card>

          <Card title="Fulfillment">
            <p className="text-sm">{order.fulfillment === "pickup" ? "Store pickup" : "Local delivery"}</p>
            {order.address && <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{order.address}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
