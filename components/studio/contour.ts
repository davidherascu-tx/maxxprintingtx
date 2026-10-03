// Builds a vector cut path (SVG) around everything printed on a transparent canvas, for
// contour-cut products (die-cut stickers, big heads, cut-outs). The path follows the
// outer silhouette, offset outward slightly so the cut never clips the artwork.

type Pt = [number, number];

const MAX_MASK = 2000;
const ALPHA_MIN = 24;

/** Outer silhouette of `src` as a closed polygon list, in pixels of the scaled mask. */
function silhouette(src: HTMLCanvasElement, scale: number, radius: number) {
  const w = Math.round(src.width * scale) + 2;
  const h = Math.round(src.height * scale) + 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const sw = w - 2, sh = h - 2;

  // Grow the artwork by drawing it around a ring (and a half-ring) of offsets.
  ctx.drawImage(src, 1, 1, sw, sh);
  for (const [r, steps] of [[radius, 36], [radius / 2, 18]] as const) {
    if (r < 0.5) continue;
    for (let i = 0; i < steps; i++) {
      const a = (Math.PI * 2 * i) / steps;
      ctx.drawImage(src, 1 + Math.cos(a) * r, 1 + Math.sin(a) * r, sw, sh);
    }
  }

  const data = ctx.getImageData(0, 0, w, h).data;
  const inside = new Uint8Array(w * h);
  for (let i = 0; i < inside.length; i++) inside[i] = data[i * 4 + 3] > ALPHA_MIN ? 1 : 0;

  // Fill interior holes (the inside of an "O"): only the outer outline is cut.
  const outside = new Uint8Array(w * h);
  const queue = [0];
  outside[0] = 1;
  while (queue.length) {
    const p = queue.pop()!;
    const x = p % w, y = (p / w) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (!outside[q] && !inside[q]) {
        outside[q] = 1;
        queue.push(q);
      }
    }
  }
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !outside[y * w + x];

  // Collect boundary edges (inside on the right-hand side) and chain them into loops.
  const next = new Map<number, number[]>();
  const key = (x: number, y: number) => y * (w + 1) + x;
  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    const k = key(x1, y1);
    const list = next.get(k);
    if (list) list.push(key(x2, y2));
    else next.set(k, [key(x2, y2)]);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      if (!solid(x, y - 1)) edge(x, y, x + 1, y);
      if (!solid(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
      if (!solid(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
      if (!solid(x - 1, y)) edge(x, y + 1, x, y);
    }
  }

  const loops: Pt[][] = [];
  const unpack = (k: number): Pt => [(k % (w + 1)) - 1, ((k / (w + 1)) | 0) - 1];
  for (const start of [...next.keys()]) {
    while (next.get(start)?.length) {
      const loop: Pt[] = [];
      let k = start;
      do {
        loop.push(unpack(k));
        const list = next.get(k);
        if (!list?.length) break;
        k = list.pop()!;
      } while (k !== start);
      if (loop.length > 3) loops.push(loop);
    }
  }
  return { loops, w: w - 2, h: h - 2 };
}

/** Ramer–Douglas–Peucker on an open polyline; keeps both end points. */
function rdp(pts: Pt[], eps: number): Pt[] {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const go = (a: number, b: number) => {
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx >= 0 && max > eps) {
      keep[idx] = 1;
      go(a, idx);
      go(idx, b);
    }
  };
  go(0, pts.length - 1);
  return pts.filter((_, i) => keep[i]);
}

/** Simplify a closed loop: split it at its farthest point so the closing edge is handled too. */
function simplify(loop: Pt[], eps: number): Pt[] {
  let far = 0, best = 0;
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const first = rdp(loop.slice(0, far + 1), eps);
  const second = rdp([...loop.slice(far), loop[0]], eps);
  return [...first, ...second.slice(1, -1)];
}

/**
 * `src` is the print canvas (transparent where nothing is printed). Returns an SVG whose
 * size and viewBox match the print file, so the two line up when placed at the origin.
 */
export function cutPathSvg(src: HTMLCanvasElement, sizeIn: { width: number; height: number }, offsetIn: number) {
  const scale = Math.min(1, MAX_MASK / Math.max(src.width, src.height));
  const pxPerIn = (src.width * scale) / sizeIn.width;
  const { loops, w, h } = silhouette(src, scale, offsetIn * pxPerIn);
  const d = loops
    .map((l) => simplify(l, Math.max(1.5, pxPerIn * 0.006)))
    .filter((l) => l.length > 2)
    .map((l) => "M" + l.map(([x, y]) => `${+x.toFixed(1)} ${+y.toFixed(1)}`).join("L") + "Z")
    .join("");
  if (!d) return null;
  const fmt = (n: number) => +n.toFixed(4);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(sizeIn.width)}in" height="${fmt(sizeIn.height)}in" viewBox="0 0 ${w} ${h}">` +
    `<path id="CutContour" d="${d}" fill="none" stroke="#ff00ff" stroke-width="${fmt(pxPerIn * 0.01)}"/></svg>`
  );
}
