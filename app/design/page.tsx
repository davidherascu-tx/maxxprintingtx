import type { Metadata } from "next";
import Link from "next/link";
import { categories, formatPrice, fromPrice, products } from "@/lib/catalog";
import { isDesignable } from "@/lib/design-config";
import { ProductImage } from "@/components/product-card";

export const metadata: Metadata = {
  title: "Design Studio",
  description: "Pick a product, upload your logo or photo, add text and see it come to life.",
};

export default async function DesignSelectPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const designable = products.filter(isDesignable);
  const shown = category ? designable.filter((p) => p.category === category) : designable;

  const pill = (on: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
      on ? "border-navy bg-navy text-white" : "border-line text-ink/70 hover:border-navy/40"
    }`;

  return (
    <div className="container-x py-12">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-magenta/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-magenta">Step 1</span>
        <span className="text-sm text-ink/50">Pick a product → Design it → Add to cart</span>
      </div>
      <h1 className="mt-3 font-display text-4xl text-navy">Design Studio</h1>
      <p className="mt-2 max-w-2xl text-ink/60">
        Choose a product to customize. Upload your logo or photo, add text and shapes, and see a live preview.
      </p>

      <div className="-mx-4 my-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link href="/design" className={pill(!category)}>All</Link>
        {categories.map((c) => (
          <Link key={c.slug} href={`/design?category=${c.slug}`} className={pill(category === c.slug)}>
            {c.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        {shown.map((p) => (
          <Link
            key={p.slug}
            href={`/design/${p.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-navy/5"
          >
            <div className="relative aspect-square bg-mist">
              <ProductImage product={p} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-navy px-4 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                Start designing
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <span className="font-semibold leading-snug">{p.name}</span>
              <span className="mt-auto pt-1 text-sm text-ink/60">
                From <span className="font-semibold text-navy">{formatPrice(fromPrice(p))}</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
