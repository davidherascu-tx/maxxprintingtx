import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory, getProduct, products, productsIn } from "@/lib/catalog";
import { ProductGrid, ProductImage } from "@/components/product-card";
import { AddToCart } from "@/components/add-to-cart";
import { isDesignable } from "@/lib/design-config";

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = getProduct((await params).slug);
  return product ? { title: product.name, description: product.description } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const category = getCategory(product.category)!;
  const related = productsIn(product.category).filter((p) => p.slug !== slug).slice(0, 4);

  return (
    <div className="container-x py-10">
      <nav className="mb-6 text-sm text-ink/50">
        <Link href="/shop" className="hover:text-navy">Shop</Link>
        <span className="mx-2">/</span>
        <Link href={`/category/${category.slug}`} className="hover:text-navy">{category.name}</Link>
        <span className="mx-2">/</span>
        <span className="text-ink/80">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="group relative aspect-square overflow-hidden rounded-3xl border border-line bg-mist">
          <ProductImage product={product} sizes="(min-width: 1024px) 50vw, 100vw" priority />
        </div>

        <div>
          <span className="text-sm font-medium uppercase tracking-wider text-magenta">{category.name}</span>
          <h1 className="mt-2 font-display text-3xl text-navy sm:text-4xl">{product.name}</h1>
          <p className="mt-4 text-ink/70">{product.description}</p>

          {isDesignable(product) && (
            <Link
              href={`/design/${product.slug}`}
              className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-magenta/30 bg-magenta/5 p-4 transition hover:bg-magenta/10"
            >
              <span>
                <span className="block font-semibold text-magenta">Customize it in the Design Studio</span>
                <span className="block text-sm text-ink/60">Upload your logo or photo and add text, then see a live preview.</span>
              </span>
              <span className="btn-accent shrink-0 px-4 py-2">Design</span>
            </Link>
          )}

          <AddToCart product={product} />

          <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-ink/70">
            {product.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <svg className="mt-0.5 shrink-0 text-cyan" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                  <path d="M5 12l5 5L20 7" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-xl bg-mist p-4 text-sm text-ink/70">
            After you order, our team will reach out to collect your artwork and send a proof before printing.
            Bulk pricing available — <Link href="/contact" className="font-medium text-navy underline">contact us</Link>.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-display text-2xl text-navy">More {category.name}</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
