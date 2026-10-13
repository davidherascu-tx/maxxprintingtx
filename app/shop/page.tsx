import type { Metadata } from "next";
import { ProductGrid } from "@/components/product-card";
import { CategoryPills } from "@/components/category-pills";
import { getCatalog } from "@/lib/store";

export const metadata: Metadata = { title: "Shop all products" };

export default async function ShopPage() {
  const { categories, products } = await getCatalog();
  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl text-navy">Shop all products</h1>
      <p className="mt-2 text-ink/60">{products.length} products across {categories.length} categories.</p>
      <CategoryPills />
      <ProductGrid products={products} />
    </div>
  );
}
