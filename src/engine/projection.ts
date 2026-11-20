// Isometric projection and 2-D geometry helpers (doc 05b §1).
import { r2 } from "./math";

export type Pt = [number, number];
/** Axis-aligned box [minX, minY, maxX, maxY]. */
export type Box = [number, number, number, number];

/** World (x, y, z) → screen. x/y are grid units, z is screen px. */
export const iso = (x: number, y: number, z = 0): Pt => [r2(14 * (x + y)), r2(7 * (x - y) - z)];

/** Vertical plane facing +x (local +X along world +y, local +Y down). */
export const wallMatrix = (x: number, y: number, z: number): string => {
  const [tx, ty] = iso(x, y, z);
  return `matrix(1 -0.5 0 1 ${tx} ${ty})`;
};

/** Floor plane, local +X along world +x. */
export const floorMatrix = (x: number, y: number, z: number): string => {
  const [tx, ty] = iso(x, y, z);
  return `matrix(1 0.5 -1 0.5 ${tx} ${ty})`;
};

/** Floor/top plane, local +X along world +y, local +Y along world +x. */
export const deckMatrix = (x: number, y: number, z: number): string => {
  const [tx, ty] = iso(x, y, z);
  return `matrix(1 -0.5 1 0.5 ${tx} ${ty})`;
};

const toward = (from: Pt, to: Pt, dist: number): Pt => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const f = Math.min(dist, len / 2) / len;
  return [from[0] + dx * f, from[1] + dy * f];
};

/** Closed polygon with quadratic-rounded corners; `r` may be per-vertex. */
export function roundedPolygon(pts: Pt[], r: number | number[]): string {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const ri = Array.isArray(r) ? r[i] : r;
    const a = toward(cur, prev, ri);
    const b = toward(cur, next, ri);
    d += `${i === 0 ? "M" : "L"}${r2(a[0])},${r2(a[1])} Q${r2(cur[0])},${r2(cur[1])} ${r2(b[0])},${r2(b[1])} `;
  }
  return d + "Z";
}

/** Open polyline with rounded interior corners. */
export function roundedPolyline(pts: Pt[], r = 10): string {
  let d = `M${r2(pts[0][0])},${r2(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const a = Math.hypot(cx - px, cy - py);
    const b = Math.hypot(nx - cx, ny - cy);
    if (a < 0.01 || b < 0.01) continue;
    const f = Math.min(r, a / 2, b / 2);
    d += ` L${r2(cx + ((px - cx) / a) * f)},${r2(cy + ((py - cy) / a) * f)} Q${r2(cx)},${r2(cy)} ${r2(cx + ((nx - cx) / b) * f)},${r2(cy + ((ny - cy) / b) * f)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${r2(last[0])},${r2(last[1])}`;
}

/** Point inside a convex polygon: all non-zero cross products share a sign. */
export function insideConvex([x, y]: Pt, poly: Pt[]): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

/** If the polyline starts inside `poly`, move its start to `inset` px past the boundary. */
export function clipStart(pts: Pt[], poly: Pt[] | null | undefined, inset: number): Pt[] {
  if (!poly || !insideConvex(pts[0], poly)) return pts;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (insideConvex(b, poly)) continue;
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 30; k++) {
      const m = (lo + hi) / 2;
      if (insideConvex([a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m], poly)) lo = m;
      else hi = m;
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = Math.min(1, hi + inset / len);
    return [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ...pts.slice(i + 1)];
  }
  return pts;
}

export const clipEnd = (pts: Pt[], poly: Pt[] | null | undefined, inset: number): Pt[] =>
  clipStart([...pts].reverse(), poly, inset).reverse();

/** AABB of points with padding [left, top, right, bottom]. */
export function bboxOf(pts: Pt[], pad: [number, number, number, number] = [0, 0, 0, 0]): Box {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs) - pad[0], Math.min(...ys) - pad[1], Math.max(...xs) + pad[2], Math.max(...ys) + pad[3]];
}

/** Widen a box horizontally to cover cx ± (half + 5) (pill stacks). */
export const widenBox = (b: Box, cx: number, half: number): Box =>
  half ? [Math.min(b[0], cx - half - 5), b[1], Math.max(b[2], cx + half + 5), b[3]] : b;
