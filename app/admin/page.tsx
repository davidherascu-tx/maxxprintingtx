import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { allOrders, findDesign, ORDER_STATUSES } from "@/lib/db";
import { updateOrderStatus } from "@/lib/actions";
import { formatPrice, getProduct } from "@/lib/catalog";
import { flatDims, getDesignConfig, printSpec } from "@/lib/design-config";
import { getCurrentUser, isAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };

const statusColor: Record<string, string> = {
  Received: "bg-cyan/15 text-navy",
  "In production": "bg-yellow/30 text-navy",
  Ready: "bg-magenta/15 text-magenta",
  Completed: "bg-mist text-ink/60",
};

const inches = (n: number) => `${+n.toFixed(3)}"`;

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/admin");
  if (!isAdmin(user)) notFound();

  const orders = await allOrders();
  const ids = [...new Set(orders.flatMap((o) => o.items.flatMap((i) => (i.designId ? [i.designId] : []))))];
  const designs = new Map((await Promise.all(ids.map((id) => findDesign(id)))).flatMap((d) => (d ? [[d.id, d] as const] : [])));

  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl text-navy">Orders</h1>
      <p className="mt-2 text-ink/60">
        {orders.length} most recent orders. Print files are full size, with bleed, at the DPI shown. PDFs are CMYK with TrimBox/BleedBox set; contour-cut jobs carry the cut line as a CutContour spot color.
      </p>

      <ul className="mt-8 space-y-6">
        {orders.map((o) => (
          <li key={o.id} className="rounded-2xl border border-line p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-lg font-semibold text-navy">{o.number}</span>
                <span className="ml-3 text-sm text-ink/50">{new Date(o.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                <p className="mt-1 text-sm text-ink/70">
                  {o.customer.name}
                  {o.customer.company && ` · ${o.customer.company}`} ·{" "}
                  <a href={`mailto:${o.customer.email}`} className="underline">{o.customer.email}</a>
                  {o.customer.phone && <> · <a href={`tel:${o.customer.phone}`} className="underline">{o.customer.phone}</a></>}
                </p>
                <p className="text-sm text-ink/70">
                  {o.fulfillment === "pickup" ? "Store pickup" : `Delivery: ${o.address}`}
                </p>
              </div>
              <form action={updateOrderStatus} className="flex items-center gap-2">
                <input type="hidden" name="id" value={o.id} />
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    o.paymentStatus === "paid" ? "bg-cyan/15 text-navy" : o.paymentStatus === "unpaid" ? "bg-magenta/15 text-magenta" : "bg-mist text-ink/60"
                  }`}
                >
                  {o.paymentStatus === "paid" ? "Paid" : o.paymentStatus === "unpaid" ? "Awaiting payment" : "Invoiced"}
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[o.status]}`}>{o.status}</span>
                <select name="status" defaultValue={o.status} className="field w-auto px-3 py-1.5 text-sm" aria-label="Order status">
                  {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button type="submit" className="btn-outline px-3 py-1.5 text-sm">Update</button>
              </form>
            </div>

            {o.notes && <p className="mt-3 rounded-lg bg-yellow/20 px-3 py-2 text-sm text-navy"><b>Customer notes:</b> {o.notes}</p>}

            <ul className="mt-4 divide-y divide-line">
              {o.items.map((i, n) => {
                const design = i.designId ? designs.get(i.designId) : undefined;
                const product = getProduct(i.slug);
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
                        <p className="font-medium">{i.name} × {i.qty}</p>
                        <p className="text-ink/60">{i.color && `${i.color} · `}{i.variant}</p>
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
                        <span key={side} className="flex gap-2">
                          <a href={`/api/designs/${design.id}/${side}-print.png`} download className="btn-primary px-3 py-1.5 text-sm">
                            Print file{design.sides.length > 1 ? ` (${side})` : ""}
                          </a>
                          <a href={`/api/designs/${design.id}/${side}-print.pdf`} download className="btn-outline px-3 py-1.5 text-sm">
                            PDF
                          </a>
                          <a href={`/api/designs/${design.id}/${side}-print.pdf?marks=1`} download className="btn-outline px-3 py-1.5 text-sm">
                            PDF + crop marks
                          </a>
                          {spec?.cut && (
                            <a href={`/api/designs/${design.id}/${side}-cut.svg`} download className="btn-outline px-3 py-1.5 text-sm">
                              Cut path
                            </a>
                          )}
                        </span>
                      ))}
                      <span className="w-20 text-right font-medium">{formatPrice(i.price * i.qty)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-right text-sm text-ink/60">
              Subtotal {formatPrice(o.subtotal)} · Tax {formatPrice(o.tax)} ·{" "}
              <span className="font-semibold text-navy">Total {formatPrice(o.subtotal + o.tax)}</span>
            </p>
          </li>
        ))}
        {orders.length === 0 && <li className="rounded-2xl border border-dashed border-line p-10 text-center text-ink/60">No orders yet.</li>}
      </ul>
    </div>
  );
}
