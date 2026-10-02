export type Category = {
  slug: string;
  name: string;
  blurb: string;
  image: string;
};

/**
 * `price: null` means "price on request": shown, but can't be added to the cart.
 * `group`/`option` split choices into two rows, e.g. size then pack.
 */
export type Variant = { id: string; label: string; price: number | null; group?: string; option?: string };

/** A color option: its own photo, and a swatch for the picker. */
/** `swatch` is any CSS background: a color, or a gradient for patterns. */
export type Color = { id: string; label: string; swatch: string; image?: string };

export type Product = {
  slug: string;
  name: string;
  category: string;
  image: string | null;
  description: string;
  features: string[];
  /** Optional extra section under the description. */
  more?: { title: string; text: string };
  /** Optional heading above the features list. */
  featuresTitle?: string;
  variantLabel: string;
  /** Label for the second row when variants have a `group`. */
  optionLabel?: string;
  variants: Variant[];
  /** Optional color choices; the first one is the default. */
  colors?: Color[];
  minQty: number;
  /** No quantity picker: each option (e.g. a pack) is bought once. */
  noQty?: boolean;
  featured?: boolean;
};

export const categories: Category[] = [
  {
    slug: "apparel",
    name: "Apparel",
    blurb: "Custom tees, polos and shirts for teams, events, seniors and businesses.",
    image: "/products/stickers/1000057.png",
  },
  {
    slug: "headwear",
    name: "Headwear",
    blurb: "Richardson caps with your logo, embroidered or printed.",
    image: "/products/headwear/richardson-112.png",
  },
  {
    slug: "stickers",
    name: "Stickers",
    blurb: "Die cut, clear and shaped stickers, plus business cards.",
    image: "/products/stickers/1000049.png",
  },
  {
    slug: "trade-show",
    name: "Trade Show",
    blurb: "Pop-up tents, table covers and retractable banners for your booth.",
    image: "/products/trade-show/tent_black.png",
  },
  {
    slug: "yard-signs",
    name: "Yard Signs",
    blurb: "Weatherproof coroplast signs, big heads and custom cut outs.",
    image: "/products/yard-signs/1000053.png",
  },
];

const shirtSizes = (base: number): Variant[] => [
  { id: "s", label: "S", price: base },
  { id: "m", label: "M", price: base },
  { id: "l", label: "L", price: base },
  { id: "xl", label: "XL", price: base },
  { id: "2xl", label: "2XL", price: base + 2 },
  { id: "3xl", label: "3XL", price: base + 3 },
];

const youthSizes = (base: number): Variant[] => [
  { id: "ys", label: "YS", price: base },
  { id: "ym", label: "YM", price: base },
  { id: "yl", label: "YL", price: base },
  { id: "yxl", label: "YXL", price: base },
];

const shirtFeatures = [
  "Screen print, DTF or embroidery",
  "Front, back and sleeve placements",
  "Free artwork review before production",
];

/** Square sticker sizes × pack counts. `prices[size]` lists one price per pack. */
const stickerGrid = (packs: number[], prices: Record<number, number[]>): Variant[] =>
  Object.entries(prices).flatMap(([size, row]) =>
    packs.map((pack, i) => ({
      id: `${size}x${size}-${pack}`,
      label: `${size}" x ${size}" · ${pack}-pack`,
      price: row[i],
      group: `${size}" x ${size}"`,
      option: `${pack}-pack`,
    })),
  );

