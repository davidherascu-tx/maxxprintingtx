import type { Metadata } from "next";
import Link from "next/link";
import { baseCategories, formatPrice, fromPrice } from "@/lib/catalog";
import { setProductHidden } from "@/lib/admin-actions";
import { requireStaff } from "@/lib/staff-session";
import { getCatalog, getOverrides } from "@/lib/store";
import { SubmitButton } from "@/components/admin/admin-form";
import { Card, PageHeader } from "@/components/admin/ui";
import { ProductImage } from "@/components/product-card";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; show?: string }> }) {
  await requireStaff("/admin/products");
  const [sp, catalog, overrides] = await Promise.all([searchParams, getCatalog(), getOverrides()]);
  const q = sp.q?.trim().toLowerCase();
  const list = catalog.all.filter(
    (p) =>
      (!sp.category || p.category === sp.category) &&
      (!q || p.name.toLowerCase().includes(q) || p.slug.includes(q)) &&
      (sp.show !== "hidden" || p.hidden) &&
      (sp.show !== "edited" || overrides[p.slug]) &&
      (sp.show !== "sale" || p.onSale),
  );

  return (
    <>
      <PageHeader title="Products" />
      <p className="-mt-3 mb-5 max-w-3xl text-sm text-ink/60">
        Products, photos, options and design-studio setups are defined in the code (<code>lib/catalog.ts</code>). Here you can change names,
        descriptions and prices, hide products or options, and choose what&apos;s featured on the home page. New products are added in code.
      </p>
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search products" aria-label="Search products" className="field w-full sm:w-64" />
        <select name="category" defaultValue={sp.category ?? ""} aria-label="Category" className="field w-auto">
          <option value="">All categories</option>
          {baseCategories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <select name="show" defaultValue={sp.show ?? ""} aria-label="Show" className="field w-auto">
          <option value="">All products</option>
          <option value="hidden">Hidden only</option>
          <option value="edited">Edited only</option>
          <option value="sale">On sale</option>
        </select>
        <button type="submit" className="btn-primary px-5">Filter</button>
      </form>
      <p className="mb-3 text-sm text-ink/60">{list.length} of {catalog.all.length} products · {catalog.all.filter((p) => p.hidden).length} hidden</p>
      <Card>
        <ul className="-my-2 divide-y divide-line">
          {list.map((p) => {
            const from = fromPrice(p);
            return (
              <li key={p.slug} className="flex flex-wrap items-center gap-4 py-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-mist">
                  <ProductImage product={p} sizes="56px" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/products/${p.slug}`} className="font-medium text-navy hover:underline">{p.name}</Link>
                  <p className="text-xs text-ink/50">
                    {baseCategories.find((c) => c.slug === p.category)?.name} · {p.variants.length} {p.variants.length === 1 ? "option" : "options"} ·{" "}
                    {from === null ? "Price on request" : `from ${formatPrice(from)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {p.hidden && <span className="rounded-full bg-magenta/15 px-2.5 py-0.5 text-xs font-semibold text-magenta">Hidden</span>}
                  {p.onSale && <span className="rounded-full bg-magenta px-2.5 py-0.5 text-xs font-semibold text-white">On sale</span>}
                  {!p.onSale && Object.values(overrides[p.slug]?.variants ?? {}).some((v) => v.salePrice !== undefined) && (
                    <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-semibold text-ink/60">Sale ended</span>
                  )}
                  {p.featured && <span className="rounded-full bg-yellow/30 px-2.5 py-0.5 text-xs font-semibold text-navy">Featured</span>}
                  {overrides[p.slug] && <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-semibold text-ink/60">Edited</span>}
                  <form action={setProductHidden}>
                    <input type="hidden" name="slug" value={p.slug} />
                    <input type="hidden" name="hidden" value={p.hidden ? "0" : "1"} />
                    <SubmitButton>{p.hidden ? "Show" : "Hide"}</SubmitButton>
                  </form>
                  <Link href={`/admin/products/${p.slug}`} className="btn-outline px-3 py-1.5 text-sm">Edit</Link>
                  {!p.hidden && <Link href={`/product/${p.slug}`} className="text-sm text-ink/50 hover:text-navy" target="_blank">View ↗</Link>}
                </div>
              </li>
            );
          })}
          {list.length === 0 && <li className="py-6 text-center text-sm text-ink/50">No products match.</li>}
        </ul>
      </Card>
    </>
  );
}
