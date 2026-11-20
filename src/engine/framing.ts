// Camera framing: scene layout bounds, HUD-card docking and per-step camera plans (doc 05b §2.2, doc 05 §5).
import type { PointRef, Scene } from "../types/lesson";
import { anchor, render, resolve, type Corner, type PanelP, type Props } from "./entities";
import { addObstacles, boxesIntersect, labelBox, labelCost, placeLabel, polyHitsRect, samplePolyline, wrapLabel, type Obstacles } from "./labels";
import { panelSize } from "./panel";
import { clipEnd, clipStart, iso, type Box, type Pt } from "./projection";

export interface Cam {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAX_ZOOM = 1.6;
export const MIN_ZOOM = 0.3;
export const FIT_MARGIN = 16;
export const HUD_SCALE_MAX = 1.16;
export const CARDS_MIN_WIDTH = 520;
const DOCK = { x: 10, top: 16, bottom: 10 };
const CARD_CLEAR = 12;
export const CORNERS: Corner[] = ["tr", "br", "tl", "bl"];

/** Docked card footprint in CSS px (height includes the 4 px drop shadow). */
export const cardFootprint = (size: { w: number; h: number }, scale: number) => ({ w: size.w * scale, h: (size.h + 4) * scale });

const POINT_RE = /^([\w-]+?)([+-][\d.]+)?$/;

/** Resolve a link point ("id", "id+1.5", [x|"id±k", y|"id±k"]) to world (x, y). */
export function resolvePoint(ref: PointRef, anchorOf: (id: string) => Pt): Pt {
  const pick = (s: string, axis: 0 | 1) => {
    const m = POINT_RE.exec(s);
    if (!m) throw new Error(`Bad link point: ${s}`);
    return anchorOf(m[1])[axis] + (m[2] ? parseFloat(m[2]) : 0);
  };
  if (typeof ref === "string") return [pick(ref, 0), pick(ref, 1)];
  return [typeof ref[0] === "string" ? pick(ref[0], 0) : ref[0], typeof ref[1] === "string" ? pick(ref[1], 1) : ref[1]];
}

export interface LabelPick {
  side: number;
  label: string;
  text: string;
}

export interface Layout {
  b: Box;
  boxes: Box[];
  polys: Pt[][];
  panel: { w: number; h: number } | null;
  picks: Record<string, LabelPick>;
}

export interface Viewport {
  width: number;
  height: number;
  hudScale: number;
  showCards: boolean;
}

/** Collect everything the camera must show, plus label picks for the scene's links. */
export function layoutOf(scene: Scene, vp: Viewport): Layout {
  const ents: Record<string, Props> = {};
  for (const [id, spec] of Object.entries(scene.entities)) ents[id] = resolve(spec);
  const anchorOf = (id: string): Pt => {
    const e = ents[id];
    if (!e) throw new Error(`Unknown entity in link: ${id}`);
    return anchor(e);
  };
  const boxes: Box[] = [];
  const obstacles: Obstacles = { polys: [], boxes: [] };
  const zonePolys: Pt[][] = [];
  let panel: Layout["panel"] = null;
  const polys: Record<string, Pt[] | null> = {};
  let b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (r: Box) => {
    b = [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])];
  };
  for (const [id, p] of Object.entries(ents)) {
    if (p.type === "panel") {
      if (!vp.showCards) continue;
      panel = cardFootprint(panelSize(p), vp.hudScale);
      continue;
    }
    const r = render(p);
    polys[id] = r.poly;
    grow(r.bounds);
    if (p.type === "zone" && r.poly) zonePolys.push(r.poly);
    else boxes.push(r.bounds);
    addObstacles(p, r.poly, r.bounds, obstacles);
  }
  const linePts: Pt[] = [];
  const labelled: { id: string; pts: Pt[]; t: number; label: string }[] = [];
  for (const [id, link] of Object.entries(scene.links || {})) {
    let pts: Pt[];
    try {
      pts = link.pts.map((ref) => {
        const [x, y] = resolvePoint(ref, anchorOf);
        return iso(x, y);
      });
    } catch {
      continue;
    }
    if (pts.length < 2) continue;
    pts = clipStart(pts, polys[link.from], 3);
    if (link.to) pts = clipEnd(pts, polys[link.to], link.heads === "none" ? 3 : 4);
    linePts.push(...samplePolyline(pts));
    if (link.label) labelled.push({ id, pts, t: link.labelAt ?? 0.5, label: link.label });
  }
  for (const [x, y] of linePts) {
    const r: Box = [x - 3, y - 3, x + 3, y + 3];
    boxes.push(r);
    grow(r);
  }
  const placed: Box[] = [];
  const picks: Record<string, LabelPick> = {};
  for (const l of labelled) {
    const variants = [{ text: l.label, extra: 0 }];
    const wrapped = labelBox(l.label).w > 70 && wrapLabel(l.label);
    if (wrapped) variants.push({ text: wrapped, extra: 14 });
    let best: { at: ReturnType<typeof placeLabel>; text: string } | null = null;
    for (const v of variants) {
      const { w, h } = labelBox(v.text);
      const at = placeLabel(l.pts, l.t, w, (r) => labelCost(r, obstacles, linePts, placed) + v.extra, -1, h);
      if (!best || at.cost < best.at.cost) best = { at, text: v.text };
    }
    if (!best) continue;
    const r = best.at.rect;
    picks[l.id] = { side: best.at.side, label: l.label, text: best.text };
    placed.push(r);
    boxes.push(r);
    grow([r[0] - 2, r[1] - 2, r[2] + 2, r[3] + 4]);
  }
  if (b[0] === Infinity) b = [-100, -60, 100, 60];
  return { b, boxes, polys: zonePolys, panel, picks };
}

