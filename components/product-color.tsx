"use client";

import { createContext, useContext, useState } from "react";
import { colorOf, type Product } from "@/lib/catalog";
import { ProductImage } from "./product-card";

// Shares the chosen color between the product photo and the add-to-cart form.
const ColorContext = createContext<[string | undefined, (id: string) => void]>([undefined, () => {}]);

export function ColorProvider({ product, children }: { product: Product; children: React.ReactNode }) {
  const state = useState(product.colors?.[0]?.id);
  return <ColorContext.Provider value={state}>{children}</ColorContext.Provider>;
}

export const useColor = () => useContext(ColorContext);

export function ColorImage({ product, sizes }: { product: Product; sizes: string }) {
  const [color] = useColor();
  return <ProductImage product={product} sizes={sizes} priority src={colorOf(product, color)?.image ?? product.image} />;
}