export const products: Product[] = [
  // Yard Signs
  {
    slug: "coroplast-yard-signs",
    name: "Coroplast Yard Signs",
    category: "yard-signs",
    image: "/products/yard-signs/1000053.png",
    description:
      "Full-color corrugated plastic yard signs. Perfect for real estate, elections, grand openings and events.",
    features: ["4mm weatherproof coroplast", "Single or double sided", "H-stakes available"],
    variantLabel: "Size",
    variants: [
      { id: "12x18", label: '18" x 12"', price: 12 },
      { id: "18x24", label: '24" x 18"', price: 16 },
      { id: "24x36", label: '36" x 24"', price: 28 },
    ],
    minQty: 1,
    featured: true,
  },
  {
    slug: "big-heads",
    name: "Big Heads",
    category: "yard-signs",
    image: "/products/yard-signs/1000045.png",
    description:
      "Oversized face cut-outs for graduations, sports, birthdays and fans in the stands.",
    features: ["Contour cut to your photo", "Lightweight & easy to hold", "Handle stick included"],
    variantLabel: "Size",
    variants: [
      { id: "18", label: '18" tall', price: 22 },
      { id: "24", label: '24" tall', price: 30 },
      { id: "36", label: '36" tall', price: 45 },
    ],
    minQty: 1,
  },
  {
    slug: "custom-cut-outs",
    name: "Custom Cut Outs",
    category: "yard-signs",
    image: "/products/yard-signs/1000041.png",
    description: "Any shape, any design. Custom cut coroplast signs for yards, parties and displays.",
    features: ["Cut to any shape", "Full-color UV print", "Indoor & outdoor use"],
    variantLabel: "Size",
    variants: [
      { id: "24", label: 'Up to 24"', price: 35 },
      { id: "36", label: 'Up to 36"', price: 55 },
      { id: "48", label: 'Up to 48"', price: 85 },
    ],
    minQty: 1,
  },
  // Trade Show: Retractable Banners
  {
    slug: "retractable-banner",
    name: "Retractable Banner",
    category: "trade-show",
    image: "/products/trade-show/1000056.png",
    description:
      "Professional pull-up banner with aluminum base and carry bag. Sets up in under a minute.",
    features: [
      'Size: 33 1/2" x 79"',
      "Aluminum stand & carry bag",
      "Vivid, curl-resistant print",
      "Replacement graphics available",
    ],
    variantLabel: "Size",
    variants: [{ id: "33.5x79", label: '33 1/2" x 79"', price: 185 }],
    minQty: 1,
    featured: true,
  },
  // Apparel: Dress Shirts
  {
    slug: "camo-shirt",
    name: "Camo Shirt",
    category: "apparel",
    image: "/products/apparel/1000055.png",
    description: "Camo button-up work shirt, ready for your company logo.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(32),
    minQty: 1,
  },
  {
    slug: "shaka-wear-shirt",
    name: "Shaka Wear",
    category: "apparel",
    image: "/products/apparel/1000052.png",
    description: "Heavyweight Shaka Wear garment with a structured fit that holds your print.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(22),
    minQty: 1,
  },
  {
    slug: "gildan-shirt",
    name: "Gildan Shirt",
    category: "apparel",
    image: "/products/apparel/1000020.png",
    description: "Classic Gildan shirt, available in a wide range of colors.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(18),
    minQty: 1,
  },
  {
    slug: "softstyle-womens-pique-polo",
    name: "Softstyle® Women's Pique Polo",
    category: "apparel",
    image: "/products/apparel/1000004.png",
    description: "A soft, breathable pique polo with a feminine fit. Great for staff uniforms.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(24),
    minQty: 1,
  },
  // Headwear
  {
    slug: "richardson-112-trucker-cap",
    name: "Richardson Trucker Cap 112",
    category: "headwear",
    image: "/products/headwear/richardson-112.png",
    description:
      "The classic Richardson trucker cap with a mesh back. Available in many colors. Tell us your color in the order notes.",
    features: ["Embroidered or printed logo", "Mesh back, adjustable fit", "One size fits most"],
    variantLabel: "Size",
    variants: [{ id: "osfm", label: "One size", price: 13.5 }],
    minQty: 1,
    featured: true,
  },
  {
    slug: "richardson-169-cannon-flatbill",
    name: "Richardson Cannon 7-Panel Flatbill 169",
    category: "headwear",
    image: "/products/headwear/richardson-169.png",
    description:
      "A 7-panel flat-bill Richardson cap with a clean, modern look. Available in many colors. Tell us your color in the order notes.",
    features: ["Embroidered or printed logo", "Flat bill, adjustable fit", "One size fits most"],
    variantLabel: "Size",
    variants: [{ id: "osfm", label: "One size", price: 20 }],
    minQty: 1,
  },
  // Stickers
  {
    slug: "die-cut-stickers",
    name: "Die Cut Stickers",
    category: "stickers",
    image: "/products/stickers/1000049.png",
    description: "Stickers cut to the exact shape of your design. Durable vinyl with a glossy finish.",
    features: ["Waterproof vinyl", "Cut to shape", "Indoor & outdoor", "Processing time: 2 days"],
    variantLabel: "Size",
    optionLabel: "Pack",
    variants: stickerGrid([50, 100, 200, 300, 400, 500], {
      2: [60, 73, 95, 115, 134, 152],
      3: [72, 94, 133, 168, 200, 231],
      4: [87, 120, 179, 232, 282, 330],
      5: [104, 151, 234, 309, 379, 445],
    }),
    minQty: 1,
    noQty: true,
    featured: true,
  },
  {
    slug: "composition-notebook-stickers",
    name: "Composition Notebook Stickers",
    category: "stickers",
    image: "/products/stickers/composition_notebook_cream.png",
    description:
      "Make back-to-school a little cuter with our pre-designed composition notebook STICKERS ! Perfect for girls who want to add a fun and personalized touch to their school supplies. NOTEBOOK NOT INCLUDED!",
    features: [],
    variantLabel: "Book",
    variants: [{ id: "book", label: "1 book", price: 5.99 }],
    colors: [
      { id: "cream", label: "Cream", swatch: "#efe4cc", image: "/products/stickers/composition_notebook_cream.png" },
      { id: "brown", label: "Brown", swatch: "#8b5e3c", image: "/products/stickers/composition_notebook_brown.png" },
      { id: "pink", label: "Pink", swatch: "#f2b8c6", image: "/products/stickers/composition_notebook_pink.png" },
      {
        id: "striped",
        label: "Striped",
        swatch: "repeating-linear-gradient(90deg, #f2b8c6 0 4px, #ffffff 4px 8px)",
        image: "/products/stickers/composition_notebook_striped.png",
      },
    ],
    minQty: 1,
  },
  {
    slug: "clear-stickers",
    name: "Clear Stickers",
    category: "stickers",
    image: null,
    description: "Transparent vinyl stickers for windows, bottles and packaging.",
    features: ["Crystal-clear vinyl", "White ink underlay option", "Waterproof"],
    variantLabel: "Pack",
    variants: [
      { id: "50", label: "50 stickers", price: 50 },
      { id: "100", label: "100 stickers", price: 85 },
    ],
    minQty: 1,
  },
  {
    slug: "circle-stickers",
    name: "Circle Stickers",
    category: "stickers",
    image: null,
    description: "Round stickers for logos, packaging seals and giveaways.",
    features: ['1" to 4" diameters', "Gloss or matte", "Roll or sheet"],
    variantLabel: "Pack",
    variants: [
      { id: "100", label: "100 stickers", price: 40 },
      { id: "250", label: "250 stickers", price: 80 },
    ],
    minQty: 1,
  },
  {
    slug: "rectangle-stickers",
    name: "Rectangle Stickers",
    category: "stickers",
    image: null,
    description: "Rectangle labels for products, jars, boxes and branding.",
    features: ["Rounded or square corners", "Gloss or matte", "Waterproof"],
    variantLabel: "Pack",
    variants: [
      { id: "100", label: "100 stickers", price: 40 },
      { id: "250", label: "250 stickers", price: 80 },
    ],
    minQty: 1,
  },
  {
    slug: "business-cards",
    name: "Business Cards",
    category: "stickers",
    image: "/products/stickers/1000040.png",
    description:
      "Full-color, double-sided business cards on thick 16 pt C2S stock with a UV gloss finish on both sides.",
    features: [
      "Paper: 16 pt C2S",
      'Size: 3.5" x 2"',
      "Color: 4 (CMYK) / 4 (CMYK)",
      "Finish: UV Gloss / UV Gloss",
      "Processing time: 4 days",
      "Availability: 3-4 business days",
    ],
    variantLabel: "Cards",
    variants: [
      { id: "500", label: "500 cards", price: 65 },
      { id: "1000", label: "1000 cards", price: 80 },
    ],
    minQty: 1,
    noQty: true,
  },
  // Apparel: T-Shirts
  {
    slug: "senior-2027-custom-shirts",
    name: "Senior 2027 Custom Shirts",
    category: "apparel",
    image: "/products/stickers/1000057.png",
    description: "Celebrate the class of 2027 with custom senior shirts. Add names, school colors and more.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: [{ id: "xs", label: "XS", price: 20 }, ...shirtSizes(20), { id: "4xl", label: "4XL", price: 24 }],
    colors: [
      { id: "white", label: "White", swatch: "#ffffff", image: "/products/stickers/1000057.png" },
      { id: "black", label: "Black", swatch: "#111111", image: "/products/stickers/1000057_black.png" },
    ],
    minQty: 1,
    featured: true,
  },
  {
    slug: "heavyweight-tee",
    name: "7.5 oz Heavyweight Tee",
    category: "apparel",
    image: "/products/apparel/1000047.png",
    description: "Thick, premium heavyweight tee with a boxy streetwear fit.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(18),
    minQty: 1,
  },
  {
    slug: "softstyle-t-shirt",
    name: "SoftStyle T-Shirt",
    category: "apparel",
    image: "/products/apparel/1000021.png",
    description: "The everyday ring-spun cotton tee. Soft, light and comfortable.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(14),
    minQty: 1,
    featured: true,
  },
  {
    slug: "softstyle-youth-t-shirt",
    name: "Softstyle® Youth T-Shirt",
    category: "apparel",
    image: "/products/apparel/1000022.png",
    description: "Soft youth tee for schools, camps and youth sports.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: youthSizes(12),
    minQty: 1,
  },
  {
    slug: "leopard-print-tee",
    name: "Leopard Print Tee",
    category: "apparel",
    image: "/products/apparel/1000054.png",
    description: "Bold leopard print tee, ready for your custom design.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(22),
    minQty: 1,
  },
  {
    slug: "womens-micro-rib-baby-tee",
    name: "Women's Micro Rib Baby Tee",
    category: "apparel",
    image: "/products/apparel/1000046.png",
    description: "Fitted micro rib baby tee in a trendy cropped silhouette.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(18),
    minQty: 1,
  },
  {
    slug: "long-sleeve-pocket-t-shirt",
    name: "Long Sleeve Pocket T-Shirt",
    category: "apparel",
    image: "/products/apparel/1000019.png",
    description: "Long sleeve tee with a chest pocket. Great for crews and work wear.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(20),
    minQty: 1,
  },
  // Trade Show
  {
    slug: "advertising-tent",
    name: "Advertising Pop Up Tent",
    category: "trade-show",
    image: "/products/trade-show/tent_black.png",
    description: "Custom printed pop-up canopy tent for events, markets and trade shows.",
    featuresTitle: "All tent orders include:",
    features: ["40mm Aluminum Hexagonal Frame", "600 Denier Polyester Fabric", "Rolling Bag"],
    variantLabel: "Size",
    variants: [
      { id: "10x10", label: "10' x 10'", price: 899 },
      { id: "10x15", label: "10' x 15'", price: null },
      { id: "10x20", label: "10' x 20'", price: null },
    ],
    colors: [
      { id: "black", label: "Black", swatch: "#111111", image: "/products/trade-show/tent_black.png" },
      { id: "grey", label: "Grey", swatch: "#9ca3af", image: "/products/trade-show/tent_grey.png" },
    ],
    minQty: 1,
    featured: true,
  },
  {
    slug: "table-covers",
    name: "Table Cover",
    category: "trade-show",
    image: "/products/trade-show/table_covers_black.png",
    description:
      "This type of spandex table cover is ideal for special events, conventions, trade shows, open houses, fairs, and even personal celebrations. Made of high-quality elastic polyester fabrics in a broad range of colors, stretch trade show table covers add an attractive, professional appearance to your tables that can display your logo or advertising messages to create an extra impact on your booth.",
    more: {
      title: "Durable and Lightweight Spandex Table Covers",
      text: "Our stretch table covers are made from durable polyester fabric that stretches tightly with a sleek design. The fitted tablecloths will stretch to fit any 4ft, 6ft, 8ft or custom-sized folding table or standard display table or banquet tables.",
    },
    features: [
      "Stretch spandex polyester fabric",
      "Fits 4 ft, 6 ft, 8 ft or custom-sized tables",
      "Your logo or message printed",
    ],
    variantLabel: "Table cover",
    variants: [{ id: "each", label: "Table cover", price: 169 }],
    colors: [
      { id: "black", label: "Black", swatch: "#111111", image: "/products/trade-show/table_covers_black.png" },
      { id: "blue", label: "Blue", swatch: "#1f3a93", image: "/products/trade-show/table_covers_blue.png" },
      { id: "grey", label: "Grey", swatch: "#9ca3af", image: "/products/trade-show/table_covers_grey.png" },
      { id: "white", label: "White", swatch: "#ffffff", image: "/products/trade-show/table_covers_white.png" },
    ],
    minQty: 1,
  },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
/** The chosen color, or the product's default color (undefined if it has none). */
export const colorOf = (product: Product, id?: string) =>
  product.colors?.find((c) => c.id === id) ?? product.colors?.[0];
export const productsIn = (category: string) => products.filter((p) => p.category === category);
/** Lowest listed price, or null if every option is price on request. */
export const fromPrice = (p: Pick<Product, "variants">) => {
  const prices = p.variants.flatMap((v) => (v.price === null ? [] : [v.price]));
  return prices.length ? Math.min(...prices) : null;
};

export const formatPrice = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
