"use client";

// Fabric.js canvas engine for the design studio. Kept framework-free so the
// React component only deals with UI state.

import type { Canvas, FabricImage, FabricObject, IText } from "fabric";
import { CUT_MARGIN_IN, printSpec, type Area, type DesignConfig, type PrintSpec } from "@/lib/design-config";
import { cutPathSvg } from "./contour";
import { withPngDpi } from "./png";

type FabricNS = typeof import("fabric");

/** `v: 2` states have coordinates measured on a canvas that includes the bleed zone. */
export type SideState = { objects: Record<string, unknown>[]; background?: string; v?: number };
export type Rect = { left: number; top: number; width: number; height: number };

export type Selection =
  | null
  | {
      kind: "text" | "image" | "shape" | "group";
      text?: string;
      fontFamily?: string;
      fontSize?: number;
      fill?: string;
      bold?: boolean;
      italic?: boolean;
      align?: string;
      stroke?: string;
      strokeWidth?: number;
      charSpacing?: number;
      opacity: number;
      dpi?: number;
      goodDpi?: number;
      minDpi?: number;
    };

const MOCKUP_SIZE = 600;
const FLAT_LONG_SIDE = 600;
const PAD = 24;
const MAX_PRINT_PX = 12000;
const MAX_PRINT_AREA = 36_000_000;
const CUT_OFFSET_IN = 0.05;

export class StudioEngine {
  canvas: Canvas;
  area: Rect = { left: 0, top: 0, width: 1, height: 1 };
  logical = { width: MOCKUP_SIZE, height: MOCKUP_SIZE };
  widthIn = 12;
  background = "#ffffff";
  /** Production rules for the current side and size. */
  spec: PrintSpec;
  /** Bleed zone width in logical pixels (0 when the product has none). */
  bleedPx = 0;
  private pxPerIn = 1;
  private guides: FabricObject[] = [];
  private history = new Map<string, { stack: string[]; index: number }>();
  private side = "";
  private restoring = false;
  private mockups = new Map<string, FabricImage>();
  onChange: () => void = () => {};

  constructor(
    private f: FabricNS,
    el: HTMLCanvasElement,
    private config: DesignConfig,
  ) {
    this.spec = printSpec(config);
    Object.assign(f.InteractiveFabricObject.ownDefaults, {
      cornerStyle: "circle",
      cornerColor: "#ffffff",
      cornerStrokeColor: "#02245b",
      borderColor: "#02245b",
      transparentCorners: false,
      cornerSize: 11,
      padding: 4,
      borderScaleFactor: 1.5,
    });
    this.canvas = new f.Canvas(el, { preserveObjectStacking: true, selection: true });

    const changed = () => this.onChange();
    this.canvas.on("selection:created", changed);
    this.canvas.on("selection:updated", changed);
    this.canvas.on("selection:cleared", changed);
    this.canvas.on("object:modified", () => {
      this.commit();
      changed();
    });
    this.canvas.on("text:changed", changed);
    this.canvas.on("text:editing:exited", () => this.commit());
  }

  dispose() {
    return this.canvas.dispose();
  }

  // ---------- layout ----------

  private areaFromFraction(a: Area, img: { left: number; top: number; width: number; height: number }): Rect {
    return {
      left: img.left + a.x * img.width,
      top: img.top + a.y * img.height,
      width: a.w * img.width,
      height: a.h * img.height,
    };
  }

  private get round() {
    return this.config.kind === "flat" && this.config.shape === "circle";
  }

  /** The product outline, grown by `grow` logical pixels on every side (negative shrinks it). */
  private outline(grow: number, opts: Record<string, unknown>) {
    const f = this.f;
    const base = { left: this.area.left + this.area.width / 2, top: this.area.top + this.area.height / 2, ...opts };
    return this.round
      ? new f.Circle({ ...base, radius: Math.max(1, this.area.width / 2 + grow) })
      : new f.Rect({ ...base, width: Math.max(1, this.area.width + grow * 2), height: Math.max(1, this.area.height + grow * 2) });
  }

