import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDesignConfig, designableProduct } from "@/lib/design-config";
import { designFontClasses, designFonts } from "@/lib/design-fonts";
import { readDesignFile } from "@/lib/files";
import { Studio, type StudioProps } from "@/components/studio/studio";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = designableProduct((await params).slug);
  return product ? { title: `Design your ${product.name}` } : {};
}

async function loadDesign(id: string | undefined, slug: string): Promise<StudioProps["initial"]> {
  if (!id) return undefined;
  const raw = await readDesignFile(id, "design.json");
  if (!raw) return undefined;
  try {
    const design = JSON.parse(raw.toString());
    return design.slug === slug ? { variant: design.variant, sides: design.sides } : undefined;
  } catch {
    return undefined;
  }
}

export default async function DesignStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ design?: string; variant?: string }>;
}) {
  const { slug } = await params;
  const { design, variant } = await searchParams;
  const product = designableProduct(slug);
  const config = getDesignConfig(slug);
  if (!product || !config) notFound();
  const initial = await loadDesign(design, slug);

  return (
    <div className="container-x py-6">
      {/* Make every studio font's @font-face available to the canvas. */}
      <div aria-hidden className="pointer-events-none absolute h-0 overflow-hidden opacity-0">
        {designFontClasses.map((c) => (
          <span key={c} className={c}>Aa</span>
        ))}
      </div>
      <nav className="mb-4 text-sm text-ink/50">
        <Link href="/design" className="hover:text-navy">Design Studio</Link>
        <span className="mx-2">/</span>
        <span className="text-ink/80">{product.name}</span>
      </nav>
      <Studio
        key={design ?? "new"}
        product={{ slug: product.slug, name: product.name, variants: product.variants, variantLabel: product.variantLabel }}
        config={config}
        fonts={designFonts}
        initial={initial}
        initialVariant={variant}
      />
    </div>
  );
}
