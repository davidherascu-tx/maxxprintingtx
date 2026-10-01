import type { Metadata } from "next";
import { categories, products } from "@/lib/catalog";
import { ProductGrid } from "@/components/product-card";
import { CategoryPills } from "@/components/category-pills";

export const metadata: Metadata = { title: "Shop all products" };

export default function ShopPage() {
  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl text-navy">Shop all products</h1>
      <p className="mt-2 text-ink/60">{products.length} products across {categories.length} categories.</p>
      <CategoryPills />
      <ProductGrid products={products} />
    </div>
  );
}
