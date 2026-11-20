// Link-label placement optimiser and collision geometry (doc 05b §4.6).
import { getLocale } from "./locale";
import type { Props } from "./entities";
import { measureText, pillMetrics } from "./prims";
import type { Box, Pt } from "./projection";

export const LABEL_SIZE = 9.5;
const MARGIN = 7;
const PILL_H = 21;

/** Overlap area of two boxes. */
export const overlapArea = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

export const boxesIntersect = (a: Box, b: Box): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/** Even-odd point-in-polygon (works for concave polys). */
export function pointInPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const orient = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);
}

/** Does a polygon touch a rectangle (vertex inside, corner inside, or edge crossing)? */
export function polyHitsRect(poly: Pt[], r: Box): boolean {
  if (poly.some(([x, y]) => x > r[0] && x < r[2] && y > r[1] && y < r[3])) return true;
  const corners: Pt[] = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
  if (corners.some(([x, y]) => pointInPoly(x, y, poly))) return true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    for (let k = 0; k < 4; k++) if (segmentsCross(a, b, corners[k], corners[(k + 1) % 4])) return true;
  }
  return false;
}

/** Point and unit tangent at arc-length fraction `t` of a polyline. */
export function pointAlong(pts: Pt[], t: number): { x: number; y: number; dx: number; dy: number } {
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    lens.push(l);
    total += l;
  }
  let rest = total * t;
  for (let i = 0; i < lens.length; i++) {
    if (rest <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, rest / lens[i]) : 0;
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, dx: (bx - ax) / (lens[i] || 1), dy: (by - ay) / (lens[i] || 1) };
    }
    rest -= lens[i];
  }
  return { x: pts[0][0], y: pts[0][1], dx: 1, dy: 0 };
}

/** Sample points roughly every `step` px along a polyline. */
export function samplePolyline(pts: Pt[], step = 12): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

export interface Placement {
  side: number;
  rect: Box;
  cx: number;
  cy: number;
  cost: number;
}

const OFFSETS = [0, -0.1, 0.1, -0.2, 0.2, -0.3, 0.3, -0.4, 0.4];

/**
 * Choose a label rect around the polyline near fraction `t`.
 * With `fixedSide >= 0` only that candidate id is produced (cost 0) — used at runtime to follow the live path.
 */
