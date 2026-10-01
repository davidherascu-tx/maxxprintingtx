import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getCategory, productsIn } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";
import { CategoryPills } from "@/components/category-pills";

export function generateStaticParams() {
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const category = getCategory((await params).slug);
  return category ? { title: category.name, description: category.blurb } : {};
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const items = productsIn(slug);

  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl text-navy">{category.name}</h1>
      <p className="mt-2 max-w-2xl text-ink/60">{category.blurb}</p>
      <CategoryPills active={slug} />
      <ProductGrid products={items} />
    </div>
  );
}
