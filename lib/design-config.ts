import { getProduct, type Product } from "./catalog";

/** Print area as fractions of the mockup image (0–1). */
export type Area = { x: number; y: number; w: number; h: number };

export type MockupSide = {
  id: string;
  label: string;
  mockup: string;
  area: Area;
  /** Real-world width of the print area in inches, used for print-quality checks. */
  widthIn: number;
};

export type DesignConfig =
  | { kind: "mockup"; sides: MockupSide[] }
  | {
      kind: "flat";
      shape: "rect" | "circle";
      sides: { id: string; label: string }[];
      /** Width × height in inches, per variant id (falls back to `size`). */
      dims: Record<string, [number, number]>;
      size: [number, number];
      transparent?: boolean;
      note?: string;
    };

const tee = (front: string, back?: string, area: Area = { x: 0.3, y: 0.2, w: 0.4, h: 0.5 }, widthIn = 12) => {
  const sides: MockupSide[] = [{ id: "front", label: "Front", mockup: front, area, widthIn }];
  if (back) sides.push({ id: "back", label: "Back", mockup: back, area: { ...area, y: area.y - 0.03 }, widthIn });
  return { kind: "mockup" as const, sides };
};

const front = [{ id: "front", label: "Front" }];
const frontBack = [...front, { id: "back", label: "Back" }];

const configs: Record<string, DesignConfig> = {
  // Yard Signs
  "coroplast-yard-signs": {
    kind: "flat",
    shape: "rect",
    sides: frontBack,
    dims: { "12x18": [18, 12], "18x24": [24, 18], "24x36": [36, 24] },
    size: [24, 18],
  },
  "big-heads": {
    kind: "flat",
    shape: "rect",
    sides: front,
    dims: { "18": [14, 18], "24": [19, 24], "36": [28, 36] },
    size: [19, 24],
    transparent: true,
    note: "We contour cut around your design.",
  },
  "custom-cut-outs": {
    kind: "flat",
    shape: "rect",
    sides: front,
    dims: { "24": [24, 24], "36": [36, 36], "48": [48, 48] },
    size: [24, 24],
    transparent: true,
    note: "We contour cut around your design.",
  },
  // Retractable Banners
  "retractable-banner": {
    kind: "flat",
    shape: "rect",
    sides: front,
    dims: { "24x80": [24, 80], "33x80": [33, 80], "48x80": [48, 80] },
    size: [33, 80],
  },
  // Dress Shirts
  "camo-shirt": tee("/products/1000055.png", undefined, { x: 0.3, y: 0.25, w: 0.4, h: 0.48 }),
  "shaka-wear-shirt": tee("/products/1000052.png", "/products/1000052-back.png", { x: 0.33, y: 0.21, w: 0.33, h: 0.38 }),
  "gildan-shirt": tee("/products/1000020.png", "/products/1000020-back.png"),
  "softstyle-womens-pique-polo": tee("/products/1000004.png", "/products/1000004-back.png", { x: 0.33, y: 0.24, w: 0.34, h: 0.48 }, 10),
  // Signage
  "die-cut-stickers": { kind: "flat", shape: "rect", sides: front, dims: {}, size: [3, 3], transparent: true, note: "Cut to the shape of your design." },
  "composition-notebook-stickers": { kind: "flat", shape: "rect", sides: front, dims: {}, size: [4, 3] },
  "clear-stickers": { kind: "flat", shape: "rect", sides: front, dims: {}, size: [3, 3], transparent: true, note: "Printed on clear vinyl." },
  "circle-stickers": { kind: "flat", shape: "circle", sides: front, dims: {}, size: [3, 3] },
  "rectangle-stickers": { kind: "flat", shape: "rect", sides: front, dims: {}, size: [3, 2] },
  "business-cards": { kind: "flat", shape: "rect", sides: frontBack, dims: {}, size: [3.5, 2] },
  // T-Shirts
  "senior-2027-custom-shirts": tee("/products/1000047.png", "/products/1000047-back.png"),
  "heavyweight-tee": tee("/products/1000047.png", "/products/1000047-back.png"),
  "softstyle-t-shirt": tee("/products/1000021.png", "/products/1000021-back.png"),
  "softstyle-youth-t-shirt": tee("/products/1000022.png", "/products/1000022-back.png", undefined, 10),
  "leopard-print-tee": tee("/products/1000054.png", undefined, { x: 0.3, y: 0.26, w: 0.42, h: 0.46 }),
  "womens-micro-rib-baby-tee": tee("/products/1000046.png", "/products/1000046-back.png", { x: 0.36, y: 0.2, w: 0.28, h: 0.4 }, 9),
  "long-sleeve-pocket-t-shirt": tee("/products/1000019.png", "/products/1000019-back.png", { x: 0.34, y: 0.24, w: 0.32, h: 0.48 }),
  // Trade Show
  "advertising-tent": {
    kind: "mockup",
    sides: [{ id: "front", label: "Canopy", mockup: "/products/1000033.png", area: { x: 0.22, y: 0.25, w: 0.56, h: 0.17 }, widthIn: 120 }],
  },
  "table-covers-black": {
    kind: "mockup",
    sides: [{ id: "front", label: "Front", mockup: "/products/1000034.png", area: { x: 0.2, y: 0.42, w: 0.6, h: 0.26 }, widthIn: 72 }],
  },
  "table-covers-grey": {
    kind: "mockup",
    sides: [{ id: "front", label: "Front", mockup: "/products/1000037.png", area: { x: 0.2, y: 0.42, w: 0.6, h: 0.26 }, widthIn: 72 }],
  },
};

export function getDesignConfig(slug: string): DesignConfig | undefined {
  return configs[slug];
}

export const isDesignable = (p: Product) => p.slug in configs;

export function flatDims(slug: string, variantId: string): [number, number] {
  const config = configs[slug];
  if (config?.kind !== "flat") return [1, 1];
  return config.dims[variantId] ?? config.size;
}

export function sideIds(slug: string) {
  return getDesignConfig(slug)?.sides.map((s) => s.id) ?? [];
}

export function designableProduct(slug: string) {
  const product = getProduct(slug);
  return product && isDesignable(product) ? product : undefined;
}