  /** Configure background, print area and guides for a side. */
  async setupSide(sideId: string, dims: [number, number], background?: string) {
    const f = this.f;
    const c = this.canvas;
    this.side = sideId;
    for (const g of this.guides) c.remove(g);
    this.guides = [];
    this.spec = printSpec(this.config, dims);

    if (this.config.kind === "mockup") {
      const side = this.config.sides.find((s) => s.id === sideId) ?? this.config.sides[0];
      let img = this.mockups.get(side.mockup);
      if (!img) {
        img = await f.FabricImage.fromURL(side.mockup);
        this.mockups.set(side.mockup, img);
      }
      const w = img.width, h = img.height;
      const s = Math.min(MOCKUP_SIZE / w, MOCKUP_SIZE / h);
      img.set({ scaleX: s, scaleY: s, left: MOCKUP_SIZE / 2, top: MOCKUP_SIZE / 2, selectable: false, evented: false });
      this.logical = { width: MOCKUP_SIZE, height: MOCKUP_SIZE };
      this.area = this.areaFromFraction(side.area, {
        left: (MOCKUP_SIZE - w * s) / 2,
        top: (MOCKUP_SIZE - h * s) / 2,
        width: w * s,
        height: h * s,
      });
      this.widthIn = side.widthIn;
      this.pxPerIn = this.area.width / side.widthIn;
      this.bleedPx = 0;
      this.background = this.sampleColor(img.getElement() as HTMLImageElement, side.area);
      c.backgroundImage = img;
    } else {
      const [wIn, hIn] = dims;
      const k = FLAT_LONG_SIDE / Math.max(wIn, hIn);
      const width = wIn * k, height = hIn * k;
      this.pxPerIn = k;
      this.bleedPx = this.spec.bleedIn * k;
      const margin = PAD + this.bleedPx;
      this.logical = { width: width + margin * 2, height: height + margin * 2 };
      this.area = { left: margin, top: margin, width, height };
      this.widthIn = wIn;
      this.background = background ?? (this.config.transparent ? "transparent" : "#ffffff");
      c.backgroundImage = this.makeArtboard();
    }

    const line = {
      fill: "transparent",
      strokeUniform: true,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    };
    // Trim line: the finished size of the product.
    this.guides.push(this.outline(0, { ...line, stroke: "#00aeef", strokeWidth: 1.5, strokeDashArray: [6, 5] }));
    // Safe zone: keep text and logos inside this line.
    const safe = this.spec.safeIn * this.pxPerIn;
    if (safe > 0) this.guides.push(this.outline(-safe, { ...line, stroke: "#ec008c", strokeWidth: 1, strokeDashArray: [3, 4] }));
    // Bleed zone: shaded strips around the trim line (rectangular products).
    const bleed = this.bleedPx;
    if (bleed > 0 && !this.round) {
      const { left, top, width, height } = this.area;
      const strip = (l: number, t: number, w: number, h: number) =>
        new f.Rect({
          left: l + w / 2, top: t + h / 2, width: w, height: h,
          fill: "rgba(236,0,140,0.13)", selectable: false, evented: false, excludeFromExport: true, objectCaching: false,
        });
      this.guides.push(
        strip(left - bleed, top - bleed, width + bleed * 2, bleed),
        strip(left - bleed, top + height, width + bleed * 2, bleed),
        strip(left - bleed, top, bleed, height),
        strip(left + width, top, bleed, height),
      );
    }
    for (const g of this.guides) c.add(g);
  }

  private makeArtboard(fill = this.background) {
    return this.outline(this.bleedPx, {
      fill: fill === "transparent" ? this.checker() : fill,
      shadow: new this.f.Shadow({ color: "rgba(2,36,91,0.18)", blur: 18, offsetY: 4 }),
      selectable: false,
      evented: false,
    });
  }

  private checker() {
    const tile = document.createElement("canvas");
    tile.width = tile.height = 16;
    const ctx = tile.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = "#e8ebf0";
    ctx.fillRect(0, 0, 8, 8);
    ctx.fillRect(8, 8, 8, 8);
    return new this.f.Pattern({ source: tile, repeat: "repeat" });
  }