export function placeLabel(pts: Pt[], t: number, w: number, cost: (r: Box) => number, fixedSide = -1, h = PILL_H): Placement {
  const m = MARGIN;
  const cands: { id: number; rect: Box; cost: number }[] = [];
  OFFSETS.forEach((delta, c) => {
    const u = t + delta;
    if (c && (u < 0.12 || u > 0.88)) return;
    const { x, y, dx, dy } = pointAlong(pts, u);
    const near: Pt[] =
      Math.abs(dy) < 0.12
        ? [[0, -(h / 2 + m + 3)], [0, h / 2 + m + 3]]
        : Math.abs(dx) < 0.12
          ? [[w / 2 + m + 3, 0], [-(w / 2 + m + 3), 0]]
          : dx * dy > 0
            ? [[w / 2 + m, -(h / 2 + m)], [-(w / 2 + m), h / 2 + m]]
            : [[-(w / 2 + m), -(h / 2 + m)], [w / 2 + m, h / 2 + m]];
    const far = near.map(([ox, oy]): Pt => (oy ? [ox, oy + Math.sign(oy) * (h + 9)] : [ox + Math.sign(ox) * 26, oy]));
    [...near, ...far].forEach(([ox, oy], o) => {
      const id = c * 4 + o;
      if (fixedSide >= 0 && fixedSide !== id) return;
      const rect: Box = [x + ox - w / 2, y + oy - h / 2, x + ox + w / 2, y + oy + h / 2];
      cands.push({
        id,
        rect,
        cost: fixedSide < 0 ? cost(rect) + Math.abs(delta) * 90 + (o % 2) * 2 + (o > 1 ? 22 : 0) : 0,
      });
    });
  });
  if (!cands.length) return placeLabel(pts, t, w, cost, -1, h);
  const best = cands.reduce((a, b) => (b.cost < a.cost ? b : a));
  const r = best.rect;
  return { side: best.id, rect: r, cx: (r[0] + r[2]) / 2, cy: (r[1] + r[3]) / 2, cost: best.cost };
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
let segmenter: { lang: string; seg: Intl.Segmenter } | null = null;

function wordStarts(s: string): Set<number> | null {
  if (typeof Intl.Segmenter !== "function") return null;
  const lang = getLocale().lang();
  if (!segmenter || segmenter.lang !== lang) segmenter = { lang, seg: new Intl.Segmenter(lang, { granularity: "word" }) };
  return new Set([...segmenter.seg.segment(s)].map((x) => x.index));
}

/** Best two-line split of a label (minimising the wider line), or null. */
export function wrapLabel(text: string): string | null {
  if (text.includes("\n")) return null;
  const chars = [...text];
  const starts = CJK.test(text) ? wordStarts(text) : null;
  let isolate = 0;
  let best: { w: number; text: string } | null = null;
  let offset = chars[0]?.length ?? 0;
  for (let i = 1; i < chars.length - 1; offset += chars[i].length, i++) {
    const ch = chars[i];
    if (ch >= "\u2066" && ch <= "\u2068") isolate++;
    else if (ch === "\u2069") isolate = Math.max(0, isolate - 1);
    if (isolate) continue;
    let a: string;
    let b: string;
    if (ch === " ") [a, b] = [chars.slice(0, i).join(""), chars.slice(i + 1).join("")];
    else if (CJK.test(ch) && CJK.test(chars[i - 1]) && (!starts || starts.has(offset))) [a, b] = [chars.slice(0, i).join(""), chars.slice(i).join("")];
    else continue;
    a = a.trimEnd();
    b = b.trimStart();
    if (!a || !b || /^[·→←:;,.!?)»”’%]/.test(b) || /[(«“‘]$/.test(a)) continue;
    const w = Math.max(measureText(a, LABEL_SIZE), measureText(b, LABEL_SIZE));
    if (!best || w < best.w) best = { w, text: `${a}\n${b}` };
  }
  return best && best.text;
}

/** Link-label pill box size. */
export function labelBox(text: string): { w: number; h: number } {
  const { tw, h } = pillMetrics(text, LABEL_SIZE);
  return { w: tw + 18, h };
}

export interface Obstacles {
  polys: Pt[][];
  boxes: Box[];
}

/** Register an entity's silhouette and pill areas as label obstacles. */
export function addObstacles(p: Props, poly: Pt[] | null, bounds: Box | null, out: Obstacles): void {
  if (!bounds || p.type === "zone" || p.type === "panel") return;
  if (!poly || poly.length < 3) {
    out.boxes.push(bounds);
    return;
  }
  out.polys.push(poly);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const cpu = "cpu" in p ? (p.cpu ?? -1) : -1;
  const tags = "tags" in p && p.tags ? p.tags.length : 0;
  const pills = +(cpu >= 0) + tags;
  const below = p.type === "block" && p.pills === "below";
  if (pills && !below) out.boxes.push([bounds[0], bounds[1], bounds[2], minY + 4]);
  if ((pills && below) || ((p.type === "crowd" || p.type === "device") && p.label)) out.boxes.push([bounds[0], maxY - 4, bounds[2], bounds[3]]);
  if (p.type === "db" && p.label) out.boxes.push([maxX - 4, minY, bounds[2], maxY]);
}

/** Collision cost of a candidate label rect. */
export function labelCost(r: Box, obs: Obstacles, linePts: Pt[], placed: Box[] = []): number {
  let cost = 0;
  for (const poly of obs.polys) if (polyHitsRect(poly, r)) cost += 170;
  for (const b of obs.boxes) {
    const a = overlapArea(r, b);
    if (a) cost += 90 + a / 6;
  }
  for (const b of placed) {
    const a = overlapArea([r[0] - 4, r[1] - 4, r[2] + 4, r[3] + 4], b);
    if (a) cost += 90 + a / 3;
  }
  const inf: Box = [r[0] - 5, r[1] - 5, r[2] + 5, r[3] + 5];
  for (const [x, y] of linePts) if (x > inf[0] && x < inf[2] && y > inf[1] && y < inf[3]) cost += 18;
  return cost;
}
