import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product-card";
import { CategoryPills } from "@/components/category-pills";
import { getCatalog } from "@/lib/store";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const category = (await getCatalog()).getCategory((await params).slug);
  return category ? { title: category.name, description: category.blurb } : {};
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { getCategory, productsIn } = await getCatalog();
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