  setBackground(color: string) {
    if (this.config.kind !== "flat") return;
    this.background = color;
    this.canvas.backgroundImage = this.makeArtboard();
    this.canvas.requestRenderAll();
    this.commit();
  }

  /** Scale the canvas element to fit the available box. */
  fit(maxWidth: number, maxHeight: number) {
    const z = Math.min(maxWidth / this.logical.width, maxHeight / this.logical.height, 1.6);
    this.canvas.setDimensions({ width: Math.floor(this.logical.width * z), height: Math.floor(this.logical.height * z) });
    this.canvas.setZoom(z);
    this.canvas.requestRenderAll();
  }

  // ---------- objects ----------

  /** Artwork is clipped to the bleed edge, so it can run past the trim line but no further. */
  private clipFor() {
    return this.outline(this.bleedPx, { absolutePositioned: true });
  }

  private isGuide(o: FabricObject) {
    return this.guides.includes(o);
  }

  private guidesToFront() {
    for (const g of this.guides) this.canvas.bringObjectToFront(g);
  }

  private place(obj: FabricObject, select = true) {
    obj.clipPath = this.clipFor();
    this.canvas.add(obj);
    this.guidesToFront();
    if (select) this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
  }

  userObjects() {
    return this.canvas.getObjects().filter((o) => !this.isGuide(o));
  }

  get center() {
    return { left: this.area.left + this.area.width / 2, top: this.area.top + this.area.height / 2 };
  }

