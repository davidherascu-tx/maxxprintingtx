"use client";

import { useRef, useState } from "react";
import type { Area } from "@/lib/design-config";

const MIN = 0.05;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The mockup photo with a print box on top. Drag the box to move it, drag the corner to resize.
 * Writes `<side>:x|y|w|h` fields (fractions of the image) for the form around it.
 */
export function AreaEditor({ side, mockup, initial }: { side: string; mockup: string; initial: Area }) {
  const [area, setArea] = useState(initial);
  const frame = useRef<HTMLDivElement>(null);

  function drag(e: React.PointerEvent, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    const rect = frame.current!.getBoundingClientRect();
    const start = { px: e.clientX, py: e.clientY, area };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / rect.width;
      const dy = (ev.clientY - start.py) / rect.height;
      const a = start.area;
      setArea(
        mode === "move"
          ? { ...a, x: clamp(a.x + dx, 0, 1 - a.w), y: clamp(a.y + dy, 0, 1 - a.h) }
          : { ...a, w: clamp(a.w + dx, MIN, 1 - a.x), h: clamp(a.h + dy, MIN, 1 - a.y) },
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const pct = (n: number) => `${n * 100}%`;
  return (
    <div>
      {(["x", "y", "w", "h"] as const).map((k) => (
        <input key={k} type="hidden" name={`${side}:${k}`} value={area[k]} />
      ))}
      <div ref={frame} className="relative inline-block max-w-full select-none touch-none overflow-hidden rounded-xl bg-mist">
        {/* eslint-disable-next-line @next/next/no-img-element -- plain img so the box lines up with the image edges */}
        <img src={mockup} alt="" draggable={false} className="block max-h-[34rem] w-auto max-w-full" />
        <div
          onPointerDown={(e) => drag(e, "move")}
          className="absolute cursor-move border-2 border-dashed border-magenta bg-magenta/10"
          style={{ left: pct(area.x), top: pct(area.y), width: pct(area.w), height: pct(area.h) }}
        >
          <span className="pointer-events-none absolute left-1 top-1 rounded bg-magenta px-1.5 py-0.5 text-[10px] font-semibold text-white">Print area</span>
          <span
            onPointerDown={(e) => drag(e, "resize")}
            className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-magenta shadow"
            aria-label="Resize print area"
          />
        </div>
      </div>
    </div>
  );
}
