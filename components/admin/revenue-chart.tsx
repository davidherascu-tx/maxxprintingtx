"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/catalog";

export type Day = { day: string; revenue: number; orders: number };

const BAR = "#1f5fbf";
const W = 720;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 52 };

const label = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("en-US", opts);

/** Paid revenue, one bar per day. `days` comes from the server with empty days filled in. */
export function RevenueChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => d.revenue), 1);
  // A round-ish top for the axis: 1, 2 or 5 × a power of ten.
  const mag = 10 ** Math.floor(Math.log10(max));
  const top = [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= max)!;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / days.length;
  const barW = slot - 2; // 2px gap between bars
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const h = hover !== null ? days[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Paid revenue per day, last 30 days" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(top * f)} y2={y(top * f)} stroke="#e3e8f0" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(top * f)} textAnchor="end" dominantBaseline="middle" className="fill-ink/50 text-[11px]">
              {formatPrice(top * f).replace(/\.00$/, "")}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD.left + i * slot + 1;
          const bh = Math.max(0, y(0) - y(d.revenue));
          const r = Math.min(4, barW / 2, bh);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              {/* Full-height hit target so empty days can be hovered too. */}
              <rect x={x - 1} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              {bh > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(d.revenue) + r} Q${x},${y(d.revenue)} ${x + r},${y(d.revenue)} H${x + barW - r} Q${x + barW},${y(d.revenue)} ${x + barW},${y(d.revenue) + r} V${y(0)} Z`}
                  fill={BAR}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {(i === 0 || i === Math.floor(days.length / 2) || i === days.length - 1) && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" className="fill-ink/50 text-[11px]">
                  {label(d.day, { month: "short", day: "numeric" })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`, transform: `translateX(${hover > days.length * 0.66 ? "-100%" : "0"})` }}
        >
          <p className="font-medium text-ink">{label(h.day, { weekday: "short", month: "short", day: "numeric" })}</p>
          <p className="text-ink/70">{formatPrice(h.revenue)} · {h.orders} {h.orders === 1 ? "order" : "orders"}</p>
        </div>
      )}
    </div>
  );
}
