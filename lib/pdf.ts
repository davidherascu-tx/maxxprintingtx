import "server-only";
import { PNG } from "pngjs";
import {
  PDFDocument, PDFName, PDFNumber, PDFOperator, PDFOperatorNames, PDFRef,
  closePath, cmyk, concatTransformationMatrix, drawObject, lineTo, moveTo,
  popGraphicsState, pushGraphicsState, setLineWidth, stroke,
} from "pdf-lib";

// Builds a print-ready PDF from a design's print PNG (which already includes the bleed):
// exact page size with TrimBox/BleedBox, optional crop marks, CMYK artwork, and the cut
// path as a "CutContour" spot color for contour-cut products.

const MARK_SLUG_PT = 18; // 0.25" of room around the bleed for crop marks

/** DPI from the PNG's pHYs chunk (the studio writes it), or `fallback`. */
function pngDpi(bytes: Uint8Array, fallback: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8;
  while (p + 12 <= bytes.length) {
    const len = view.getUint32(p);
    const type = String.fromCharCode(...bytes.subarray(p + 4, p + 8));
    if (type === "pHYs" && view.getUint8(p + 16) === 1) return view.getUint32(p + 8) * 0.0254;
    if (type === "IDAT") break;
    p += 12 + len;
  }
  return fallback;
}

/** Plain RGB → CMYK (no ICC profile). Pure black stays 100% K only. */
function toCmyk(rgba: Uint8Array | Buffer, w: number, h: number) {
  const n = w * h;
  const cmykData = new Uint8Array(n * 4);
  const alpha = new Uint8Array(n);
  let opaque = true;
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4] / 255, g = rgba[i * 4 + 1] / 255, b = rgba[i * 4 + 2] / 255;
    const a = rgba[i * 4 + 3];
    alpha[i] = a;
    if (a !== 255) opaque = false;
    const k = 1 - Math.max(r, g, b);
    if (k < 1) {
      cmykData[i * 4] = Math.round(((1 - r - k) / (1 - k)) * 255);
      cmykData[i * 4 + 1] = Math.round(((1 - g - k) / (1 - k)) * 255);
      cmykData[i * 4 + 2] = Math.round(((1 - b - k) / (1 - k)) * 255);
    }
    cmykData[i * 4 + 3] = Math.round(k * 255);
  }
  return { cmykData, alpha: opaque ? null : alpha };
}

export type PdfOptions = {
  /** Bleed (or cut margin) already inside the PNG, in inches. */
  marginIn: number;
  cropMarks: boolean;
  cmyk: boolean;
  title: string;
  /** Cut path SVG produced by the studio, aligned with the PNG. */
  cutSvg?: string;
};

export async function buildPrintPdf(png: Uint8Array, opts: PdfOptions) {
  const dpi = pngDpi(png, 150);
  const img = PNG.sync.read(Buffer.from(png));
  const w = img.width, h = img.height;
  const pt = 72 / dpi;
  const imgW = w * pt, imgH = h * pt;
  const slug = opts.cropMarks ? MARK_SLUG_PT : 0;
  const margin = opts.marginIn * 72;

  const doc = await PDFDocument.create();
  doc.setTitle(opts.title);
  doc.setProducer("Maxx Marketing Agency design studio");
  const page = doc.addPage([imgW + slug * 2, imgH + slug * 2]);
  page.setBleedBox(slug, slug, imgW, imgH);
  page.setTrimBox(slug + margin, slug + margin, imgW - margin * 2, imgH - margin * 2);

  // Artwork
  if (opts.cmyk) {
    const { cmykData, alpha } = toCmyk(img.data, w, h);
    let smask: PDFRef | undefined;
    if (alpha) {
      smask = doc.context.register(
        doc.context.flateStream(alpha, { Type: "XObject", Subtype: "Image", Width: w, Height: h, ColorSpace: "DeviceGray", BitsPerComponent: 8 }),
      );
    }
    const ref = doc.context.register(
      doc.context.flateStream(cmykData, {
        Type: "XObject", Subtype: "Image", Width: w, Height: h, ColorSpace: "DeviceCMYK", BitsPerComponent: 8,
        ...(smask && { SMask: smask }),
      }),
    );
    const name = page.node.newXObject("Art", ref);
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(imgW, 0, 0, imgH, slug, slug), drawObject(name), popGraphicsState());
  } else {
    page.drawImage(await doc.embedPng(png), { x: slug, y: slug, width: imgW, height: imgH });
  }

  // Cut path as a CutContour spot color (what Roland/Summa/Graphtec cutters look for).
  const vb = opts.cutSvg?.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const d = opts.cutSvg?.match(/ d="([^"]+)"/)?.[1];
  if (vb && d) {
    const sx = imgW / Number(vb[1]), sy = imgH / Number(vb[2]);
    const cs = doc.context.obj({
      CutCS: ["Separation", "CutContour", "DeviceCMYK", { FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: [0, 1, 0, 0], N: 1 }],
    });
    page.node.normalizedEntries().Resources.set(PDFName.of("ColorSpace"), cs);
    const ops = [
      pushGraphicsState(),
      PDFOperator.of(PDFOperatorNames.StrokingColorspace, [PDFName.of("CutCS")]),
      PDFOperator.of(PDFOperatorNames.StrokingColorN, [PDFNumber.of(1)]),
      setLineWidth(0.25),
    ];
    for (const loop of d.split("M").filter(Boolean)) {
      const pts = loop.replace("Z", "").split("L").map((p) => p.trim().split(" ").map(Number));
      pts.forEach(([x, y], i) => {
        const X = slug + x * sx, Y = slug + imgH - y * sy;
        ops.push(i === 0 ? moveTo(X, Y) : lineTo(X, Y));
      });
      ops.push(closePath());
    }
    ops.push(stroke(), popGraphicsState());
    page.pushOperators(...ops);
  }

  // Crop marks at the trim corners, in registration color, clear of the bleed.
  if (opts.cropMarks) {
    const left = slug + margin, right = slug + imgW - margin, bottom = slug + margin, top = slug + imgH - margin;
    const W = imgW + slug * 2, H = imgH + slug * 2;
    const gap = 2;
    const reg = cmyk(1, 1, 1, 1);
    const line = (x1: number, y1: number, x2: number, y2: number) =>
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.25, color: reg });
    for (const x of [left, right]) {
      line(x, 0, x, slug - gap);
      line(x, H - slug + gap, x, H);
    }
    for (const y of [bottom, top]) {
      line(0, y, slug - gap, y);
      line(W - slug + gap, y, W, y);
    }
  }

  return { bytes: await doc.save(), dpi: Math.round(dpi) };
}
