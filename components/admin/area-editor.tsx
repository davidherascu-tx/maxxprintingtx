"use client";

import { useRef, useState } from "react";
import type { Area } from "@/lib/design-config";

type Pt = [number, number];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const MAX_POINTS = 12;

const rectPoints = (a: Area): Pt[] => [[a.x, a.y], [a.x + a.w, a.y], [a.x + a.w, a.y + a.h], [a.x, a.y + a.h]];
const trianglePoints = (a: Area): Pt[] => [[a.x + a.w / 2, a.y], [a.x + a.w, a.y + a.h], [a.x, a.y + a.h]];

/**
 * The mockup photo with the print area on top, as a shape with corner points. Drag a point to
 * reshape it, drag inside the shape to move it, and use the buttons to add or remove points
 * (3 points = a triangle). Writes `<side>:x|y|w|h|points` fields for the form around it.
 */
export function AreaEditor({ side, mockup, initial }: { side: string; mockup: string; initial: Area }) {
  const [pts, setPts] = useState<Pt[]>(initial.points?.length ? initial.points : rectPoints(initial));
  const [selected, setSelected] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  // A plain four-cornered box is saved as a box, not a shape.
  const isBox = pts.length === 4 && pts.every(([px, py]) => (px === box.x || px === box.x + box.w) && (py === box.y || py === box.y + box.h)) &&
    new Set(pts.map((p) => p.join())).size === 4;

  function drag(e: React.PointerEvent, index: number | "all") {
    e.preventDefault();
    e.stopPropagation();
    const rect = frame.current!.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, pts };
    if (index !== "all") setSelected(index);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / rect.width;
      const dy = (ev.clientY - start.py) / rect.height;
      if (index === "all") {
        const sx = start.pts.map((p) => p[0]), sy = start.pts.map((p) => p[1]);
        const mx = clamp(dx, -Math.min(...sx), 1 - Math.max(...sx));
        const my = clamp(dy, -Math.min(...sy), 1 - Math.max(...sy));
        setPts(start.pts.map(([px, py]): Pt => [px + mx, py + my]));
      } else {
        const [px, py] = start.pts[index];
        setPts(start.pts.map((p, i): Pt => (i === index ? [clamp(px + dx, 0, 1), clamp(py + dy, 0, 1)] : p)));
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** New point in the middle of the longest edge (or after the selected point). */
  function addPoint() {
    if (pts.length >= MAX_POINTS) return;
    let at = 0;
    if (selected !== null) at = selected;
    else {
      let best = -1;
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length];
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (len > best) { best = len; at = i; }
      });
    }
    const p = pts[at], q = pts[(at + 1) % pts.length];
    const next = [...pts.slice(0, at + 1), [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as Pt, ...pts.slice(at + 1)];
    setPts(next);
    setSelected(at + 1);
  }

  function removePoint(index = selected) {
    if (pts.length <= 3 || index === null) return;
    setPts(pts.filter((_, i) => i !== index));
    setSelected(null);
  }

  const r = (n: number) => Math.round(n * 1000) / 1000;
  const btn = "rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-navy hover:bg-mist";
  return (
    <div>
      {(["x", "y", "w", "h"] as const).map((k) => (
        <input key={k} type="hidden" name={`${side}:${k}`} value={r(box[k])} />
      ))}
      <input type="hidden" name={`${side}:points`} value={isBox ? "" : JSON.stringify(pts.map(([px, py]) => [r(px), r(py)]))} />

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={addPoint}>+ Add point</button>
        <button type="button" className={`${btn} ${pts.length <= 3 || selected === null ? "opacity-40" : ""}`} onClick={() => removePoint()}>− Remove selected point</button>
        <button type="button" className={btn} onClick={() => { setPts(trianglePoints(box)); setSelected(null); }}>△ Triangle</button>
        <button type="button" className={btn} onClick={() => { setPts(rectPoints(box)); setSelected(null); }}>▭ Box</button>
        <span className="text-xs text-ink/50">{pts.length} points</span>
      </div>

      <div ref={frame} className="relative inline-block max-w-full select-none touch-none overflow-hidden rounded-xl bg-mist" onPointerDown={() => setSelected(null)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- plain img so the shape lines up with the image edges */}
        <img src={mockup} alt="" draggable={false} className="block max-h-[34rem] w-auto max-w-full" />
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polygon
            points={pts.map((p) => p.join(",")).join(" ")}
            onPointerDown={(e) => drag(e, "all")}
            className="cursor-move fill-[#ec008c]/10 stroke-[#ec008c]"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
            style={{ vectorEffect: "non-scaling-stroke" }}
          />
        </svg>
        {pts.map(([px, py], i) => (
          <span
            key={i}
            onPointerDown={(e) => drag(e, i)}
            onDoubleClick={() => removePoint(i)}
            title="Drag to move. Double-click to remove."
            className={`absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-2 border-white shadow ${i === selected ? "bg-navy" : "bg-magenta"}`}
            style={{ left: `${px * 100}%`, top: `${py * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
