import Image from "next/image";
import Link from "next/link";
import { formatPrice, fromPrice, getCategory, type Product } from "@/lib/catalog";

export function ProductImage({ product, sizes, priority }: { product: Product; sizes: string; priority?: boolean }) {
  if (!product.image) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-navy to-navy-700 p-6 text-center">
        <div>
          <div className="mx-auto mb-3 flex w-16 overflow-hidden rounded-full">
            <span className="h-1.5 flex-1 bg-cyan" />
            <span className="h-1.5 flex-1 bg-magenta" />
            <span className="h-1.5 flex-1 bg-yellow" />
          </div>
          <span className="font-display text-xl text-white">{product.name}</span>
        </div>
      </div>
    );
  }
  return (
    <Image
      src={product.image}
      alt={product.name}
      fill
      sizes={sizes}
      priority={priority}
      className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
    />
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-navy/5"
    >
      <div className="relative aspect-square bg-mist">
        <ProductImage product={product} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-xs font-medium uppercase tracking-wider text-magenta">
          {getCategory(product.category)?.name}
        </span>
        <span className="font-semibold leading-snug text-ink">{product.name}</span>
        <span className="mt-auto pt-2 text-sm text-ink/60">
          From <span className="font-semibold text-navy">{formatPrice(fromPrice(product))}</span>
        </span>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 sm:gap-6">
      {products.map((p) => (
        <ProductCard key={p.slug} product={p} />
      ))}
    </div>
  );
}
