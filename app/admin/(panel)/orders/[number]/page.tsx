import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/catalog";
import { eventsForOrders, findDesign, findOrderByNumber, ORDER_STATUSES } from "@/lib/db";
import { designSource, flatDims, getDesignConfig, isGang, needsDesignCheck, printSpec } from "@/lib/design-config";
import {
  approveDesign, artworkResolved, declineRefundAction, flagArtwork, recordPayment, refundOrderAction, saveOrderNotes, updateOrderStatus,
} from "@/lib/admin-actions";
import { ApprovalBadge, ApprovalHistory, SourceBadge } from "@/components/approval";
import { nextStep, STEPS, stepsDone } from "@/lib/order-steps";
import { addressLines } from "@/lib/address";
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
  const hasDesign = needsDesignCheck(order.items);
  const toCheck = ["review", "changes_requested", "proof_sent"].includes(order.approval);

  return (
    <>
      <Link href="/admin/orders" className="text-base font-semibold text-navy hover:underline">← Back to orders</Link>
      <PageHeader title={`Order ${order.number}`}>
        <div className="flex flex-wrap items-center gap-2">
          <PaymentBadge status={order.paymentStatus} />
          {order.refundStatus === "requested" && <span className="rounded-full bg-magenta px-2.5 py-0.5 text-xs font-semibold text-white">Refund requested</span>}
          {(order.refundStatus === "refunded" || order.refundStatus === "partial") && (
            <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-semibold text-navy">{order.refundStatus === "refunded" ? "Refunded" : "Partly refunded"}</span>
          )}
          {placed && <ApprovalBadge approval={order.approval} />}
          <StatusBadge status={order.status} />
          <Link href={`/admin/orders/${order.number}/slip`} className="btn-outline px-4 py-2">Packing slip</Link>
          <Link href={`/admin/orders/${order.number}/invoice`} className="btn-outline px-4 py-2">📄 Invoice</Link>
        </div>
      </PageHeader>
      <p className="-mt-4 mb-6 text-sm text-ink/60">
        Placed {dateTime(order.createdAt)}
        {order.paidAt && ` · paid ${dateTime(order.paidAt)}`}
      </p>

      {/* Where the order is, and the one thing to do next. */}
      <ol className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Order progress">
        {STEPS.map((s, i) => {
          const done = i < stepsDone(order);
          const current = i === stepsDone(order);
          return (
            <li
              key={s.label}
              aria-current={current ? "step" : undefined}
              className={`flex flex-col items-center rounded-2xl px-2 py-3 text-center text-sm font-semibold ${
                done ? "bg-navy text-white" : current ? "bg-yellow/30 text-navy ring-2 ring-yellow" : "bg-mist text-ink/40"
              }`}
            >
              <span aria-hidden className="text-2xl">{done ? "✔️" : s.icon}</span>
              {i + 1}. {s.label}
            </li>
          );
        })}
      </ol>
      {(() => {
        const next = nextStep(order);
        const advance =
          order.approval === "approved" && order.paymentStatus !== "unpaid" && order.refundStatus !== "requested" && order.refundStatus !== "refunded"
            ? order.status === "Received"
              ? { to: "In production", label: "🖨️ Start printing" }
              : order.status === "In production"
                ? { to: "Ready", label: "📦 It's finished: mark Ready" }
                : order.status === "Ready"
                  ? { to: "Completed", label: "✅ Customer has it: mark Done" }
                  : null
            : null;
        return (
          <div className={`mb-6 flex flex-wrap items-center gap-4 rounded-3xl border-2 p-5 ${next.yourTurn ? "border-yellow bg-yellow/10" : "border-line bg-mist"}`}>
            <span aria-hidden className="text-4xl">{next.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/50">{next.yourTurn ? "Your next step" : "Next"}</p>
              <p className="text-xl font-bold text-navy">{next.text}</p>
              {advance?.to === "Ready" && <p className="text-sm text-ink/60">The customer gets an email that their order is ready.</p>}
            </div>
            {advance && (
              <form action={updateOrderStatus}>
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="status" value={advance.to} />
                <SubmitButton className="rounded-full bg-navy px-6 py-4 text-lg font-bold text-white shadow hover:bg-navy-700">{advance.label}</SubmitButton>
              </form>
            )}
            {order.refundStatus === "requested" && (
              <a href="#refund" className="rounded-full bg-navy px-6 py-4 text-lg font-bold text-white shadow hover:bg-navy-700">↩️ Answer the request</a>
            )}
            {order.refundStatus !== "requested" && !advance && toCheck && order.paymentStatus !== "unpaid" && (
              <form action={approveDesign}>
                <input type="hidden" name="id" value={order.id} />
                <SubmitButton
                  className="rounded-full bg-navy px-6 py-4 text-lg font-bold text-white shadow hover:bg-navy-700"
                  confirm={`Approve the design for ${order.number}? The customer gets an email and the order can be printed.`}
                >
                  ✅ Approve design
                </SubmitButton>
              </form>
            )}
          </div>
        );
      })()}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {placed && hasDesign && (
            <Card title="🎨 Design check" className="scroll-mt-24" id="approval">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <ApprovalBadge approval={order.approval} />
                <p className="text-base text-ink/70">
                  {toCheck && "Look at the design previews and print files below. If it looks good, press Approve design."}
                  {order.approval === "artwork_issue" && "You asked the customer to change their design. When they send it, press the button below."}
                  {order.approval === "approved" && "Design approved. This order can be printed."}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {toCheck && (
                  <form action={approveDesign} className="rounded-2xl border-2 border-cyan bg-cyan/5 p-4">
                    <input type="hidden" name="id" value={order.id} />
                    <p className="mb-1 text-base font-bold text-navy">✅ Looks good?</p>
                    <p className="mb-3 text-sm text-ink/60">The customer gets an email that their design is approved.</p>
                    <textarea name="note" rows={2} aria-label="Note (only for staff)" placeholder="Note for the history (optional)" className="field mb-3" />
                    <SubmitButton className="btn-primary w-full py-3 text-base" confirm={`Approve the design for ${order.number}?`}>Approve design</SubmitButton>
                  </form>
                )}
                {toCheck && (
                  <div className="rounded-2xl border-2 border-magenta/30 bg-magenta/5 p-4">
                    <p className="mb-1 text-base font-bold text-navy">✏️ Something to fix?</p>
                    <p className="mb-3 text-sm text-ink/60">Tell the customer what to change. They get it by email and can reply.</p>
                    <AdminForm action={flagArtwork} submit="Send to customer">
                      <input type="hidden" name="id" value={order.id} />
                      <textarea name="note" rows={3} required aria-label="What the customer needs to change" placeholder="e.g. The logo is blurry. Please upload a bigger image." className="field" />
                    </AdminForm>
                  </div>
                )}
                {order.approval === "artwork_issue" && (
                  <form action={artworkResolved} className="rounded-2xl border border-line p-4">
                    <input type="hidden" name="id" value={order.id} />
                    <p className="mb-3 text-base font-bold text-navy">📩 Customer sent the fix?</p>
                    <textarea name="note" rows={2} aria-label="Note" placeholder="Note (optional), e.g. New logo received by email" className="field mb-3" />
                    <SubmitButton className="btn-primary w-full">Check the design again</SubmitButton>
                  </form>
                )}
                {order.approval === "artwork_issue" && (
                  <form action={approveDesign} className="rounded-2xl border border-line p-4">
                    <input type="hidden" name="id" value={order.id} />
                    <p className="mb-3 text-base font-bold text-navy">👍 Fixed it yourself?</p>
                    <textarea name="note" rows={2} aria-label="Note" placeholder="Note (optional)" className="field mb-3" />
                    <SubmitButton confirm={`Approve the design for ${order.number}? The customer gets an email.`}>Approve design</SubmitButton>
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
              <textarea name="notes" rows={4} defaultValue={order.adminNotes} aria-label="Internal notes" placeholder="Only staff see these: pickup time, invoice number…" className="field" />
            </AdminForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Change status by hand">
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
                ? "The customer sees this status in their account and gets an email at each step."
                : "The order can go to printing once the design is approved."}
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

          {order.paymentStatus !== "unpaid" && (() => {
            const total = order.subtotal + order.tax;
            const left = Math.round((total - order.refundAmount) * 100) / 100;
            const requested = order.refundStatus === "requested";
            return (
              <Card title="↩️ Refund" className={requested ? "border-2 border-magenta/40" : ""} id="refund">
                {requested && (
                  <div className="mb-4 rounded-xl bg-magenta/5 p-3 text-sm">
                    <p className="font-bold text-magenta">The customer asked for a refund</p>
                    {order.refundRequestedAt && <p className="text-xs text-ink/50">{dateTime(order.refundRequestedAt)}</p>}
                    <p className="mt-2 whitespace-pre-wrap">&ldquo;{order.refundReason}&rdquo;</p>
                  </div>
                )}
                {order.refundAmount > 0 && (
                  <p className="mb-3 text-sm">
                    Refunded so far: <b className="text-navy">{formatPrice(order.refundAmount)}</b> of {formatPrice(total)}
                    {order.refundedAt && <span className="text-ink/50"> · last {dateTime(order.refundedAt)}</span>}
                  </p>
                )}
                {order.refundStatus === "declined" && <p className="mb-3 text-sm text-ink/60">The last refund request was declined.</p>}
                {left > 0 ? (
                  <>
                    <AdminForm action={refundOrderAction} submit={requested ? "✅ Refund" : "Refund"} confirm="Refund this order? This can't be undone.">
                      <input type="hidden" name="id" value={order.id} />
                      <div>
                        <label htmlFor="refund-amount" className="label">Amount (up to {formatPrice(left)})</label>
                        <input id="refund-amount" name="amount" defaultValue={left.toFixed(2)} inputMode="decimal" required className="field" />
                      </div>
                      <textarea name="note" rows={2} aria-label="Note to the customer" placeholder="Note to the customer (optional)" className="field" />
                      <p className="text-xs text-ink/50">
                        {order.paymentStatus === "paid" && order.stripeSessionId
                          ? "Goes back to their card through Stripe. The customer gets an email."
                          : "Not paid by card online: this records the refund; give the money back by cash or check."}
                      </p>
                    </AdminForm>
                    {requested && (
                      <div className="mt-4 border-t border-line pt-4">
                        <p className="mb-2 text-sm font-semibold text-navy">✖ Decline the request</p>
                        <AdminForm action={declineRefundAction} submit="Decline">
                          <input type="hidden" name="id" value={order.id} />
                          <textarea name="note" rows={2} required aria-label="Why the refund is declined" placeholder="Why? The customer gets this by email." className="field" />
                        </AdminForm>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-semibold text-navy">Refunded in full.</p>
                )}
              </Card>
            );
          })()}

          <Card title="Customer">
            <p className="text-sm font-medium">
              <Link href={`/admin/customers/${order.userId}`} className="text-navy hover:underline">{order.customer.name}</Link>
            </p>
            {order.customer.company && <p className="text-sm text-ink/70">{order.customer.company}</p>}
            <p className="text-sm"><a href={`mailto:${order.customer.email}`} className="underline">{order.customer.email}</a></p>
            {order.customer.phone && <p className="text-sm"><a href={`tel:${order.customer.phone}`} className="underline">{order.customer.phone}</a></p>}
            {order.billingAddress && (
              <div className="mt-3 border-t border-line pt-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Billing address</p>
                {addressLines(order.billingAddress).map((l, i) => <p key={i}>{l}</p>)}
              </div>
            )}
          </Card>

          <Card title="Fulfillment">
            <p className="text-sm">{order.fulfillment === "pickup" ? "Store pickup" : "Local delivery"}</p>
            {order.shippingAddress ? (
              <div className="mt-1 text-sm text-ink/70">{addressLines(order.shippingAddress).map((l, i) => <p key={i}>{l}</p>)}</div>
            ) : (
              order.address && <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{order.address}</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
