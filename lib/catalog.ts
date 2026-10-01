export type Category = {
  slug: string;
  name: string;
  blurb: string;
  image: string;
};

export type Variant = { id: string; label: string; price: number };

export type Product = {
  slug: string;
  name: string;
  category: string;
  image: string | null;
  description: string;
  features: string[];
  variantLabel: string;
  variants: Variant[];
  minQty: number;
  featured?: boolean;
};

export const categories: Category[] = [
  {
    slug: "yard-signs",
    name: "Yard Signs",
    blurb: "Weatherproof coroplast signs, big heads and custom cut outs.",
    image: "/products/1000053.png",
  },
  {
    slug: "retractable-banners",
    name: "Retractable Banners",
    blurb: "Pull-up banner stands that set up in seconds.",
    image: "/products/1000056.png",
  },
  {
    slug: "dress-shirts",
    name: "Dress Shirts",
    blurb: "Polos and button-ups with your logo, printed or embroidered.",
    image: "/products/1000055.png",
  },
  {
    slug: "signage",
    name: "Signage",
    blurb: "Stickers, decals and business cards that get you noticed.",
    image: "/products/1000049.png",
  },
  {
    slug: "t-shirts",
    name: "T-Shirts",
    blurb: "Custom tees for teams, events, seniors and businesses.",
    image: "/products/1000057.png",
  },
  {
    slug: "trade-show",
    name: "Trade Show",
    blurb: "Pop-up tents, table covers and displays for your booth.",
    image: "/products/1000033.png",
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

export const products: Product[] = [
  // Yard Signs
  {
    slug: "coroplast-yard-signs",
    name: "Coroplast Yard Signs",
    category: "yard-signs",
    image: "/products/1000053.png",
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
    image: "/products/1000045.png",
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
    image: "/products/1000041.png",
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
  // Retractable Banners
  {
    slug: "retractable-banner",
    name: "Retractable Banner",
    category: "retractable-banners",
    image: "/products/1000056.png",
    description:
      "Professional pull-up banner with aluminum base and carry bag. Sets up in under a minute.",
    features: ["Aluminum stand & carry bag", "Vivid, curl-resistant print", "Replacement graphics available"],
    variantLabel: "Size",
    variants: [
      { id: "24x80", label: '24" x 80"', price: 129 },
      { id: "33x80", label: '33" x 80"', price: 149 },
      { id: "48x80", label: '48" x 80"', price: 219 },
    ],
    minQty: 1,
    featured: true,
  },
  // Dress Shirts
  {
    slug: "camo-shirt",
    name: "Camo Shirt",
    category: "dress-shirts",
    image: "/products/1000055.png",
    description: "Camo button-up work shirt, ready for your company logo.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(32),
    minQty: 1,
  },
  {
    slug: "shaka-wear-shirt",
    name: "Shaka Wear",
    category: "dress-shirts",
    image: "/products/1000052.png",
    description: "Heavyweight Shaka Wear garment with a structured fit that holds your print.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(22),
    minQty: 1,
  },
  {
    slug: "gildan-shirt",
    name: "Gildan Shirt",
    category: "dress-shirts",
    image: "/products/1000020.png",
    description: "Classic Gildan shirt, available in a wide range of colors.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(18),
    minQty: 1,
  },
  {
    slug: "softstyle-womens-pique-polo",
    name: "Softstyle® Women's Pique Polo",
    category: "dress-shirts",
    image: "/products/1000004.png",
    description: "A soft, breathable pique polo with a feminine fit. Great for staff uniforms.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(24),
    minQty: 1,
  },
  // Signage
  {
    slug: "die-cut-stickers",
    name: "Die Cut Stickers",
    category: "signage",
    image: "/products/1000049.png",
    description: "Stickers cut to the exact shape of your design. Durable vinyl with a glossy finish.",
    features: ["Waterproof vinyl", "Cut to shape", "Indoor & outdoor"],
    variantLabel: "Pack",
    variants: [
      { id: "50", label: "50 stickers", price: 45 },
      { id: "100", label: "100 stickers", price: 75 },
      { id: "250", label: "250 stickers", price: 150 },
    ],
    minQty: 1,
    featured: true,
  },
  {
    slug: "composition-notebook-stickers",
    name: "Composition Notebook Stickers",
    category: "signage",
    image: "/products/1000058.png",
    description: "Personalized labels for composition notebooks. Great for classrooms and back to school.",
    features: ["Custom names & designs", "Strong adhesive", "Matte or gloss"],
    variantLabel: "Pack",
    variants: [
      { id: "10", label: "10 stickers", price: 15 },
      { id: "25", label: "25 stickers", price: 30 },
    ],
    minQty: 1,
  },
  {
    slug: "clear-stickers",
    name: "Clear Stickers",
    category: "signage",
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
    category: "signage",
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
    category: "signage",
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
    category: "signage",
    image: "/products/1000040.png",
    description: "Premium full-color business cards on thick 16pt stock.",
    features: ['Standard 3.5" x 2"', "Single or double sided", "Matte, gloss or soft-touch"],
    variantLabel: "Quantity",
    variants: [
      { id: "250", label: "250 cards", price: 35 },
      { id: "500", label: "500 cards", price: 55 },
      { id: "1000", label: "1000 cards", price: 85 },
    ],
    minQty: 1,
  },
  // T-Shirts
  {
    slug: "senior-2027-custom-shirts",
    name: "Senior 2027 Custom Shirts",
    category: "t-shirts",
    image: "/products/1000057.png",
    description: "Celebrate the class of 2027 with custom senior shirts. Add names, school colors and more.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(20),
    minQty: 1,
    featured: true,
  },
  {
    slug: "heavyweight-tee",
    name: "7.5 oz Heavyweight Tee",
    category: "t-shirts",
    image: "/products/1000047.png",
    description: "Thick, premium heavyweight tee with a boxy streetwear fit.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(18),
    minQty: 1,
  },
  {
    slug: "softstyle-t-shirt",
    name: "SoftStyle T-Shirt",
    category: "t-shirts",
    image: "/products/1000021.png",
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
    category: "t-shirts",
    image: "/products/1000022.png",
    description: "Soft youth tee for schools, camps and youth sports.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: youthSizes(12),
    minQty: 1,
  },
  {
    slug: "leopard-print-tee",
    name: "Leopard Print Tee",
    category: "t-shirts",
    image: "/products/1000054.png",
    description: "Bold leopard print tee, ready for your custom design.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(22),
    minQty: 1,
  },
  {
    slug: "womens-micro-rib-baby-tee",
    name: "Women's Micro Rib Baby Tee",
    category: "t-shirts",
    image: "/products/1000046.png",
    description: "Fitted micro rib baby tee in a trendy cropped silhouette.",
    features: shirtFeatures,
    variantLabel: "Size",
    variants: shirtSizes(18),
    minQty: 1,
  },
  {
    slug: "long-sleeve-pocket-t-shirt",
    name: "Long Sleeve Pocket T-Shirt",
    category: "t-shirts",
    image: "/products/1000019.png",
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
    image: "/products/1000033.png",
    description: "10' x 10' custom printed canopy tent for events, markets and trade shows.",
    features: ["Steel or aluminum frame", "Full-color canopy print", "Carry bag included"],
    variantLabel: "Package",
    variants: [
      { id: "canopy", label: "Canopy + frame", price: 599 },
      { id: "canopy-back", label: "Canopy + frame + back wall", price: 799 },
      { id: "full", label: "Full walls package", price: 1099 },
    ],
    minQty: 1,
    featured: true,
  },
  {
    slug: "table-covers-black",
    name: "Table Cover – Black",
    category: "trade-show",
    image: "/products/1000034.png",
    description: "Fitted or draped table cover with your logo printed front and center.",
    features: ["Wrinkle-resistant polyester", "Machine washable", "Fits standard tables"],
    variantLabel: "Table size",
    variants: [
      { id: "6ft", label: "6 ft table", price: 149 },
      { id: "8ft", label: "8 ft table", price: 169 },
    ],
    minQty: 1,
  },
  {
    slug: "table-covers-grey",
    name: "Table Cover – Grey",
    category: "trade-show",
    image: "/products/1000037.png",
    description: "Fitted or draped grey table cover with full-color logo print.",
    features: ["Wrinkle-resistant polyester", "Machine washable", "Fits standard tables"],
    variantLabel: "Table size",
    variants: [
      { id: "6ft", label: "6 ft table", price: 149 },
      { id: "8ft", label: "8 ft table", price: 169 },
    ],
    minQty: 1,
  },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
export const productsIn = (category: string) => products.filter((p) => p.category === category);
export const fromPrice = (p: Product) => Math.min(...p.variants.map((v) => v.price));

export const formatPrice = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
