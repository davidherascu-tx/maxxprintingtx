"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatPrice, fromPrice, type Product } from "@/lib/catalog";
import { VariantPicker } from "@/components/variant-picker";
import type { DesignConfig } from "@/lib/design-config";
import type { DesignFont } from "@/lib/design-fonts";
import { useCart } from "../cart";
import { StudioEngine, type Selection, type SideState } from "./engine";

type Tab = "text" | "upload" | "shapes" | "product";

const COLORS = [
  "#000000", "#ffffff", "#02245b", "#1d4ed8", "#00aeef", "#0f766e", "#16a34a",
  "#facc15", "#ffd200", "#f97316", "#dc2626", "#ec008c", "#7c3aed", "#6b7280", "#b8860b",
];
const MAX_UPLOAD = 4 * 1024 * 1024;
// A saved design goes up in one request, which must stay under 4.5 MB (hosting limit).
const MAX_DESIGN_BYTES = 3.8 * 1000 * 1000;

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
  }, [side]);

  const fit = useCallback(() => {
    const box = boxEl.current;
    if (!box || !engineRef.current) return;
    engineRef.current.fit(box.clientWidth, Math.max(320, window.innerHeight - 260));
  }, []);

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
    // Re-fit every side's artwork to the new size.
    sidesRef.current[side] = eng.serialize();
    const from = { ...eng.area };
    await eng.setupSide(side, dims(v), eng.background);
    const to = { ...eng.area };
    for (const id of Object.keys(sidesRef.current)) {
      sidesRef.current[id] = StudioEngine.remap(sidesRef.current[id], from, to);
    }
    await eng.restore(sidesRef.current[side]);
    eng.commit();
    fit();
  }

  async function upload(file: File) {
    setError(null);
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return setError("Please choose a PNG, JPG, WEBP or GIF image.");
    if (file.size > MAX_UPLOAD) return setError("Images must be 4 MB or smaller.");
    setBusy("Uploading image…");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      await engineRef.current?.addImage(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
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
    <form autoComplete="off" onSubmit={(ev) => ev.preventDefault()} className="grid gap-4 lg:grid-cols-[19rem_1fr_17rem] lg:gap-6">
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
                  const file = ev.dataTransfer.files[0];
                  if (file) upload(file);
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-navy" aria-hidden>
                  <path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16" />
                </svg>
                <span className="text-sm font-semibold text-navy">Upload an image</span>
                <span className="text-xs text-ink/50">PNG, JPG, WEBP or GIF up to 4 MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={!ready || !!busy}
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    ev.target.value = "";
                    if (file) upload(file);
                  }}
                />
              </label>
              <p className="text-xs text-ink/50">
                For the best print, use a high-resolution image. A transparent PNG works best on shirts.
              </p>
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
          </div>
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
        <div ref={boxEl} className="relative grid min-h-[320px] place-items-center rounded-2xl bg-mist p-2">
          <canvas ref={canvasEl} />
          {(!ready || busy) && (
            <div className="absolute inset-0 grid place-items-center rounded-2xl bg-white/70 text-sm font-medium text-navy backdrop-blur-sm">
              {busy ?? "Loading design studio…"}
            </div>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-ink/50">
          {e && e.bleedPx > 0 ? (
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
          <p className="mt-1 text-2xl font-bold">
            {formatPrice(fromPrice(product) ?? 0)}
            <span className="ml-1 text-sm font-normal text-white/60">and up</span>
          </p>
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
