import { findDesign } from "@/lib/db";
import { CUT_MARGIN_IN, flatDims, getDesignConfig, printSpec } from "@/lib/design-config";
import { designFileType, isPublicDesignFile, readDesignFile } from "@/lib/files";
import { buildPrintPdf } from "@/lib/pdf";
import { getCurrentUser, isAdmin } from "@/lib/session";

export const maxDuration = 60;

const PDF_FILE = /^([a-z]+)-print\.pdf$/;

/** Build a print-ready PDF from the side's print PNG (and cut path, if it has one). */
async function printPdf(id: string, side: string, url: URL) {
  const design = await findDesign(id);
  const config = design && getDesignConfig(design.slug);
  const png = design && (await readDesignFile(id, `${side}-print.png`));
  if (!design || !config || !png) return null;

  const variant = config.kind === "flat" ? flatDims(design.slug, design.variant) : undefined;
  const spec = printSpec(config, variant);
  const cutSvg = spec.cut ? (await readDesignFile(id, `${side}-cut.svg`))?.toString() : undefined;
  const { bytes } = await buildPrintPdf(png, {
    marginIn: spec.bleedIn || (spec.cut ? CUT_MARGIN_IN : 0),
    cropMarks: url.searchParams.get("marks") === "1",
    cmyk: url.searchParams.get("rgb") !== "1",
    title: `${design.slug} ${design.variant} ${side} ${id.slice(0, 8)}`,
    cutSvg,
  });
  return bytes;
}

export async function GET(request: Request, ctx: RouteContext<"/api/designs/[id]/[file]">) {
  const { id, file } = await ctx.params;
  const publicFile = isPublicDesignFile(file);

  // Print, cut and PDF files are production files: only staff and the design's owner may download them.
  if (!publicFile) {
    const user = await getCurrentUser();
    const design = user ? await findDesign(id) : undefined;
    const allowed = !!user && (isAdmin(user) || (!!design && design.userId === user.id));
    if (!allowed) return new Response("Not found", { status: 404 });
  }

  const pdfSide = PDF_FILE.exec(file)?.[1];
  let bytes: Uint8Array | null;
  if (pdfSide) {
    bytes = await printPdf(id, pdfSide, new URL(request.url)).catch((e) => {
      console.error("Failed to build PDF", e);
      return null;
    });
  } else {
    bytes = await readDesignFile(id, file);
  }
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": pdfSide ? "application/pdf" : designFileType(file),
      "Cache-Control": publicFile ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      ...(publicFile ? {} : { "Content-Disposition": `attachment; filename="${id.slice(0, 8)}-${file}"` }),
    },
  });
}