/** Docked card rect in CSS px for a corner. */
export function dockRect(corner: Corner, size: { w: number; h: number }, vpW: number, vpH: number): Box {
  const x = corner[1] === "l" ? DOCK.x : vpW - DOCK.x - size.w;
  const y = corner[0] === "t" ? DOCK.top : vpH - DOCK.bottom - size.h;
  return [x, y, x + size.w, y + size.h];
}

function cardClear(layout: Layout, cam: Cam, corner: Corner, vp: Viewport): boolean {
  if (!layout.panel) return true;
  const k = vp.width / cam.w;
  const r = dockRect(corner, layout.panel, vp.width, vp.height);
  const world: Box = [cam.x + (r[0] - CARD_CLEAR) / k, cam.y + (r[1] - CARD_CLEAR) / k, cam.x + (r[2] + CARD_CLEAR) / k, cam.y + (r[3] + CARD_CLEAR) / k];
  return !layout.boxes.some((b) => boxesIntersect(b, world)) && !layout.polys.some((p) => polyHitsRect(p, world));
}

export interface Plan {
  cam: Cam;
  zoom: number;
  corner: Corner | null;
  dock: { x: number; y: number; corner: Corner } | null;
  picks: Record<string, LabelPick>;
}

/** Zoom quantised down to 0.05 steps, floored at MIN_ZOOM. */
export const quantizeZoom = (z: number): number => Math.max(MIN_ZOOM, Math.floor(z * 20 + 1e-6) / 20);

/** Plan the camera for a scene, reusing the previous step's camera when the content still fits. */
export function planFor(scene: Scene, prev: Plan | null, vp: Viewport): Plan {
  const layout = layoutOf(scene, vp);
  const W = Math.max(1, vp.width);
  const H = Math.max(1, vp.height);
  const [x0, y0, x1, y1] = layout.b;
  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);
  const camAt = (z: number, ax: number, ay: number): Cam => {
    const sx = ax === 0 ? (W - bw * z) / 2 : ax < 0 ? FIT_MARGIN : W - FIT_MARGIN - bw * z;
    const sy = ay === 0 ? (H - bh * z) / 2 : ay < 0 ? FIT_MARGIN : H - FIT_MARGIN - bh * z;
    return { x: x0 - sx / z, y: y0 - sy / z, w: W / z, h: H / z };
  };
  const fitZoom = Math.min(MAX_ZOOM, (W - 32) / bw, (H - 32) / bh);
  let choice: { zoom: number; ax: number; ay: number; corner: Corner | null; score?: number } | null = null;
  if (!layout.panel) choice = { zoom: quantizeZoom(fitZoom), ax: 0, ay: 0, corner: null };
  else {
    CORNERS.forEach((corner, ci) => {
      const awayX = corner[1] === "l" ? 1 : -1;
      const awayY = corner[0] === "t" ? 1 : -1;
      const aligns: Pt[] = [[0, 0], [awayX, 0], [0, awayY], [awayX, awayY]];
      let found: typeof choice = null;
      for (let z = quantizeZoom(fitZoom); z >= 0.299999 && !found; z = Math.round((z - 0.05) * 100) / 100) {
        for (const [ai, [ax, ay]] of aligns.entries()) {
          if (cardClear(layout, camAt(z, ax, ay), corner, vp)) {
            found = { zoom: z, ax, ay, corner, score: z - ai * 0.004 - ci * 0.001 + (prev && prev.corner === corner ? 0.045 : 0) };
            break;
          }
        }
      }
      if (found && (!choice || (found.score ?? 0) > (choice.score ?? 0))) choice = found;
    });
    choice ||= { zoom: quantizeZoom(fitZoom * 0.7), ax: -1, ay: 1, corner: "tr" };
  }
  let cam = camAt(choice.zoom, choice.ax, choice.ay);
  let corner = choice.corner;
  let zoom = choice.zoom;
  if (prev) {
    const same = Math.abs(prev.zoom - zoom) < 1e-6;
    const slightlyOut = prev.zoom < zoom && prev.zoom >= zoom * 0.9;
    if (same || slightlyOut) {
      const pc = prev.cam;
      const m = 12 / prev.zoom;
      const inside = x0 >= pc.x + m && y0 >= pc.y + m && x1 <= pc.x + pc.w - m && y1 <= pc.y + pc.h - m;
      const offX = Math.abs((x0 + x1) / 2 - (pc.x + pc.w / 2)) / pc.w;
      const offY = Math.abs((y0 + y1) / 2 - (pc.y + pc.h / 2)) / pc.h;
      const tol = same ? 0.12 : 0.18;
      if (inside && offX < tol && offY < tol) {
        const keep = layout.panel
          ? ([prev.corner, ...CORNERS].filter(Boolean) as Corner[]).find((c) => cardClear(layout, pc, c, vp))
          : null;
        if (!layout.panel || keep) {
          cam = pc;
          corner = layout.panel ? (keep ?? null) : null;
          zoom = prev.zoom;
        }
      }
    }
  }
  const dr = layout.panel && corner ? dockRect(corner, layout.panel, vp.width, vp.height) : null;
  return { cam, zoom, corner, dock: dr && corner ? { x: dr[0], y: dr[1], corner } : null, picks: layout.picks };
}

export type { PanelP };
