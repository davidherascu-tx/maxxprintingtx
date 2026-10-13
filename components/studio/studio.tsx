"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatPrice, fromPrice, type Product } from "@/lib/catalog";
import { VariantPicker } from "@/components/variant-picker";
import { isGang, type DesignConfig } from "@/lib/design-config";
import type { DesignFont } from "@/lib/design-fonts";
import { MAX_DESIGN_BYTES, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/limits";
import { useCart } from "../cart";
import { StudioEngine, type Selection, type SideState } from "./engine";

type Tab = "text" | "upload" | "shapes" | "product";

const COLORS = [
  "#000000", "#ffffff", "#02245b", "#1d4ed8", "#00aeef", "#0f766e", "#16a34a",
  "#facc15", "#ffd200", "#f97316", "#dc2626", "#ec008c", "#7c3aed", "#6b7280", "#b8860b",
];

const RULER_PX = 24;
// Colors a gang sheet can be previewed on: transparent, and common shirt colors.
const PREVIEW_BGS: [string, string][] = [
  ["transparent", "Transparent"],
  ["#ffffff", "White"],
  ["#111111", "Black"],
  ["#1f3a93", "Royal blue"],
  ["#b91c1c", "Red"],
  ["#9ca3af", "Gray"],
];
type RulerInfo = ReturnType<StudioEngine["rulerInfo"]>;

export type StudioProps = {
  product: Pick<Product, "slug" | "name" | "variants" | "variantLabel" | "optionLabel" | "noQty">;
  config: DesignConfig;
  fonts: DesignFont[];
  initial?: { variant: string; sides: Record<string, SideState> };
  initialVariant?: string;
};

export function Studio({ product, config, fonts, initial, initialVariant }: StudioProps) {
  const router = useRouter();
  const { add } = useCart();
  const canvasEl = useRef<HTMLCanvasElement>(null);
  const boxEl = useRef<HTMLDivElement>(null);
  const engineRef = useRef<StudioEngine | null>(null);
  const sidesRef = useRef<Record<string, SideState>>({ ...(initial?.sides ?? {}) });

  const firstVariant =
    [initial?.variant, initialVariant].find((v) => product.variants.some((x) => x.id === v)) ?? product.variants[0].id;
  const [variant, setVariant] = useState(firstVariant);
  const [side, setSide] = useState(config.sides[0].id);
  const [engine, setEngine] = useState<StudioEngine | null>(null);
  const ready = !!engine;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("text");
  const [sel, setSel] = useState<Selection>(null);
  const [hist, setHist] = useState({ undo: false, redo: false });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [newText, setNewText] = useState("Your text here");
  const [checkout, setCheckout] = useState(false);
  const [issues, setIssues] = useState<{ list: string[]; lines: { variant: string; qty: number }[] } | null>(null);
  // Gang sheets: images uploaded this visit (so they can be added again), sheet usage and copies to make.
  const gang = isGang(config);
  const [library, setLibrary] = useState<{ url: string; name: string }[]>([]);
  const [used, setUsed] = useState(0);
  const [copies, setCopies] = useState(10);
  const [ruler, setRuler] = useState<RulerInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const [previewBg, setPreviewBg] = useState("transparent");

  const dims = useCallback(
    (v: string): [number, number] => (config.kind === "flat" ? (config.dims[v] ?? config.size) : [1, 1]),
    [config],
  );

  const sync = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    setSel(e.selection());
    setHist({ undo: e.canUndo, redo: e.canRedo });
    setCounts((prev) => ({ ...prev, [side]: e.userObjects().length }));
    if (gang) setUsed(e.usedLengthIn());
  }, [side, gang]);

  const fit = useCallback(() => {
    const box = boxEl.current;
    if (!box || !engineRef.current) return;
    // Gang sheets fill the width (minus padding) and scroll; everything else fits the window.
    // The rulers take RULER_PX on the top and left of a gang sheet.
    engineRef.current.fit(gang ? box.clientWidth - 16 - RULER_PX : box.clientWidth, Math.max(320, window.innerHeight - 260), zoomRef.current);
    if (gang) setRuler(engineRef.current.rulerInfo());
  }, [gang]);

  // Create the engine once.
  useEffect(() => {
    let cancelled = false;
    let engine: StudioEngine | null = null;
    (async () => {
      const fabric = await import("fabric");
      await Promise.all(
        fonts.flatMap((f) => [`400 40px ${f.family}`, `700 40px ${f.family}`].map((d) => document.fonts.load(d).catch(() => {}))),
      );
      if (cancelled || !canvasEl.current) return;
      engine = new StudioEngine(fabric, canvasEl.current, config);
      engineRef.current = engine;
      await engine.setupSide(config.sides[0].id, dims(firstVariant), sidesRef.current[config.sides[0].id]?.background);
      await engine.restore(sidesRef.current[config.sides[0].id]);
      engine.resetHistory();
      setCounts(Object.fromEntries(config.sides.map((s) => [s.id, sidesRef.current[s.id]?.objects.length ?? 0])));
      if (cancelled) return;
      fit();
      setEngine(engine);
    })();
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- engine is created once per mount
  }, []);

  useEffect(() => {
    if (engine) engine.onChange = sync;
  }, [sync, engine]);

  useEffect(() => {
    const box = boxEl.current;
    if (!box) return;
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [fit]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const e = engineRef.current;
      const target = ev.target as HTMLElement;
      if (!e || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if ((e.active as { isEditing?: boolean } | null)?.isEditing) return;
      if (ev.key === "Delete" || ev.key === "Backspace") {
        if (e.active) {
          ev.preventDefault();
          e.remove();
        }
      } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (ev.shiftKey) e.redo();
        else e.undo();
      } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y") {
        ev.preventDefault();
        e.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const e = engine;

  async function showSide(next: string, v = variant) {
    const eng = engineRef.current;
    if (!eng) return;
    sidesRef.current[side] = eng.serialize();
    await eng.setupSide(next, dims(v), sidesRef.current[next]?.background ?? eng.background);
    await eng.restore(sidesRef.current[next]);
    eng.resetHistory();
    setSide(next);
    fit();
    setSel(null);
    setHist({ undo: eng.canUndo, redo: eng.canRedo });
  }

  async function changeVariant(v: string) {
    const eng = engineRef.current;
    setVariant(v);
    if (!eng || config.kind !== "flat" || v === variant) return;
    // Re-fit every side's artwork to the new size. A gang sheet keeps its scale: only the length changes.
    sidesRef.current[side] = eng.serialize();
    const from = { ...eng.area };
    await eng.setupSide(side, dims(v), eng.background);
    const to = { ...eng.area };
    if (!gang) {
      for (const id of Object.keys(sidesRef.current)) {
        sidesRef.current[id] = StudioEngine.remap(sidesRef.current[id], from, to);
      }
    }
    await eng.restore(sidesRef.current[side]);
    eng.commit();
    eng.onChange();
    setError(null);
    fit();
  }

  async function upload(files: File[]) {
    setError(null);
    const list = gang ? files : files.slice(0, 1);
    for (const [n, file] of list.entries()) {
      const label = list.length > 1 ? ` (${n + 1} of ${list.length})` : "";
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return setError(`${file.name}: please choose a PNG, JPG, WEBP or GIF image.`);
      if (file.size > MAX_UPLOAD_BYTES) return setError(`${file.name}: images must be ${MAX_UPLOAD_MB} MB or smaller.`);
      setBusy(`Uploading image${label}…`);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Upload failed.");
        if (gang) setLibrary((l) => [{ url: data.url, name: file.name }, ...l]);
        await engineRef.current?.addImage(data.url);
      } catch (err) {
        setBusy(null);
        return setError(err instanceof Error ? err.message : "Upload failed.");
      }
    }
    setBusy(null);
  }

  async function deleteImage(img: { url: string; name: string }) {
    const placed = engineRef.current?.userObjects().filter((o) => (o as { getSrc?: () => string }).getSrc?.().endsWith(img.url)).length ?? 0;
    if (placed > 0 && !window.confirm(`"${img.name}" is on your sheet ${placed} time${placed === 1 ? "" : "s"}. Delete it and remove ${placed === 1 ? "it" : "them"} from the sheet?`)) return;
    setError(null);
    try {
      const res = await fetch(img.url, { method: "DELETE" });
      if (!res.ok) throw new Error("We couldn't delete that image. Please try again.");
      engineRef.current?.removeImage(img.url);
      setLibrary((l) => l.filter((x) => x.url !== img.url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't delete that image.");
    }
  }

  function changeZoom(next: number) {
    const z = Math.min(3, Math.max(0.5, Math.round(next * 100) / 100));
    zoomRef.current = z;
    setZoom(z);
    fit();
  }

  function changePreviewBg(color: string) {
    setPreviewBg(color);
    engineRef.current?.setPreviewBackground(color);
  }

  async function addCopies(n: number) {
    const made = (await engineRef.current?.copies(n)) ?? 0;
    if (made < n) setError(made === 0 ? "No room left on the sheet. Choose a longer sheet size." : `Only ${made} of ${n} copies fit. Choose a longer sheet size for more.`);
    else setError(null);
  }

  async function saveAndAdd(lines: { variant: string; qty: number }[], ignoreIssues = false) {
    const eng = engineRef.current;
    if (!eng) return;
    setError(null);
    setIssues(null);
    sidesRef.current[side] = eng.serialize();
    const used = config.sides.map((s) => s.id).filter((id) => (sidesRef.current[id]?.objects.length ?? 0) > 0);
    if (used.length === 0) {
      setCheckout(false);
      return setError("Add some text or an image to your design first.");
    }

    setBusy(ignoreIssues ? "Saving your design…" : "Checking your design…");
    const current = side;
    const showSideAgain = async () => {
      await eng.setupSide(current, dims(variant), sidesRef.current[current]?.background);
      await eng.restore(sidesRef.current[current]);
      fit();
    };
    try {
      // Preflight: catch soft images, text near the edge and short bleed before anything is ordered.
      if (!ignoreIssues) {
        const found: string[] = [];
        for (const id of used) {
          await eng.setupSide(id, dims(variant), sidesRef.current[id]?.background ?? eng.background);
          await eng.restore(sidesRef.current[id]);
          found.push(...eng.preflight());
        }
        if (found.length) {
          await showSideAgain();
          setBusy(null);
          return setIssues({ list: found, lines });
        }
        setBusy("Saving your design…");
      }

      const meta = JSON.stringify({
        slug: product.slug,
        variant,
        sides: Object.fromEntries(used.map((id) => [id, sidesRef.current[id]])),
      });

      // Export every side, shrinking the print files if needed to fit the upload limit.
      let body = new FormData();
      let scale = 1;
      for (let attempt = 0; ; attempt++) {
        body = new FormData();
        let total = meta.length;
        for (const id of used) {
          await eng.setupSide(id, dims(variant), sidesRef.current[id]?.background ?? eng.background);
          await eng.restore(sidesRef.current[id]);
          const { preview, print, cut } = await eng.export(scale);
          body.append(`${id}-preview`, preview, `${id}-preview.png`);
          body.append(`${id}-print`, print, `${id}-print.png`);
          total += preview.size + print.size;
          if (cut) {
            body.append(`${id}-cut`, new Blob([cut], { type: "image/svg+xml" }), `${id}-cut.svg`);
            total += cut.length;
          }
        }
        if (total <= MAX_DESIGN_BYTES) break;
        if (attempt >= 5) throw new Error("This design is too detailed to save. Try fewer or smaller images.");
        scale *= Math.max(0.4, Math.min(0.9, Math.sqrt(MAX_DESIGN_BYTES / total) * 0.95));
        setBusy("Optimizing print files…");
      }
      body.append("meta", meta);
      const res = await fetch("/api/designs", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save your design.");

      const preview = `/api/designs/${data.id}/${used[0]}-preview.png`;
      for (const l of lines) add({ slug: product.slug, variant: l.variant, qty: l.qty, designId: data.id, preview });
      router.push("/cart");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your design.");
      await showSideAgain();
      setBusy(null);
    }
  }

  const activeFont = fonts.find((f) => f.family === sel?.fontFamily);

  return (
    // A form with autoComplete off stops Firefox restoring controls' disabled state on reload,
    // which would break hydration. Nothing here submits.
    <form autoComplete="off" onSubmit={(ev) => ev.preventDefault()} className={`grid gap-4 lg:gap-6 ${gang ? "lg:grid-cols-[17rem_1fr_16rem]" : "lg:grid-cols-[19rem_1fr_17rem]"}`}>
      {/* Tools */}
      <aside className="order-2 rounded-2xl border border-line bg-white lg:order-1">
        <div className="grid grid-cols-4 border-b border-line text-xs font-semibold">
          {(
            [
              ["text", "Text", "M4 6V4h16v2M9 20h6M12 4v16"],
              ["upload", "Upload", "M12 16V4m0 0L7 9m5-5 5 5M4 20h16"],
              ["shapes", "Shapes", "M4 4h7v7H4zM17.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM7.5 13 11 20H4z"],
              ["product", "Product", "M4 7l8-4 8 4v10l-8 4-8-4z"],
            ] as const
          ).map(([id, label, d]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 py-3 transition ${
                tab === id ? "border-b-2 border-magenta text-navy" : "text-ink/50 hover:text-navy"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d={d} />
              </svg>
              {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "text" && (
            <div className="space-y-3">
              <label htmlFor="new-text" className="label">Add text</label>
              <textarea id="new-text" rows={2} value={newText} onChange={(ev) => setNewText(ev.target.value)} className="field" />
              <button
                type="button"
                disabled={!ready || !newText.trim()}
                onClick={() => e?.addText(newText.trim(), fonts[0].family)}
                className="btn-primary w-full"
              >
                Add text to design
              </button>
              <p className="text-xs text-ink/50">Tip: double-click text on the design to edit it there.</p>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-3">
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center transition hover:border-navy/40 hover:bg-mist"
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={(ev) => {
                  ev.preventDefault();
                  const files = [...ev.dataTransfer.files];
                  if (files.length) upload(files);
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-navy" aria-hidden>
                  <path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16" />
                </svg>
                <span className="text-sm font-semibold text-navy">{gang ? "Upload images" : "Upload an image"}</span>
                <span className="text-xs text-ink/50">PNG, JPG, WEBP or GIF up to {MAX_UPLOAD_MB} MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  multiple={gang}
                  disabled={!ready || !!busy}
                  onChange={(ev) => {
                    const files = [...(ev.target.files ?? [])];
                    ev.target.value = "";
                    if (files.length) upload(files);
                  }}
                />
              </label>
              <p className="text-xs text-ink/50">
                {gang
                  ? "Select several files at once. Use high-resolution PNGs with a transparent background; images are placed at their natural size (300 DPI)."
                  : "For the best print, use a high-resolution image. A transparent PNG works best on shirts."}
              </p>
              {gang && library.length > 0 && (
                <div>
                  <span className="label">Your images · click to add again</span>
                  <div className="grid grid-cols-4 gap-2">
                    {library.map((img) => (
                      <div key={img.url} className="group relative">
                        <button
                          type="button"
                          disabled={!ready || !!busy}
                          onClick={() => e?.addImage(img.url)}
                          title={img.name}
                          className="aspect-square w-full overflow-hidden rounded-lg border border-line bg-mist p-1 hover:border-navy/40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- user upload served by our API */}
                          <img src={img.url} alt={img.name} className="h-full w-full object-contain" />
                        </button>
                        <button
                          type="button"
                          disabled={!ready || !!busy}
                          onClick={() => deleteImage(img)}
                          aria-label={`Delete ${img.name}`}
                          title="Delete this image"
                          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-navy text-white shadow transition hover:bg-magenta focus-visible:bg-magenta"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden>
                            <path d="M6 6l12 12M18 6 6 18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "shapes" && (
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["rect", <rect key="r" x="4" y="4" width="16" height="16" rx="2" />],
                  ["circle", <circle key="c" cx="12" cy="12" r="8" />],
                  ["triangle", <path key="t" d="M12 4l9 16H3z" />],
                  ["star", <path key="s" d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />],
                ] as const
              ).map(([kind, icon]) => (
                <button
                  key={kind}
                  type="button"
                  disabled={!ready}
                  onClick={() => e?.addShape(kind, "#ec008c")}
                  className="grid aspect-square place-items-center rounded-xl border border-line text-navy hover:border-navy/40 hover:bg-mist"
                  aria-label={`Add ${kind}`}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{icon}</svg>
                </button>
              ))}
            </div>
          )}

          {tab === "product" && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-navy">{product.name}</p>
                <Link href="/design" className="text-xs text-ink/50 hover:text-navy hover:underline">Change product</Link>
              </div>
              {config.kind === "flat" && (
                <VariantPicker product={product} value={variant} onChange={changeVariant} compact />
              )}
              {config.kind === "flat" && !config.transparent && (
                <div>
                  <span className="label">Background color</span>
                  <Swatches value={e?.background} onPick={(c) => e?.setBackground(c)} />
                </div>
              )}
              {config.kind === "flat" && config.note && <p className="text-sm text-ink/60">{config.note}</p>}
              {gang && (
                <div className="rounded-lg bg-mist px-3 py-2 text-sm text-navy">
                  Sheet used: <b>{used.toFixed(1)}&quot;</b> of {dims(variant)[1]}&quot;
                  {used > dims(variant)[1] + 0.05 && <span className="block text-xs text-magenta">Your artwork runs past the end of the sheet. Pick a longer size.</span>}
                </div>
              )}
              {config.kind === "mockup" && (
                <p className="text-sm text-ink/60">
                  You&apos;ll choose sizes and quantities when you add this design to your cart.
                </p>
              )}
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-magenta/10 px-3 py-2 text-sm text-magenta" role="alert">{error}</p>}
        </div>
      </aside>

      {/* Canvas */}
      <section className="order-1 min-w-0 lg:order-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <IconButton label="Undo" disabled={!hist.undo} onClick={() => e?.undo()} d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
            <IconButton label="Redo" disabled={!hist.redo} onClick={() => e?.redo()} d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
            {gang && (
              <select
                value={variant}
                disabled={!ready || !!busy}
                onChange={(ev) => changeVariant(ev.target.value)}
                className="field ml-1 w-auto py-1.5 pl-3 pr-8 text-sm font-medium"
                aria-label="Sheet size"
                title="Sheet size"
              >
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.label} · {formatPrice(v.price ?? 0)}</option>
                ))}
              </select>
            )}
            {gang && (
              <button
                type="button"
                disabled={!ready || !!busy || (counts[side] ?? 0) === 0}
                onClick={() => e?.arrange()}
                className="ml-1 rounded-lg border border-line bg-white px-3 text-sm font-medium text-navy transition hover:bg-mist disabled:opacity-40"
                title="Pack every design onto the sheet, biggest first"
              >
                Auto-arrange
              </button>
            )}
          </div>
          {gang && (
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              <div className="flex items-center gap-1" role="group" aria-label="Zoom">
                <button type="button" onClick={() => changeZoom(zoomRef.current - 0.25)} disabled={zoom <= 0.5} aria-label="Zoom out" className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-lg text-navy hover:bg-mist disabled:opacity-40">−</button>
                <button type="button" onClick={() => changeZoom(1)} title="Fit the sheet to the width" className="h-9 min-w-14 rounded-lg border border-line bg-white px-2 text-sm font-medium text-navy hover:bg-mist">
                  {zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}
                </button>
                <button type="button" onClick={() => changeZoom(zoomRef.current + 0.25)} disabled={zoom >= 3} aria-label="Zoom in" className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-lg text-navy hover:bg-mist disabled:opacity-40">+</button>
              </div>
              <div className="flex items-center gap-1.5" role="group" aria-label="Preview background" title="Only changes how the sheet looks here. The print file stays transparent.">
                <span className="text-xs text-ink/50">Preview on</span>
                {PREVIEW_BGS.map(([c, label]) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => changePreviewBg(c)}
                    aria-label={`${label} background`}
                    aria-pressed={previewBg === c}
                    title={label}
                    className={`h-6 w-6 rounded-full border border-black/15 ${previewBg === c ? "ring-2 ring-navy ring-offset-1" : ""}`}
                    style={{ background: c === "transparent" ? "repeating-conic-gradient(#e8ebf0 0 25%, #fff 0 50%) 0 0 / 10px 10px" : c }}
                  />
                ))}
                <label className="relative grid h-6 w-6 cursor-pointer place-items-center overflow-hidden rounded-full border border-black/15 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" aria-label="Custom background color" title="Custom color">
                  <input
                    type="color"
                    value={previewBg.startsWith("#") ? previewBg : "#ffffff"}
                    onChange={(ev) => changePreviewBg(ev.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
          )}
          {config.sides.length > 1 && (
            <div className="flex rounded-full bg-mist p-1 text-sm font-medium">
              {config.sides.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={!ready || !!busy}
                  onClick={() => s.id !== side && showSide(s.id)}
                  className={`rounded-full px-4 py-1.5 transition ${s.id === side ? "bg-white text-navy shadow" : "text-ink/60"}`}
                >
                  {s.label}
                  {(counts[s.id] ?? 0) > 0 && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-magenta align-middle" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <div
            ref={boxEl}
            className={`grid min-h-[320px] rounded-2xl bg-mist p-2 ${
              gang ? "max-h-[calc(100vh-11rem)] min-h-[60vh] place-items-start overflow-auto [scrollbar-gutter:stable]" : "place-items-center"
            }`}
          >
            {/* Rulers come after the canvas, so React only ever appends next to the wrapper Fabric puts it in. */}
            <div className="relative mx-auto" style={gang ? { paddingLeft: RULER_PX, paddingTop: RULER_PX } : undefined}>
              <canvas ref={canvasEl} />
              <Ruler info={gang ? ruler : null} />
            </div>
          </div>
          {(!ready || busy) && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/70 text-sm font-medium text-navy backdrop-blur-sm">
              {busy ?? "Loading design studio…"}
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-ink/50">
          {gang ? (
            <>Scroll to see the whole sheet. Designs outside the sheet won&apos;t be printed. The preview color is only for viewing: it prints on transparent film.</>
          ) : e && e.bleedPx > 0 ? (
            <>
              Blue line = final trimmed size · pink line = keep text inside · pink shaded edge = bleed: stretch backgrounds all the way out to it.
            </>
          ) : (
            <>Anything outside the dashed print area won&apos;t be printed.</>
          )}
        </p>
      </section>

      {/* Properties + add to cart */}
      <aside className="order-3 space-y-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          {!sel ? (
            <p className="text-sm text-ink/50">Select something on your design to edit it.</p>
          ) : (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold capitalize text-navy">{sel.kind === "group" ? "Selection" : sel.kind}</h3>

              {sel.kind === "text" && (
                <>
                  <textarea
                    rows={2}
                    value={sel.text}
                    onChange={(ev) => e?.update({ text: ev.target.value })}
                    className="field"
                    aria-label="Text"
                  />
                  <select
                    value={activeFont?.family ?? sel.fontFamily}
                    onChange={(ev) => e?.update({ fontFamily: ev.target.value })}
                    className="field"
                    style={{ fontFamily: sel.fontFamily }}
                    aria-label="Font"
                  >
                    {fonts.map((f) => (
                      <option key={f.name} value={f.family} style={{ fontFamily: f.family }}>{f.name}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={6}
                      max={400}
                      value={sel.fontSize}
                      onChange={(ev) => e?.setFontSize(Math.max(6, Number(ev.target.value) || 6))}
                      className="field w-20 px-3 py-2"
                      aria-label="Font size"
                    />
                    <Toggle on={sel.bold} label="Bold" onClick={() => e?.update({ fontWeight: sel.bold ? "normal" : "bold" })}>
                      <b>B</b>
                    </Toggle>
                    <Toggle on={sel.italic} label="Italic" onClick={() => e?.update({ fontStyle: sel.italic ? "normal" : "italic" })}>
                      <i className="font-serif">I</i>
                    </Toggle>
                    {(["left", "center", "right"] as const).map((a) => (
                      <Toggle key={a} on={sel.align === a} label={`Align ${a}`} onClick={() => e?.update({ textAlign: a })}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                          <path d={a === "left" ? "M3 6h18M3 12h12M3 18h16" : a === "center" ? "M3 6h18M6 12h12M4 18h16" : "M3 6h18M9 12h12M5 18h16"} />
                        </svg>
                      </Toggle>
                    ))}
                  </div>
                  <div>
                    <span className="label">Color</span>
                    <Swatches value={sel.fill} onPick={(c) => e?.update({ fill: c })} />
                  </div>
                  <div>
                    <span className="label">Outline</span>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      step={0.5}
                      value={sel.strokeWidth}
                      onChange={(ev) => e?.update({ strokeWidth: Number(ev.target.value), stroke: sel.stroke || "#ffffff" })}
                      className="w-full accent-navy"
                      aria-label="Outline width"
                    />
                    {(sel.strokeWidth ?? 0) > 0 && <Swatches value={sel.stroke} onPick={(c) => e?.update({ stroke: c })} />}
                  </div>
                  <div>
                    <span className="label">Letter spacing</span>
                    <input
                      type="range"
                      min={-100}
                      max={800}
                      step={10}
                      value={sel.charSpacing}
                      onChange={(ev) => e?.update({ charSpacing: Number(ev.target.value) })}
                      className="w-full accent-navy"
                      aria-label="Letter spacing"
                    />
                  </div>
                </>
              )}

              {sel.kind === "image" && sel.dpi !== undefined && (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${
                    sel.dpi >= (sel.goodDpi ?? 150) ? "bg-cyan/10 text-navy" : sel.dpi >= (sel.minDpi ?? 100) ? "bg-yellow/25 text-navy" : "bg-magenta/10 text-magenta"
                  }`}
                >
                  Print quality: <b>{sel.dpi >= (sel.goodDpi ?? 150) ? "Great" : sel.dpi >= (sel.minDpi ?? 100) ? "OK" : "Low"}</b> ({sel.dpi} DPI at this size)
                  {sel.dpi < (sel.minDpi ?? 100) && <span className="block text-xs">Make it smaller or upload a larger image.</span>}
                </p>
              )}

              {sel.kind === "shape" && (
                <div>
                  <span className="label">Color</span>
                  <Swatches value={sel.fill} onPick={(c) => e?.update({ fill: c })} />
                </div>
              )}

              {gang && sel.widthIn !== undefined && sel.kind !== "text" && sel.kind !== "group" && (
                <div>
                  <span className="label">Size (inches)</span>
                  <div className="flex items-center gap-2">
                    <input
                      key={`w${sel.widthIn.toFixed(2)}`}
                      type="number"
                      min={0.25}
                      step={0.25}
                      defaultValue={Number(sel.widthIn.toFixed(2))}
                      onBlur={(ev) => e?.setSizeIn("w", Number(ev.target.value))}
                      onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()}
                      className="field w-20 px-3 py-2"
                      aria-label="Width in inches"
                    />
                    <span className="text-ink/40">×</span>
                    <input
                      key={`h${sel.heightIn!.toFixed(2)}`}
                      type="number"
                      min={0.25}
                      step={0.25}
                      defaultValue={Number(sel.heightIn!.toFixed(2))}
                      onBlur={(ev) => e?.setSizeIn("h", Number(ev.target.value))}
                      onKeyDown={(ev) => ev.key === "Enter" && ev.currentTarget.blur()}
                      className="field w-20 px-3 py-2"
                      aria-label="Height in inches"
                    />
                  </div>
                </div>
              )}

              {gang && sel.kind !== "group" && (
                <div>
                  <span className="label">Copies</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={copies}
                      onChange={(ev) => setCopies(Math.min(200, Math.max(1, Math.floor(Number(ev.target.value) || 1))))}
                      className="field w-20 px-3 py-2"
                      aria-label="Number of copies"
                    />
                    <button type="button" onClick={() => addCopies(copies)} className="btn-outline flex-1 px-3 py-2 text-sm">
                      Add copies
                    </button>
                  </div>
                </div>
              )}

              <div>
                <span className="label">Opacity</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={sel.opacity}
                  onChange={(ev) => e?.update({ opacity: Number(ev.target.value) })}
                  className="w-full accent-navy"
                  aria-label="Opacity"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <IconButton label="Center horizontally" onClick={() => e?.centerH()} d="M12 3v18M7 8h10v8H7z" />
                <IconButton label="Center vertically" onClick={() => e?.centerV()} d="M3 12h18M8 7h8v10H8z" />
                <IconButton label="Flip" onClick={() => e?.flip()} d="M12 3v18M8 7l-5 5 5 5V7zM16 7l5 5-5 5V7z" />
                <IconButton label="Duplicate" onClick={() => e?.duplicate()} d="M8 8h12v12H8zM4 16V4h12" />
                <IconButton label="Bring forward" onClick={() => e?.forward()} d="M12 19V5m0 0-6 6m6-6 6 6" />
                <IconButton label="Send backward" onClick={() => e?.backward()} d="M12 5v14m0 0-6-6m6 6 6-6" />
                <IconButton label="Delete" onClick={() => e?.remove()} d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" danger />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-navy p-4 text-white">
          <p className="text-sm text-white/70">{product.name}</p>
          {gang ? (
            <>
              <p className="text-sm text-white/70">{product.variants.find((v) => v.id === variant)?.label}</p>
              <p className="mt-1 text-2xl font-bold">{formatPrice(product.variants.find((v) => v.id === variant)?.price ?? 0)}</p>
            </>
          ) : (
            <p className="mt-1 text-2xl font-bold">
              {formatPrice(fromPrice(product) ?? 0)}
              <span className="ml-1 text-sm font-normal text-white/60">and up</span>
            </p>
          )}
          <button type="button" disabled={!ready || !!busy} onClick={() => (product.noQty ? saveAndAdd([{ variant, qty: 1 }]) : setCheckout(true))} className="btn mt-4 w-full bg-magenta text-white hover:brightness-110">
            Add to cart
          </button>
          <p className="mt-2 text-xs text-white/60">We&apos;ll send a proof before anything prints.</p>
        </div>
      </aside>

      {issues && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/60 p-4" role="dialog" aria-modal="true" onClick={() => setIssues(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
            <h2 className="font-display text-xl text-navy">Check your design before ordering</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink/80">
              {issues.list.map((i) => <li key={i}>{i}</li>)}
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setIssues(null)} className="btn-primary px-4 py-2">Go back and fix</button>
              <button type="button" onClick={() => saveAndAdd(issues.lines, true)} className="btn-outline px-4 py-2">Order anyway</button>
            </div>
          </div>
        </div>
      )}

      {checkout && (
        <QuantityDialog
          product={product}
          variant={variant}
          perSize={config.kind === "mockup"}
          onClose={() => setCheckout(false)}
          onConfirm={(lines) => {
            setCheckout(false);
            saveAndAdd(lines);
          }}
        />
      )}
    </form>
  );
}

/** Inch rulers along the top and left edges of a gang sheet, drawn to match the canvas scale. */
function Ruler({ info }: { info: RulerInfo | null }) {
  if (!info) return null;
  const { ppi, left, top, widthIn, heightIn, canvasWidth, canvasHeight } = info;
  // Label every 1, 2, 5 or 10 inches, whichever keeps the numbers from touching.
  const every = [1, 2, 5, 10].find((n) => n * ppi >= 26) ?? 10;
  const ticks = (len: number) =>
    Array.from({ length: Math.floor(len) + 1 }, (_, i) => ({ i, major: i % every === 0 }));
  const x = (i: number) => RULER_PX + left + i * ppi;
  const y = (i: number) => RULER_PX + top + i * ppi;
  const cls = "pointer-events-none absolute select-none fill-ink/55 text-[9px] text-ink/45";

  return (
    <>
      <svg className={cls} style={{ left: 0, top: 0 }} width={canvasWidth + RULER_PX} height={RULER_PX} aria-hidden>
        <text x={2} y={RULER_PX - 8} className="text-[8px]">in</text>
        {ticks(widthIn).map(({ i, major }) => (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={RULER_PX - (major ? 9 : 4)} y2={RULER_PX} stroke="currentColor" strokeWidth="1" />
            {major && <text x={x(i) + 2} y={RULER_PX - 11}>{i}</text>}
          </g>
        ))}
      </svg>
      <svg className={cls} style={{ left: 0, top: 0 }} width={RULER_PX} height={canvasHeight + RULER_PX} aria-hidden>
        {ticks(heightIn).map(({ i, major }) => (
          <g key={i}>
            <line y1={y(i)} y2={y(i)} x1={RULER_PX - (major ? 9 : 4)} x2={RULER_PX} stroke="currentColor" strokeWidth="1" />
            {major && i > 0 && <text x={1} y={y(i) - 2}>{i}</text>}
          </g>
        ))}
      </svg>
    </>
  );
}

function QuantityDialog({
  product,
  variant,
  perSize,
  onClose,
  onConfirm,
}: {
  product: StudioProps["product"];
  variant: string;
  perSize: boolean;
  onClose: () => void;
  onConfirm: (lines: { variant: string; qty: number }[]) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>(perSize ? {} : { [variant]: 1 });
  const lines = Object.entries(qty).filter(([, n]) => n > 0).map(([v, n]) => ({ variant: v, qty: n }));
  const total = lines.reduce((sum, l) => sum + (product.variants.find((v) => v.id === l.variant)?.price ?? 0) * l.qty, 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-900/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
        <h2 className="font-display text-xl text-navy">{perSize ? "Choose sizes & quantities" : "How many?"}</h2>
        <p className="mt-1 text-sm text-ink/60">{product.name}</p>
        <div className={`mt-5 grid gap-3 ${perSize ? "grid-cols-3" : ""}`}>
          {(perSize ? product.variants : product.variants.filter((v) => v.id === variant)).filter((v) => v.price !== null).map((v) => (
            <label key={v.id} className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">
                {v.label} · {formatPrice(v.price!)}
              </span>
              <input
                type="number"
                min={0}
                value={qty[v.id] ?? ""}
                placeholder="0"
                onChange={(ev) => setQty((q) => ({ ...q, [v.id]: Math.max(0, Math.floor(Number(ev.target.value) || 0)) }))}
                className="field px-3 py-2"
              />
            </label>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm text-ink/60">
            {lines.reduce((n, l) => n + l.qty, 0)} items · <b className="text-navy">{formatPrice(total)}</b>
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-outline px-4 py-2">Cancel</button>
            <button type="button" disabled={lines.length === 0} onClick={() => onConfirm(lines)} className="btn-primary px-4 py-2">
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Swatches({ value, onPick }: { value?: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          aria-label={c}
          className={`h-7 w-7 rounded-full border border-black/10 ${value?.toLowerCase() === c ? "ring-2 ring-navy ring-offset-2" : ""}`}
          style={{ background: c }}
        />
      ))}
      <label className="relative grid h-7 w-7 cursor-pointer place-items-center overflow-hidden rounded-full border border-black/10 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" aria-label="Custom color">
        <input
          type="color"
          value={value && value.startsWith("#") && value.length === 7 ? value : "#000000"}
          onChange={(ev) => onPick(ev.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

function Toggle({ on, label, onClick, children }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-lg border text-sm ${on ? "border-navy bg-navy text-white" : "border-line hover:bg-mist"}`}
    >
      {children}
    </button>
  );
}

function IconButton({ label, onClick, d, disabled, danger }: { label: string; onClick: () => void; d: string; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-9 w-full min-w-9 place-items-center rounded-lg border border-line bg-white transition hover:bg-mist disabled:opacity-40 ${
        danger ? "text-magenta" : "text-navy"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </button>
  );
}
