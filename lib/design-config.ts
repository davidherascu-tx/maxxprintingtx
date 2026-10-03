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
    dims: { "33.5x79": [33.5, 79] },
    size: [33.5, 79],
  },
  // Dress Shirts
  "camo-shirt": tee("/products/apparel/1000055.png", undefined, { x: 0.3, y: 0.25, w: 0.4, h: 0.48 }),
  "shaka-wear-shirt": tee("/products/apparel/1000052.png", "/products/apparel/1000052-back.png", { x: 0.33, y: 0.21, w: 0.33, h: 0.38 }),
  "gildan-shirt": tee("/products/apparel/1000020.png", "/products/apparel/1000020-back.png"),
  "softstyle-womens-pique-polo": tee("/products/apparel/1000004.png", "/products/apparel/1000004-back.png", { x: 0.33, y: 0.24, w: 0.34, h: 0.48 }, 10),
  // Signage
  "die-cut-stickers": {
    kind: "flat",
    shape: "rect",
    sides: front,
    // "3x3-100" -> 3" x 3"
    dims: Object.fromEntries(
      (getProduct("die-cut-stickers")?.variants ?? []).map((v) => {
        const n = Number(v.id.split("x")[0]);
        return [v.id, [n, n] as [number, number]];
      }),
    ),
    size: [3, 3],
    transparent: true,
    note: "Cut to the shape of your design.",
  },
  "clear-stickers": { kind: "flat", shape: "rect", sides: front, dims: {}, size: [3, 3], transparent: true, note: "Printed on clear vinyl." },
  "circle-stickers": { kind: "flat", shape: "circle", sides: front, dims: {}, size: [3, 3] },
  "rectangle-stickers": { kind: "flat", shape: "rect", sides: front, dims: {}, size: [3, 2] },
  "business-cards": { kind: "flat", shape: "rect", sides: frontBack, dims: {}, size: [3.5, 2] },
  // T-Shirts
  "senior-2027-custom-shirts": tee("/products/apparel/1000047.png", "/products/apparel/1000047-back.png"),
  "heavyweight-tee": tee("/products/apparel/1000047.png", "/products/apparel/1000047-back.png"),
  "softstyle-t-shirt": tee("/products/apparel/1000021.png", "/products/apparel/1000021-back.png"),
  "softstyle-youth-t-shirt": tee("/products/apparel/1000022.png", "/products/apparel/1000022-back.png", undefined, 10),
  "leopard-print-tee": tee("/products/apparel/1000054.png", undefined, { x: 0.3, y: 0.26, w: 0.42, h: 0.46 }),
  "womens-micro-rib-baby-tee": tee("/products/apparel/1000046.png", "/products/apparel/1000046-back.png", { x: 0.36, y: 0.2, w: 0.28, h: 0.4 }, 9),
  "long-sleeve-pocket-t-shirt": tee("/products/apparel/1000019.png", "/products/apparel/1000019-back.png", { x: 0.34, y: 0.24, w: 0.32, h: 0.48 }),
  // Trade Show
  "advertising-tent": {
    kind: "mockup",
    sides: [{ id: "front", label: "Canopy", mockup: "/products/trade-show/tent_black.png", area: { x: 0.22, y: 0.25, w: 0.56, h: 0.17 }, widthIn: 120 }],
  },
  "table-covers": {
    kind: "mockup",
    sides: [{ id: "front", label: "Front", mockup: "/products/trade-show/table_covers_black.png", area: { x: 0.2, y: 0.42, w: 0.6, h: 0.26 }, widthIn: 72 }],
  },
};

/** Margin (inches) kept around contour-cut artwork so the cut line stays inside the file. */
export const CUT_MARGIN_IN = 0.0625;

export type PrintSpec = {
  /** Resolution of the print file. */
  dpi: number;
  /** Extra artwork beyond the trim line, per edge, in inches. */
  bleedIn: number;
  /** Keep text this far inside the trim line, in inches. */
  safeIn: number;
  /** Uploaded images at or above this effective DPI print well. */
  goodDpi: number;
  /** Below this effective DPI we warn that the print will look soft. */
  minDpi: number;
  /** Artwork is contour-cut, so the studio also exports a cut path. */
  cut: boolean;
};

/**
 * Production rules for a product: small items are printed sharp (300 DPI), large-format
 * pieces at a lower DPI that is still right for their viewing distance.
 * `dims` is the width × height in inches of a flat product.
 */
export function printSpec(config: DesignConfig, dims: [number, number] = [1, 1]): PrintSpec {
  const flat = config.kind === "flat";
  const long = flat ? Math.max(...dims) : Math.max(...config.sides.map((s) => s.widthIn));
  const tier = long <= 14 ? { dpi: 300, goodDpi: 150, minDpi: 100 } : long <= 40 ? { dpi: 150, goodDpi: 100, minDpi: 72 } : { dpi: 100, goodDpi: 72, minDpi: 50 };
  const cut = flat && !!config.transparent;
  const trimmed = flat && !cut;
  return {
    ...tier,
    bleedIn: trimmed ? (long > 48 ? 0.25 : 0.125) : 0,
    safeIn: trimmed ? (long <= 14 ? 0.125 : long <= 40 ? 0.25 : 0.5) : 0,
    cut,
  };
}

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
