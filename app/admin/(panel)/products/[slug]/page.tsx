import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { baseCategories, baseProduct, formatPrice, saleEndLabel, saleRunning } from "@/lib/catalog";
import { endSale, resetProduct, saveProduct } from "@/lib/admin-actions";
import { houstonDay } from "@/lib/dates";
import { requireStaff } from "@/lib/staff-session";
import { getNow, getOverrides } from "@/lib/store";
import { AdminForm, SubmitButton } from "@/components/admin/admin-form";
import { Card, PageHeader } from "@/components/admin/ui";
import { ProductImage } from "@/components/product-card";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: baseProduct((await params).slug)?.name ?? "Product" };
}

const priceValue = (p: number | null) => (p === null ? "" : p.toFixed(2));

export default async function AdminProduct({ params }: Props) {
  const { slug } = await params;
  await requireStaff(`/admin/products/${slug}`);
  const base = baseProduct(slug);
  if (!base) notFound();
  const o = (await getOverrides())[slug] ?? {};
  const hasSale = Object.values(o.variants ?? {}).some((v) => v.salePrice !== undefined);
  const running = hasSale && saleRunning(o, getNow());

  return (
    <>
      <Link href="/admin/products" className="text-sm text-ink/60 hover:text-navy">← Products</Link>
      <PageHeader title={o.name ?? base.name}>
        <Link href={`/product/${slug}`} target="_blank" className="btn-outline px-4 py-2">View in shop ↗</Link>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <Card>
          <AdminForm action={saveProduct} submit="Save product" className="space-y-6">
            <input type="hidden" name="slug" value={slug} />
            <div>
              <label htmlFor="name" className="label">Name</label>
              <input id="name" name="name" defaultValue={o.name ?? base.name} required className="field" />
              {o.name && <p className="mt-1 text-xs text-ink/50">Original: {base.name}</p>}
            </div>
            <div>
              <label htmlFor="description" className="label">Description</label>
              <textarea id="description" name="description" rows={5} defaultValue={o.description ?? base.description} className="field" />
              <p className="mt-1 text-xs text-ink/50">Leave empty to use the original description.</p>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="featured" defaultChecked={o.featured ?? !!base.featured} className="h-4 w-4 accent-navy" />
                Featured on the home page
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="hidden" defaultChecked={!!o.hidden} className="h-4 w-4 accent-magenta" />
                Hide product from the shop
              </label>
            </div>

            <fieldset className="rounded-xl border border-magenta/25 bg-magenta/5 p-4">
              <legend className="px-1 text-sm font-semibold text-magenta">Sale</legend>
              <p className="text-sm text-ink/70">
                {!hasSale && "Not on sale. Enter a sale price for one or more options below to start a sale."}
                {hasSale && running && (o.saleEndsAt ? `On sale now, through ${saleEndLabel(o.saleEndsAt)}.` : "On sale now, with no end date.")}
                {hasSale && !running && o.saleEndsAt && `The sale ended after ${saleEndLabel(o.saleEndsAt)}. Regular prices apply. Clear the sale prices or pick a new end date to run it again.`}
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="saleEnds" className="label">Last day of the sale (optional)</label>
                  <input
                    id="saleEnds"
                    name="saleEnds"
                    type="date"
                    min={houstonDay(getNow())}
                    defaultValue={o.saleEndsAt ? houstonDay(Date.parse(o.saleEndsAt) - 1000) : ""}
                    className="field w-auto"
                  />
                </div>
                <p className="pb-3 text-xs text-ink/50">Sale prices stop at midnight (Houston time) after this day. Leave empty to run until you end it.</p>
              </div>
            </fieldset>

            <fieldset>
              <legend className="label">{base.variantLabel} &amp; prices</legend>
              <p className="mb-3 text-xs text-ink/50">Leave a price empty for &ldquo;price on request&rdquo; (shown, but can&apos;t be added to the cart). Hidden options aren&apos;t offered.</p>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className="bg-mist text-ink/60">
                    <tr>
                      <th className="px-3 py-2 font-medium">Option</th>
                      <th className="px-3 py-2 font-medium">Price (USD)</th>
                      <th className="px-3 py-2 font-medium text-magenta">Sale price</th>
                      <th className="px-3 py-2 font-medium">Original</th>
                      <th className="px-3 py-2 text-center font-medium">Hide</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {base.variants.map((v) => {
                      const vo = o.variants?.[v.id];
                      const price = vo && vo.price !== undefined ? vo.price : v.price;
                      return (
                        <tr key={v.id}>
                          <td className="px-3 py-2">{v.label}{v.group && <span className="text-ink/50"> · {v.group}</span>}</td>
                          <td className="px-3 py-1.5">
                            <input
                              name={`price:${v.id}`}
                              defaultValue={priceValue(price)}
                              inputMode="decimal"
                              placeholder="On request"
                              aria-label={`Price for ${v.label}`}
                              className="field w-32 px-3 py-1.5"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              name={`sale:${v.id}`}
                              defaultValue={vo?.salePrice !== undefined ? vo.salePrice.toFixed(2) : ""}
                              inputMode="decimal"
                              placeholder="—"
                              aria-label={`Sale price for ${v.label}`}
                              className="field w-28 border-magenta/30 px-3 py-1.5"
                            />
                          </td>
                          <td className={`px-3 py-2 ${price !== v.price ? "text-magenta" : "text-ink/50"}`}>{v.price === null ? "On request" : formatPrice(v.price)}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox" name={`hidden:${v.id}`} defaultChecked={!!vo?.hidden} aria-label={`Hide ${v.label}`} className="h-4 w-4 accent-magenta" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </fieldset>
          </AdminForm>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="relative aspect-square overflow-hidden rounded-xl bg-mist">
              <ProductImage product={base} sizes="18rem" />
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <div><dt className="inline text-ink/50">Category: </dt><dd className="inline">{baseCategories.find((c) => c.slug === base.category)?.name}</dd></div>
              <div><dt className="inline text-ink/50">Minimum quantity: </dt><dd className="inline">{base.minQty}</dd></div>
              {base.colors && <div><dt className="inline text-ink/50">Colors: </dt><dd className="inline">{base.colors.map((c) => c.label).join(", ")}</dd></div>}
              <div><dt className="inline text-ink/50">Slug: </dt><dd className="inline font-mono text-xs">{slug}</dd></div>
            </dl>
          </Card>
          {hasSale && (
            <Card title="End the sale">
              <p className="mb-3 text-sm text-ink/60">Remove all sale prices now. Regular prices apply right away.</p>
              <form action={endSale}>
                <input type="hidden" name="slug" value={slug} />
                <SubmitButton confirm="End the sale and remove all sale prices for this product?">End sale now</SubmitButton>
              </form>
            </Card>
          )}
          {Object.keys(o).length > 0 && (
            <Card title="Undo edits">
              <p className="mb-3 text-sm text-ink/60">Go back to the name, description, prices and visibility defined in code.</p>
              <form action={resetProduct}>
                <input type="hidden" name="slug" value={slug} />
                <SubmitButton confirm="Reset this product to its original settings? Your edits are removed.">Reset to original</SubmitButton>
              </form>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
