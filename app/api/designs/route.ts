import { randomUUID } from "node:crypto";
import { getProduct } from "@/lib/catalog";
import { getDesignConfig } from "@/lib/design-config";
import { createDesign } from "@/lib/db";
import { saveDesignFile } from "@/lib/files";
import { getCurrentUser } from "@/lib/session";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_JSON = 2 * 1024 * 1024;
const MAX_PNG = 25 * 1024 * 1024;

const bad = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * Save a finished design. Multipart body:
 *  - meta: JSON { slug, variant, sides: { [sideId]: fabricJson } }
 *  - <side>-preview, <side>-print: PNG files for each side in meta.sides
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const metaRaw = form?.get("meta");
  if (!form || typeof metaRaw !== "string" || metaRaw.length > MAX_JSON) return bad("Invalid design.");

  let meta: { slug: string; variant: string; sides: Record<string, unknown> };
  try {
    meta = JSON.parse(metaRaw);
  } catch {
    return bad("Invalid design.");
  }

  const product = getProduct(meta.slug);
  const config = getDesignConfig(meta.slug);
  if (!product || !config) return bad("This product can't be customized.");
  if (!product.variants.some((v) => v.id === meta.variant)) return bad("Unknown option.");

  const allowed = config.sides.map((s) => s.id);
  const sides = Object.keys(meta.sides ?? {}).filter((s) => allowed.includes(s));
  if (sides.length === 0) return bad("Your design is empty.");

  const files: [string, Buffer][] = [];
  for (const side of sides) {
    for (const kind of ["preview", "print"] as const) {
      const file = form.get(`${side}-${kind}`);
      if (!(file instanceof File) || file.size > MAX_PNG) return bad("Design image missing or too large.");
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!bytes.subarray(0, 8).equals(PNG)) return bad("Design images must be PNG.");
      files.push([`${side}-${kind}.png`, bytes]);
    }
  }

  const id = randomUUID();
  const user = await getCurrentUser();
  const json = Object.fromEntries(sides.map((s) => [s, meta.sides[s]]));
  try {
    await saveDesignFile(id, "design.json", JSON.stringify({ slug: meta.slug, variant: meta.variant, sides: json }));
    await Promise.all(files.map(([name, bytes]) => saveDesignFile(id, name, bytes)));
    await createDesign({ id, userId: user?.id ?? null, slug: meta.slug, variant: meta.variant, sides });
  } catch (e) {
    console.error("Failed to save design", e);
    return bad("We couldn't save your design right now. Please try again.", 500);
  }

  return Response.json({ id, sides });
}