  /** Average color of the garment inside the print area, as #rrggbb. */
  private sampleColor(el: HTMLImageElement, a: Area) {
    try {
      const px = document.createElement("canvas");
      px.width = px.height = 1;
      const ctx = px.getContext("2d")!;
      const w = el.naturalWidth, h = el.naturalHeight;
      ctx.drawImage(el, a.x * w, a.y * h, a.w * w, a.h * h, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    } catch {
      return "#ffffff";
    }
  }

  /** A text color that stands out against the current flat background. */
  contrastColor() {
    const m = /^#([0-9a-f]{6})$/i.exec(this.background);
    if (!m) return "#02245b";
    const n = parseInt(m[1], 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum < 0.55 ? "#ffffff" : "#02245b";
  }

  addText(text: string, fontFamily: string, fill = this.contrastColor()) {
    const t = new this.f.IText(text, {
      ...this.center,
      fontFamily,
      fontSize: Math.max(18, Math.round(Math.min(this.area.width, this.area.height) * 0.14)),
      fill,
      textAlign: "center",
      stroke: "#ffffff",
      strokeWidth: 0,
      paintFirst: "stroke",
      strokeLineJoin: "round",
    });
    // Shrink to fit inside the print area.
    const round = this.config.kind === "flat" && this.config.shape === "circle";
    const fitW = (this.area.width * (round ? 0.7 : 0.9)) / t.width;
    if (fitW < 1) t.set({ fontSize: Math.max(8, Math.floor(t.fontSize * fitW)) });
    this.place(t);
    this.commit();
  }

  async addImage(url: string) {
    const img = await this.f.FabricImage.fromURL(url);
    const s = Math.min((this.area.width * 0.8) / img.width, (this.area.height * 0.8) / img.height);
    img.set({ ...this.center, scaleX: s, scaleY: s });
    this.place(img);
    this.commit();
  }

  addShape(kind: "rect" | "circle" | "triangle" | "star", fill: string) {
    const f = this.f;
    const size = Math.min(this.area.width, this.area.height) * 0.35;
    const base = { ...this.center, fill };
    let shape: FabricObject;
    if (kind === "rect") shape = new f.Rect({ ...base, width: size, height: size, rx: size * 0.06, ry: size * 0.06 });
    else if (kind === "circle") shape = new f.Circle({ ...base, radius: size / 2 });
    else if (kind === "triangle") shape = new f.Triangle({ ...base, width: size, height: size });
    else {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? size * 0.22 : size / 2;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r };
      });
      shape = new f.Polygon(pts, base);
    }
    this.place(shape);
    this.commit();
  }

  get active() {
    return this.canvas.getActiveObject() ?? null;
  }

  update(props: Record<string, unknown>) {
    const obj = this.active;
    if (!obj) return;
    obj.set(props);
    if ("text" in props || "fontFamily" in props || "fontSize" in props || "charSpacing" in props) {
      (obj as IText).initDimensions?.();
    }
    obj.setCoords();
    this.canvas.requestRenderAll();
    this.commitSoon();
    this.onChange();
  }

  async duplicate() {
    const obj = this.active;
    if (!obj) return;
    const copy = await obj.clone();
    copy.set({ left: (obj.left ?? 0) + 16, top: (obj.top ?? 0) + 16 });
    this.place(copy);
    this.commit();
  }

  remove() {
    const objs = this.canvas.getActiveObjects();
    if (objs.length === 0) return;
    this.canvas.discardActiveObject();
    this.canvas.remove(...objs);
    this.canvas.requestRenderAll();
    this.commit();
    this.onChange();
  }

  forward() {
    const obj = this.active;
    if (!obj) return;
    this.canvas.bringObjectForward(obj);
    this.guidesToFront();
    this.canvas.requestRenderAll();
    this.commit();
  }

  backward() {
    const obj = this.active;
    if (!obj) return;
    this.canvas.sendObjectBackwards(obj);
    this.canvas.requestRenderAll();
    this.commit();
  }

  centerH() {
    this.update({ left: this.center.left });
  }

  centerV() {
    this.update({ top: this.center.top });
  }

  flip() {
    const obj = this.active;
    if (obj) this.update({ flipX: !obj.flipX });
  }

  selection(): Selection {
    const obj = this.active;
    if (!obj) return null;
    const opacity = obj.opacity ?? 1;
    if (obj instanceof this.f.ActiveSelection) return { kind: "group", opacity };
    if (obj instanceof this.f.IText) {
      return {
        kind: "text",
        text: obj.text,
        fontFamily: obj.fontFamily,
        fontSize: Math.round(obj.fontSize * (obj.scaleY ?? 1)),
        fill: typeof obj.fill === "string" ? obj.fill : "#000000",
        bold: obj.fontWeight === "bold" || Number(obj.fontWeight) >= 700,
        italic: obj.fontStyle === "italic",
        align: obj.textAlign,
        stroke: typeof obj.stroke === "string" ? obj.stroke : "#ffffff",
        strokeWidth: obj.strokeWidth ?? 0,
        charSpacing: obj.charSpacing ?? 0,
        opacity,
      };
    }
    if (obj instanceof this.f.FabricImage) {
      const el = obj.getElement() as HTMLImageElement;
      const inches = (obj.getScaledWidth() / this.area.width) * this.widthIn;
      return {
        kind: "image",
        opacity,
        dpi: Math.round((el.naturalWidth || obj.width) / inches),
        goodDpi: this.spec.goodDpi,
        minDpi: this.spec.minDpi,
      };
    }
    return { kind: "shape", fill: typeof obj.fill === "string" ? obj.fill : "#000000", opacity };
  }

  /** Set font size in on-screen terms, folding any scaling back into fontSize. */
  setFontSize(size: number) {
    const obj = this.active;
    if (!(obj instanceof this.f.IText)) return;
    obj.set({ scaleX: (obj.scaleX ?? 1) / (obj.scaleY ?? 1), scaleY: 1 });
    this.update({ fontSize: size });
  }

  // ---------- state & history ----------

  serialize(): SideState {
    const objects = this.userObjects().map((o) => {
      const json = o.toObject() as Record<string, unknown>;
      delete json.clipPath;
      // Store our own URLs as paths so designs survive a change of domain.
      if (typeof json.src === "string" && json.src.startsWith(location.origin)) {
        json.src = json.src.slice(location.origin.length);
      }
      return json;
    });
    return this.config.kind === "flat" ? { objects, background: this.background, v: 2 } : { objects, v: 2 };
  }

  async restore(state: SideState | undefined) {
    this.restoring = true;
    try {
      const c = this.canvas;
      c.discardActiveObject();
      c.remove(...this.userObjects());
      if (state?.background && this.config.kind === "flat") {
        this.background = state.background;
        c.backgroundImage = this.makeArtboard();
      }
      let saved = state?.objects ?? [];
      // Designs saved before bleed existed were measured from the trim corner; shift them in.
      if (state && state.v !== 2 && this.bleedPx > 0) {
        saved = saved.map((o) => ({ ...o, left: (Number(o.left) || 0) + this.bleedPx, top: (Number(o.top) || 0) + this.bleedPx }));
      }
      const objs = await this.f.util.enlivenObjects<FabricObject>(saved);
      for (const o of objs) this.place(o, false);
      c.requestRenderAll();
    } finally {
      this.restoring = false;
    }
  }

  private hist() {
    let h = this.history.get(this.side);
    if (!h) {
      h = { stack: [JSON.stringify(this.serialize())], index: 0 };
      this.history.set(this.side, h);
    }
    return h;
  }

  /** Start history for the current side from its current content. */
  resetHistory() {
    this.history.delete(this.side);
    this.hist();
  }

  private timer: ReturnType<typeof setTimeout> | undefined;
  private commitSoon() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.commit(), 350);
  }

  commit() {
    if (this.restoring) return;
    clearTimeout(this.timer);
    const h = this.hist();
    const snap = JSON.stringify(this.serialize());
    if (h.stack[h.index] === snap) return;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(snap);
    if (h.stack.length > 60) h.stack.shift();
    h.index = h.stack.length - 1;
    this.onChange();
  }

  get canUndo() {
    return (this.history.get(this.side)?.index ?? 0) > 0;
  }

  get canRedo() {
    const h = this.history.get(this.side);
    return !!h && h.index < h.stack.length - 1;
  }

  async undo() {
    const h = this.hist();
    if (h.index === 0) return;
    h.index--;
    await this.restore(JSON.parse(h.stack[h.index]));
    this.onChange();
  }

  async redo() {
    const h = this.hist();
    if (h.index >= h.stack.length - 1) return;
    h.index++;
    await this.restore(JSON.parse(h.stack[h.index]));
    this.onChange();
  }

  /** Re-scale objects when a flat product's size changes. */
  static remap(state: SideState, from: Rect, to: Rect): SideState {
    const kx = to.width / from.width, ky = to.height / from.height, k = Math.min(kx, ky);
    return {
      ...state,
      objects: state.objects.map((o) => ({
        ...o,
        left: to.left + ((Number(o.left) || 0) - from.left) * kx,
        top: to.top + ((Number(o.top) || 0) - from.top) * ky,
        scaleX: (Number(o.scaleX) || 1) * k,
        scaleY: (Number(o.scaleY) || 1) * k,
      })),
    };
  }

  // ---------- preflight ----------

  /** Problems a print shop would otherwise find after the order: soft images, text near the edge, short bleed. */
  preflight(): string[] {
    const f = this.f;
    const issues: string[] = [];
    const { spec, area } = this;
    const safe = spec.safeIn * this.pxPerIn;
    const bleed = this.bleedPx;
    const label = this.config.sides.length > 1 ? ` (${this.config.sides.find((s) => s.id === this.side)?.label})` : "";
    let soft = 0, offSafe = 0, shortBleed = 0;

    for (const o of this.userObjects()) {
      const b = o.getBoundingRect();
      if (o instanceof f.FabricImage) {
        const el = o.getElement() as HTMLImageElement;
        const dpi = (el.naturalWidth || o.width) / ((o.getScaledWidth() / area.width) * this.widthIn);
        if (dpi < spec.minDpi) soft++;
      }
      if (safe > 0 && o instanceof f.IText) {
        if (b.left < area.left + safe - 1 || b.top < area.top + safe - 1 || b.left + b.width > area.left + area.width - safe + 1 || b.top + b.height > area.top + area.height - safe + 1) {
          offSafe++;
        }
      }
      if (bleed > 0 && !this.round && !(o instanceof f.IText) && b.width > area.width * 0.5 && b.height > area.height * 0.5) {
        // A background that ends near the trim line leaves a white sliver once the sheet is cut.
        const gaps = [b.left - area.left, b.top - area.top, area.left + area.width - (b.left + b.width), area.top + area.height - (b.top + b.height)];
        if (gaps.some((g) => g > -bleed * 0.9 && g < bleed * 0.75 + 1 && Math.abs(g) < bleed * 4)) shortBleed++;
      }
    }
    if (soft) issues.push(`${soft === 1 ? "An image is" : `${soft} images are`} below ${spec.minDpi} DPI at this size and will print soft${label}.`);
    if (offSafe) issues.push(`Text is outside the safe zone (pink dashed line) and may be trimmed off${label}.`);
    if (shortBleed) issues.push(`Artwork stops near the trim line. Stretch it to the outer edge of the pink bleed zone to avoid white borders${label}.`);
    return issues;
  }

  // ---------- export ----------

  private async blob(el: HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) =>
      el.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png"),
    );
  }

  /**
   * Render the current side to a mockup preview and a print-ready file. The print file has no
   * mockup, includes the bleed, and is written at the product's print DPI. Contour-cut
   * products also get a vector cut path aligned to the print file.
   */
  async export(scale = 1) {
    const c = this.canvas;
    c.discardActiveObject();
    const z = c.getZoom();
    const notGuide = (o: object) => !this.guides.includes(o as FabricObject);

    const isFlat = this.config.kind === "flat";
    const crop = isFlat
      ? { left: this.area.left * z, top: this.area.top * z, width: this.area.width * z, height: this.area.height * z }
      : { left: 0, top: 0, width: this.logical.width * z, height: this.logical.height * z };
    const previewPx = 800;
    const preview = c.toCanvasElement(previewPx / Math.max(crop.width, crop.height), { ...crop, filter: notGuide });

    // Print file: print area plus bleed, no mockup. Contour-cut files keep a small transparent margin.
    const { spec } = this;
    const marginPx = this.bleedPx || (spec.cut ? CUT_MARGIN_IN * this.pxPerIn : 0);
    const marginIn = marginPx / this.pxPerIn;
    const heightIn = (this.widthIn * this.area.height) / this.area.width;
    const sizeIn = { width: this.widthIn + marginIn * 2, height: heightIn + marginIn * 2 };

    const bg = c.backgroundImage;
    const transparentPrint = !isFlat || this.background === "transparent";
    c.backgroundImage = transparentPrint ? undefined : this.makeArtboard();
    if (c.backgroundImage) c.backgroundImage.shadow = null;

    const longIn = Math.max(sizeIn.width, sizeIn.height);
    const aspect = sizeIn.width / sizeIn.height;
    const maxLong = Math.min(MAX_PRINT_PX, Math.sqrt(MAX_PRINT_AREA * Math.max(aspect, 1 / aspect)));
    const printPx = Math.min(maxLong, longIn * spec.dpi) * scale;
    const dpi = Math.round(printPx / longIn);
    const area = {
      left: (this.area.left - marginPx) * z,
      top: (this.area.top - marginPx) * z,
      width: (this.area.width + marginPx * 2) * z,
      height: (this.area.height + marginPx * 2) * z,
    };
    let printCanvas: HTMLCanvasElement;
    try {
      printCanvas = c.toCanvasElement(printPx / Math.max(area.width, area.height), { ...area, filter: notGuide });
    } finally {
      c.backgroundImage = bg;
      c.requestRenderAll();
    }

    const cut = spec.cut ? cutPathSvg(printCanvas, sizeIn, CUT_OFFSET_IN) : null;
    const print = await withPngDpi(await this.blob(printCanvas), dpi);
    return { preview: await this.blob(preview), print, cut, dpi };
  }
}
