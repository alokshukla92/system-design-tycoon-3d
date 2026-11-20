// Entity renderers: props → { body, over, poly, bounds } (doc 05b §3).
import type { Block, Crowd, Db, Device, Entity, EntityType, Ghost, Panel, Queue, Ring, Tag, Zone } from "../types/lesson";
import { renderPanel } from "./panel";
import {
  GLYPHS, INK, cpuPill, groundShadow, iconAt, isoBox, measureText, paintBox, paintPrism, paletteOf, pill,
  pillHalfWidth, svgText,
} from "./prims";
import { clamp01, r2 } from "./math";
import { bboxOf, deckMatrix, floorMatrix, iso, roundedPolygon, wallMatrix, widenBox, type Box, type Pt } from "./projection";

/** Tween-only props written by the engine during morphs. */
export interface Fades {
  labelFade?: number;
  tagFade?: number;
}
export type Corner = "tr" | "br" | "tl" | "bl";
export interface CardExtras {
  boxW?: number;
  boxH?: number;
  fade?: number;
  sx?: number;
  sy?: number;
  corner?: Corner | null;
}
type Req<T, K extends keyof T> = T & { [P in K]-?: Exclude<T[P], undefined> } & Fades;

export type BlockP = Req<Block, "s" | "h" | "color" | "glyph" | "label" | "sub" | "heat" | "dead" | "dim" | "opacity" | "lift" | "cpu" | "tags" | "pills">;
export type CrowdP = Req<Crowd, "count" | "label" | "opacity" | "lift">;
export type GhostP = Req<Ghost, "s" | "h" | "opacity" | "label">;
export type DeviceP = Req<Device, "w" | "d" | "label" | "tags" | "opacity" | "lift">;
export type DbP = Req<Db, "r" | "h" | "glyph" | "label" | "tags" | "opacity" | "lift" | "heat" | "cpu">;
export type ZoneP = Req<Zone, "label" | "opacity">;
export type QueueP = Req<Queue, "n" | "gap" | "dir" | "opacity" | "color">;
export type PanelP = Req<Panel, "x" | "y" | "z" | "dx" | "dy" | "w" | "title" | "icon" | "lines" | "chart" | "bars" | "marker" | "opacity" | "lift"> & CardExtras;
export type RingP = Req<Ring, "r" | "nodes" | "keys" | "moved" | "opacity" | "label">;

export type Props = BlockP | CrowdP | GhostP | DeviceP | DbP | ZoneP | QueueP | PanelP | RingP;

export interface Rendered {
  body: string;
  over: string;
  poly: Pt[] | null;
  bounds: Box;
  size?: { w: number; h: number };
}

export const DEFAULTS: Record<EntityType, Record<string, unknown>> = {
  block: { s: 4, h: 46, color: "blue", glyph: "server", label: [], sub: "", heat: 0, dead: 0, dim: 0, opacity: 1, lift: 0, cpu: -1, tags: [], pills: "above" },
  crowd: { count: 0, label: "", opacity: 1, lift: 0 },
  ghost: { s: 6, h: 90, opacity: 1, label: "" },
  device: { w: 6, d: 6, label: "", tags: [], opacity: 1, lift: 0 },
  db: { r: 1.7, h: 38, glyph: "database", label: "", tags: [], opacity: 1, lift: 0, heat: 0, cpu: -1 },
  zone: { label: "", opacity: 1 },
  queue: { n: 0, gap: 1, dir: [0, -1], opacity: 1, color: "#efb041" },
  panel: { x: 0, y: 0, z: 0, dx: 0, dy: 0, w: 0, title: "", icon: "sparkles", lines: [], chart: null, bars: [], marker: 0, opacity: 1, lift: 0 },
  ring: { r: 10, nodes: [], keys: [], moved: [], opacity: 1, label: "" },
};

/** Merge an authored entity with its type defaults. */
export const resolve = (spec: Entity): Props => ({ ...DEFAULTS[spec.type], ...spec }) as Props;

const tagPill = (cx: number, t: Tag, fade: number | undefined) =>
  `<g opacity="${r2(fade ?? 1)}">${pill(cx, 0, t.text, { tone: t.tone, icon: t.icon })}</g>`;

// ── block ───────────────────────────────────────────────────────────────────
export function renderBlock(e: BlockP): Rendered {
  const half = e.s / 2;
  const g = isoBox({ x0: e.x - half, x1: e.x + half, y0: e.y - half, y1: e.y + half, h: e.h, radius: e.radius ?? 9 });
  const lift = e.lift;
  const cx = g.T[0];
  const ty = g.ty;
  const inner = 1 - e.dead * 0.5 - e.dim * 0.35;
  const label = e.label || [];
  const lb = ty + (e.s * 14 * 0.5 + e.h) * 0.4;
  let labels = "";
  if (label.length === 1 && !e.sub) labels = svgText(cx, lb + 4.5, label[0], 13.5, 800);
  else if (label.length === 1) labels = svgText(cx, lb, label[0], 13.5, 800) + svgText(cx, lb + 14, e.sub, 10, 600);
  else if (label.length && e.sub)
    labels = svgText(cx, lb - 9, label[0], 13, 800) + svgText(cx, lb + 6.5, label[1], 13, 800) + svgText(cx, lb + 20.5, e.sub, 10, 600);
  else if (label.length) labels = svgText(cx, lb - 3.5, label[0], 13, 800) + svgText(cx, lb + 12, label[1], 13, 800);

  const k = e.s >= 6 ? 1.15 : e.s < 3.5 ? 0.8 : 1;
  const builtin = GLYPHS[e.glyph];
  const glyph = builtin ? builtin(cx, label.length ? ty - 1 : ty + 2, k) : e.glyph ? iconAt(e.glyph, cx, ty - 1, 24, { stroke: 1.9 }) : "";
  const cross =
    e.dead > 0.01
      ? `<g opacity="${r2(e.dead)}" stroke="#c0392b" stroke-width="3.2" stroke-linecap="round">
         <path d="M${r2(cx - 9)},${r2(ty - 10)} L${r2(cx + 9)},${r2(ty + 8)} M${r2(cx + 9)},${r2(ty - 10)} L${r2(cx - 9)},${r2(ty + 8)}"/>
       </g>`
      : "";
  const body = `
    <g opacity="${r2(e.opacity)}">
      ${groundShadow(g, e.h, lift, 0.26)}
      <g transform="translate(0 ${r2(-lift)})">
        ${e.heat > 0.01 ? `<g class="pulse"><path d="${g.sil}" fill="#f0552f" opacity="${r2(e.heat * 0.7)}" filter="url(#glow)"/></g>` : ""}
        ${paintBox(g, e.color)}
        ${e.heat > 0.01 ? `<path d="${g.sil}" fill="#f0552f" opacity="${r2(e.heat * 0.3)}"/>` : ""}
        ${e.dead > 0.01 ? `<path d="${g.sil}" fill="#b9b2a8" opacity="${r2(e.dead * 0.62)}"/><path d="${g.sil}" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/>` : ""}
        ${e.dim > 0.01 ? `<path d="${g.sil}" fill="#f4ebe0" opacity="${r2(e.dim * 0.45)}"/>` : ""}
        <g opacity="${r2(inner)}">${e.dead > 0.5 ? "" : glyph}<g opacity="${r2(e.labelFade ?? 1)}">${labels}</g></g>
        ${cross}
      </g>
    </g>`;

  const below = e.pills === "below";
  let y = below ? g.Bd[1] - lift + 20 : g.T[1] - lift - 17;
  const stack: string[] = [];
  if (e.cpu >= 0) stack.push(cpuPill(cx, 0, e.cpu));
  for (const t of e.tags || []) stack.push(tagPill(cx, t, e.tagFade));
  let over = "";
  for (const p of stack) {
    over += `<g transform="translate(0 ${r2(y)})">${p}</g>`;
    y += below ? 26 : -26;
  }
  if (over) over = `<g opacity="${r2(e.opacity)}">${over}</g>`;
  return {
    body,
    over,
    poly: g.outline.map(([x, py]): Pt => [x, py - lift]),
    bounds: widenBox(
      bboxOf(g.outline, below ? [8, 8, 8, 14 + stack.length * 26] : [8, 8 + Math.max(stack.length, 1) * 26, 8, 14]),
      cx,
      pillHalfWidth(e),
    ),
  };
}

// ── crowd ───────────────────────────────────────────────────────────────────
const PERSON_COLORS = ["#F3B47F", "#A9C5E8", "#B3D79F", "#CBBAE6", "#F6CD82"];
const PERSON_GAP = 1.75;
export const jitter = (i: number, j: number): number => {
  const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

function person(x: number, y: number, z: number, a: number, color: string): string {
  const [px, py] = iso(x, y, z);
  const k = (0.35 + 0.65 * a) * 1.3;
  return `
    <g opacity="${r2(a)}" transform="translate(${r2(px)} ${r2(py - (1 - a) * 10)}) scale(${r2(k)})">
      <ellipse cx="0" cy="0" rx="5.6" ry="2.8" fill="#6b5236" opacity=".18"/>
      <path d="M-5.2,0 V-9 A5.2,5.2 0 0 1 5.2,-9 V0 A5.2,2.4 0 0 1 -5.2,0 Z" fill="${color}" stroke="${INK}" stroke-width="1.25"/>
      <circle cx="0" cy="-17.6" r="4.3" fill="#fdf6ec" stroke="${INK}" stroke-width="1.25"/>
    </g>`;
}

/** Grid cells of a crowd footprint in fill order (centre column outward, jittered). */
export function crowdSlots(x0: number, x1: number, y0: number, y1: number): { i: number; j: number; key: number }[] {
  const ni = Math.floor(((x1 - x0) / 2 - 0.85) / PERSON_GAP);
  const nj = Math.floor(((y1 - y0) / 2 - 0.85) / PERSON_GAP);
  const slots: { i: number; j: number; key: number }[] = [];
  for (let i = -ni; i <= ni; i++) for (let j = -nj; j <= nj; j++) slots.push({ i, j, key: Math.abs(i) + jitter(i, j) * 1.6 });
  return slots.sort((a, b) => a.key - b.key);
}

export function renderCrowd(e: CrowdP): Rendered {
  const g = isoBox({ x0: e.x0, x1: e.x1, y0: e.y0, y1: e.y1, h: 10, radius: 8 });
  const cx = (e.x0 + e.x1) / 2;
  const cy = (e.y0 + e.y1) / 2;
  const people = crowdSlots(e.x0, e.x1, e.y0, e.y1)
    .map((s, n) => ({ ...s, a: clamp01(e.count - n) }))
    .filter((s) => s.a > 0.01)
    .sort((a, b) => a.i - a.j - (b.i - b.j))
    .map((s) => person(cx + s.i * PERSON_GAP, cy + s.j * PERSON_GAP, 10, s.a, PERSON_COLORS[Math.abs(s.i * 3 + s.j * 7) % PERSON_COLORS.length]))
    .join("");
  const lift = e.lift;
  const body = `
    <g opacity="${r2(e.opacity)}">
      ${groundShadow(g, 10, lift, 0.2)}
      <g transform="translate(0 ${r2(-lift)})">
        ${paintBox(g, "slab", { stroke: "#3b3631", sw: 1.5 })}
        ${people}
      </g>
    </g>`;
  const [lx, ly] = iso(e.x1, e.y0, 0);
  return {
    body,
    over: e.label
      ? `<g opacity="${r2(e.opacity * (e.labelFade ?? 1))}" transform="translate(0 ${r2(-lift)})">${pill(lx, ly + 22, e.label, { icon: "users" })}</g>`
      : "",
    poly: g.outline.map(([x, y]): Pt => [x, y - lift]),
    bounds: bboxOf(g.outline, [8, 34, 8, 40]),
  };
}

// ── ghost ───────────────────────────────────────────────────────────────────
export function renderGhost(e: GhostP): Rendered {
  const x0 = e.x - e.s / 2;
  const x1 = e.x + e.s / 2;
  const y0 = e.y - e.s / 2;
  const y1 = e.y + e.s / 2;
  const edge = (a: Pt, b: Pt, hidden = false) =>
    `<path d="M${a[0]},${a[1]} L${b[0]},${b[1]}" stroke="${INK}" stroke-opacity="${hidden ? 0.22 : 0.55}" stroke-width="1.4" stroke-dasharray="5 4" fill="none"/>`;
  const top = [iso(x0, y0, e.h), iso(x0, y1, e.h), iso(x1, y1, e.h), iso(x1, y0, e.h)];
  const bot = [iso(x0, y0, 0), iso(x0, y1, 0), iso(x1, y1, 0), iso(x1, y0, 0)];
  const edges = [
    edge(top[0], top[1]), edge(top[1], top[2]), edge(top[2], top[3]), edge(top[3], top[0]),
    edge(bot[0], bot[3]), edge(bot[3], bot[2]),
    edge(top[0], bot[0]), edge(top[2], bot[2]), edge(top[3], bot[3]),
    edge(bot[0], bot[1], true), edge(bot[1], bot[2], true), edge(top[1], bot[1], true),
  ].join("");
  const [ax, ay] = top[2];
  const f = measureText(e.label, 10.5) + 33;
  return {
    body: `<g opacity="${r2(e.opacity)}">${edges}</g>`,
    over: e.label ? `<g opacity="${r2(e.opacity)}">${pill(ax + 14 + f / 2, ay + 18, e.label, { tone: "gray", icon: "alert" })}</g>` : "",
    poly: null,
    bounds: bboxOf([...top, ...bot, [ax + 22 + f, ay]], [8, 30, 8, 8]),
  };
}

// ── device ──────────────────────────────────────────────────────────────────
function devicePad(tags: Tag[] = [], cx: number, outline: Pt[]): [number, number, number, number] {
  const half = Math.max(0, ...tags.map((t) => (measureText(t.text, 10.5) + 18 + (t.icon ? 15 : 0)) / 2));
  const xs = outline.map((p) => p[0]);
  return [Math.max(8, Math.min(...xs) - (cx - half) + 8), 18 + tags.length * 26, Math.max(8, cx + half + 8 - Math.max(...xs)), 40];
}

const LID = { top: "#8B8580", front: "#3D3935", left: "#6E6862" };

function deviceOver(e: DeviceP, tagX: number, tagY: number, lift: number): string {
  const [lx, ly] = iso(e.x + e.d / 2, e.y - e.w / 2, 0);
  let over = e.label ? `<g opacity="${r2(e.labelFade ?? 1)}">${pill(lx, ly + 22, e.label, { icon: "user" })}</g>` : "";
  let y = tagY;
  for (const t of e.tags || []) {
    over += `<g transform="translate(0 ${r2(y)})" opacity="${r2(e.tagFade ?? 1)}">${pill(tagX, 0, t.text, { tone: t.tone, icon: t.icon })}</g>`;
    y -= 26;
  }
  return over ? `<g opacity="${r2(e.opacity)}" transform="translate(0 ${r2(-lift)})">${over}</g>` : "";
}

export function renderDevice(e: DeviceP): Rendered {
  const x0 = e.x - e.d / 2;
  const x1 = e.x + e.d / 2;
  const y0 = e.y - e.w / 2;
  const y1 = e.y + e.w / 2;
  const base = isoBox({ x0, x1, y0, y1, h: 16, radius: 9 });
  if (e.form === "phone") return renderPhone(e, base, 16);
  const lid = { x0: x0 + 0.7, x1: x0 + 1.05, y0: y0 + 0.9, y1: y1 - 0.9, z0: 19, z1: 66 };
  const deck = { x0: lid.x1, x1: lid.x1 + 2.7, y0: lid.y0, y1: lid.y1, z0: 16, z1: 19 };
  const c = (lid.y1 - lid.y0) * 14;
  const lidH = lid.z1 - lid.z0;
  const cols = Math.floor((c - 6) / 4.7);
  let keys = "";
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < cols; col++)
      keys += `<rect x="${r2(3 + col * 4.7)}" y="${r2(2.5 + row * 4.3)}" width="3.8" height="3.3" rx=".7"/>`;
  const f = c - 6.8;
  const p = lidH - 8;
  const screen = `
    <rect x="3.4" y="3.4" width="${r2(f)}" height="${r2(p)}" rx="1.5" fill="#FBF8F4"/>
    <rect x="3.4" y="3.4" width="${r2(f)}" height="7" rx="1.5" fill="#E4D9CB"/>
    <circle cx="6.6" cy="6.9" r="1" fill="#E5534B"/><circle cx="9.6" cy="6.9" r="1" fill="#EFB041"/><circle cx="12.6" cy="6.9" r="1" fill="#7FC278"/>
    <rect x="16" y="5" width="${r2(f - 16)}" height="3.8" rx="1.9" fill="#FBF8F4"/>
    <rect x="7" y="14.5" width="${r2(f - 7.2)}" height="12" rx="1.5" fill="url(#screen)"/>
    <rect x="7" y="29.5" width="${r2((f - 7.2) * 0.62)}" height="2.6" rx="1.3" fill="#D6CCBF"/>
    <rect x="7" y="34" width="${r2((f - 7.2) * 0.8)}" height="2.6" rx="1.3" fill="#D6CCBF"/>
    <rect x="3.4" y="3.4" width="${r2(f)}" height="${r2(p)}" rx="1.5" fill="url(#screen-glare)"/>`;
  const lift = e.lift;
  const contact = roundedPolygon(
    [iso(lid.x0 - 0.3, lid.y0 - 0.3, 16), iso(lid.x0 - 0.3, lid.y1 + 0.3, 16), iso(deck.x1 + 0.3, deck.y1 + 0.3, 16), iso(deck.x1 + 0.3, deck.y0 - 0.3, 16)],
    6,
  );
  const body = `
    <g opacity="${r2(e.opacity)}">
      ${groundShadow(base, 16, lift, 0.2)}
      <g transform="translate(0 ${r2(-lift)})">
        ${paintBox(base, "slab", { stroke: "#3b3631", sw: 1.5 })}
        <path d="${contact}" fill="#6b5236" opacity=".14" filter="url(#blur-sm)"/>
        ${paintPrism(deck, { top: "#efeae4", front: "#cfc8c0", left: "#ddd6ce", r: 2.5, sw: 1.4 })}
        <g transform="${deckMatrix(deck.x0 + 0.15, deck.y0, deck.z1)}" fill="#fbf8f4" stroke="#b9b1a7" stroke-width=".55">
          ${keys}
          <rect x="${r2(c / 2 - 10)}" y="21.5" width="20" height="9" rx="1.6"/>
        </g>
        ${paintPrism(lid, { ...LID, r: 3, sw: 1.5 })}
        <g transform="${wallMatrix(lid.x1, lid.y0, lid.z1)}">${screen}</g>
      </g>
    </g>`;
  const [tx, ty] = iso(lid.x0, (lid.y0 + lid.y1) / 2, lid.z1);
  return {
    body,
    over: deviceOver(e, tx, ty - 22, lift),
    poly: base.outline.map(([x, y]): Pt => [x, y - lift]),
    bounds: bboxOf([...base.outline, [tx, ty]], devicePad(e.tags, tx, base.outline)),
  };
}

function renderPhone(e: DeviceP, base: ReturnType<typeof isoBox>, z: number): Rendered {
  const b = { x0: e.x - 0.2, x1: e.x + 0.25, y0: e.y - 1.2, y1: e.y + 1.2, z0: z + 1, z1: z + 64 };
  const wpx = (b.y1 - b.y0) * 14;
  const hpx = b.z1 - b.z0;
  const o = wpx - 5;
  const screen = `
    <rect x="2.5" y="2.5" width="${r2(o)}" height="${r2(hpx - 5)}" rx="3.5" fill="#FBF8F4"/>
    <rect x="${r2(wpx / 2 - 4)}" y="3.6" width="8" height="2.2" rx="1.1" fill="#3D3935"/>
    <rect x="2.5" y="8" width="${r2(o)}" height="7" fill="#E4D9CB"/>
    <rect x="5" y="19" width="${r2(o * 0.62)}" height="7" rx="3" fill="#ECE6DC"/>
    <rect x="${r2(2.5 + o * 0.32)}" y="29" width="${r2(o * 0.6)}" height="7" rx="3" fill="#CBBAE6"/>
    <rect x="5" y="39" width="${r2(o * 0.5)}" height="7" rx="3" fill="#ECE6DC"/>
    <rect x="5" y="${r2(hpx - 12)}" width="${r2(o - 5)}" height="5" rx="2.5" fill="#E4D9CB"/>
    <rect x="2.5" y="2.5" width="${r2(o)}" height="${r2(hpx - 5)}" rx="3.5" fill="url(#screen-glare)"/>`;
  const lift = e.lift;
  const contact = roundedPolygon(
    [iso(b.x0 - 0.5, b.y0 - 0.3, z), iso(b.x0 - 0.5, b.y1 + 0.3, z), iso(b.x1 + 0.9, b.y1 + 0.3, z), iso(b.x1 + 0.9, b.y0 - 0.3, z)],
    5,
  );
  const body = `
    <g opacity="${r2(e.opacity)}">
      ${groundShadow(base, z, lift, 0.2)}
      <g transform="translate(0 ${r2(-lift)})">
        ${paintBox(base, "slab", { stroke: "#3b3631", sw: 1.5 })}
        <path d="${contact}" fill="#6b5236" opacity=".16" filter="url(#blur-sm)"/>
        ${paintPrism(b, { ...LID, r: 3.5, sw: 1.5 })}
        <g transform="${wallMatrix(b.x1, b.y0, b.z1)}">${screen}</g>
      </g>
    </g>`;
  const [tx, ty] = iso(b.x0, e.y, b.z1);
  return {
    body,
    over: deviceOver(e, tx, ty - 20, lift),
    poly: base.outline.map(([x, y]): Pt => [x, y - lift]),
    bounds: bboxOf([...base.outline, [tx, ty]], devicePad(e.tags, tx, base.outline)),
  };
}

// ── db ──────────────────────────────────────────────────────────────────────
export function dbFill(v: number): [string, string] {
  return v < 0.6 ? ["#cfe8c0", "#5fa95a"] : v < 0.85 ? ["#f9dca3", "#d99a2b"] : ["#f5bdb2", "#d9473d"];
}

export function renderDb(e: DbP): Rendered {
  const t = Math.SQRT2 * 14 * e.r;
  const ry = t / 2;
  const [cx, gy] = iso(e.x, e.y, 0);
  const lift = e.lift;
  const bY = gy - lift;
  const tY = bY - e.h;
  const side = `M${r2(cx - t)},${r2(tY)} V${r2(bY)} A${r2(t)},${r2(ry)} 0 0 0 ${r2(cx + t)},${r2(bY)} V${r2(tY)} Z`;
  const sideOpen = `M${r2(cx - t)},${r2(tY)} V${r2(bY)} A${r2(t)},${r2(ry)} 0 0 0 ${r2(cx + t)},${r2(bY)} V${r2(tY)}`;
  const shadowK = 1 - Math.min(1, lift / 140) * 0.85;
  const v = e.cpu >= 0 ? clamp01(e.cpu) : 0;
  let level = "";
  if (v > 0.004) {
    const lv = bY - v * e.h;
    const [fill, line] = dbFill(e.cpu);
    const shape = `M${r2(cx - t)},${r2(lv)} A${r2(t)},${r2(ry)} 0 0 0 ${r2(cx + t)},${r2(lv)} V${r2(bY)} A${r2(t)},${r2(ry)} 0 0 1 ${r2(cx - t)},${r2(bY)} Z`;
    const meniscus = `M${r2(cx - t + 1)},${r2(lv)} A${r2(t - 1)},${r2(ry - 0.5)} 0 0 0 ${r2(cx + t - 1)},${r2(lv)}`;
    level = `
      <path d="${shape}" fill="${fill}" opacity=".92"/>
      ${v < 0.995 ? `<path d="${meniscus}" fill="none" stroke="${line}" stroke-width="1.6" stroke-linecap="round"/>` : ""}`;
  }
  const body = `
    <g opacity="${r2(e.opacity)}">
      <ellipse cx="${r2(cx)}" cy="${r2(gy + 5)}" rx="${r2(t + 3)}" ry="${r2(ry + 1)}" fill="#6b5236" opacity="${r2(0.22 * shadowK)}" filter="url(#blur-md)"/>
      ${e.heat > 0.01 ? `<g class="pulse"><path d="${side}" fill="#f0552f" opacity="${r2(e.heat * 0.7)}" filter="url(#glow)"/></g>` : ""}
      <path d="${side}" fill="url(#g-purple-side)"/>
      ${level}
      <path d="${side}" fill="url(#cyl-sheen)"/>
      <ellipse cx="${r2(cx)}" cy="${r2(tY)}" rx="${r2(t)}" ry="${r2(ry)}" fill="url(#g-purple-top)"/>
      <path d="M${r2(cx - t + 3)},${r2(tY + 2.5)} A${r2(t - 3)},${r2(ry - 2)} 0 0 0 ${r2(cx + t - 3)},${r2(tY + 2.5)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/>
      <path d="${sideOpen}" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/>
      <ellipse cx="${r2(cx)}" cy="${r2(tY)}" rx="${r2(t)}" ry="${r2(ry)}" fill="none" stroke="${INK}" stroke-width="1.9"/>
      ${iconAt(e.glyph, cx, tY + ry + e.h / 2, 19, { stroke: 1.8 })}
    </g>`;
  const labelW = measureText(e.label || "", 10.5) + 33;
  let over = e.label ? `<g opacity="${r2(e.labelFade ?? 1)}">${pill(cx + t + 10 + labelW / 2, bY - e.h * 0.35, e.label, { icon: "database" })}</g>` : "";
  const stack: string[] = [];
  if (e.cpu >= 0) stack.push(cpuPill(cx, 0, e.cpu));
  for (const tag of e.tags || []) stack.push(tagPill(cx, tag, e.tagFade));
  let y = tY - ry - 15;
  for (const p of stack) {
    over += `<g transform="translate(0 ${r2(y)})">${p}</g>`;
    y -= 26;
  }
  if (over) over = `<g opacity="${r2(e.opacity)}">${over}</g>`;
  const poly: Pt[] = [];
  for (let i = 0; i <= 8; i++) poly.push([cx - t * Math.cos((Math.PI * i) / 8), tY - ry * Math.sin((Math.PI * i) / 8)]);
  for (let i = 0; i <= 8; i++) poly.push([cx + t * Math.cos((Math.PI * i) / 8), bY + ry * Math.sin((Math.PI * i) / 8)]);
  return {
    body,
    over,
    poly,
    bounds: widenBox([cx - t - 8, tY - ry - 12 - stack.length * 26, cx + t + (e.label ? labelW + 18 : 8), bY + ry + 10], cx, pillHalfWidth(e)),
  };
}

// ── zone ────────────────────────────────────────────────────────────────────
export function renderZone(e: ZoneP): Rendered {
  const quad = [iso(e.x0, e.y0), iso(e.x0, e.y1), iso(e.x1, e.y1), iso(e.x1, e.y0)];
  const label = e.label
    ? `<text transform="${floorMatrix(e.x0 + 0.9, e.y0 + 0.55, 0)}" font-size="10.5" font-weight="800" letter-spacing="1.6" fill="#6f6961">${e.label}</text>`
    : "";
  return {
    body: `
      <g opacity="${r2(e.opacity)}">
        <path d="${roundedPolygon(quad, 8)}" fill="#fffaf2" fill-opacity=".55" stroke="${INK}" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="6 5"/>
        ${label}
      </g>`,
    over: "",
    poly: quad,
    bounds: bboxOf(quad, [6, 6, 6, 6]),
  };
}

// ── queue ───────────────────────────────────────────────────────────────────
export function renderQueue(e: QueueP): Rendered {
  let body = "";
  const pts: Pt[] = [];
  for (let i = Math.ceil(e.n) - 1; i >= 0; i--) {
    const a = clamp01(e.n - i);
    const [px, py] = iso(e.x + e.dir[0] * e.gap * i, e.y + e.dir[1] * e.gap * i, 0);
    pts.push([px, py]);
    body += `<g opacity="${r2(a * e.opacity)}" transform="translate(${r2(px)} ${r2(py - (1 - a) * 8)}) scale(${r2(0.5 + a * 0.5)})">
      <circle r="4.6" fill="${e.color}" stroke="${INK}" stroke-width="1.5"/></g>`;
  }
  return { body, over: "", poly: null, bounds: pts.length ? bboxOf(pts, [8, 8, 8, 8]) : [0, 0, 0, 0] };
}

// ── ring ────────────────────────────────────────────────────────────────────
type RingNode = RingP["nodes"][number];
/** Owner of a key on the ring: the node with the largest angle ≤ key, wrapping to the last node. */
export function ringOwner(key: number, nodes: RingNode[]): RingNode {
  const sorted = [...nodes].sort((a, b) => a.a - b.a);
  let owner = sorted[sorted.length - 1];
  for (const n of sorted) if (n.a <= key) owner = n;
  return owner;
}

export function renderRing(e: RingP): Rendered {
  const at = (deg: number, rad = e.r): Pt => {
    const a = (deg * Math.PI) / 180;
    return iso(e.x + rad * Math.cos(a), e.y + rad * Math.sin(a), 0);
  };
  const arc = (from: number, to: number, rad = e.r) => {
    let d = "";
    const steps = Math.max(2, Math.ceil(Math.abs(to - from) / 3));
    for (let i = 0; i <= steps; i++) {
      const [x, y] = at(from + ((to - from) * i) / steps, rad);
      d += `${i ? "L" : "M"}${r2(x)},${r2(y)} `;
    }
    return d;
  };
  const nodes = [...e.nodes].sort((a, b) => a.a - b.a);
  let arcs = "";
  nodes.forEach((n, i) => {
    const next = nodes[(i + 1) % nodes.length];
    const end = next.a > n.a ? next.a : next.a + 360;
    arcs += `<path d="${arc(n.a, end)}" fill="none" stroke="${paletteOf(n.color).side[1]}" stroke-width="10" stroke-opacity=".55"/>`;
  });
  let chevrons = "";
  for (let deg = 22; deg < 360; deg += 60) {
    const [px, py] = at(deg + 2.5, e.r + 1.4);
    const [x, y] = at(deg, e.r + 1.4);
    const rot = (Math.atan2(y - py, x - px) * 180) / Math.PI;
    chevrons += `<path d="M-4,-3.5 L1,0 L-4,3.5" transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(rot)})" fill="none" stroke="#a59c90" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const marks = nodes
    .filter((n) => n.mark)
    .map((n) => {
      const [x, y] = at(n.a);
      return `<path d="M${r2(x)},${r2(y - 6)} L${r2(x + 9)},${r2(y)} L${r2(x)},${r2(y + 6)} L${r2(x - 9)},${r2(y)} Z" fill="${paletteOf(n.color).top[1]}" stroke="${INK}" stroke-width="1.4"/>`;
    })
    .join("");
  const moved = new Set(e.moved || []);
  const keys = (e.keys || [])
    .map((k) => {
      const [x, y] = at(k);
      const fill = nodes.length ? paletteOf(ringOwner(k, nodes).color).side[0] : "#fbf6ef";
      return `${moved.has(k) ? `<circle class="moved" cx="${r2(x)}" cy="${r2(y)}" r="9" fill="none" stroke="#e5534b" stroke-width="2"/>` : ""}
        <circle cx="${r2(x)}" cy="${r2(y)}" r="4.6" fill="${fill}" stroke="${INK}" stroke-width="1.4"/>`;
    })
    .join("");
  const [lx, ly] = at(135, e.r + 2.2);
  const body = `
    <g opacity="${r2(e.opacity)}">
      <path d="${arc(0, 360, e.r + 0.9)}" fill="none" stroke="#e8ddcf" stroke-width="1"/>
      <path d="${arc(0, 360)}" fill="#fffaf2" fill-opacity=".35" stroke="${INK}" stroke-opacity=".55" stroke-width="1.5"/>
      ${arcs}
      ${chevrons}
      ${marks}
      ${keys}
    </g>`;
  const outline: Pt[] = [];
  for (let deg = 0; deg < 360; deg += 15) outline.push(at(deg, e.r + 1.6));
  return {
    body,
    over: e.label ? `<g opacity="${r2(e.opacity)}">${pill(lx, ly - 12, e.label, { tone: "gray", icon: "replay" })}</g>` : "",
    poly: null,
    bounds: bboxOf(outline, [10, 34, 10, 10]),
  };
}

// ── dispatch & geometry keys ────────────────────────────────────────────────
export function render(p: Props): Rendered {
  switch (p.type) {
    case "block": return renderBlock(p);
    case "crowd": return renderCrowd(p);
    case "ghost": return renderGhost(p);
    case "device": return renderDevice(p);
    case "db": return renderDb(p);
    case "zone": return renderZone(p);
    case "queue": return renderQueue(p);
    case "panel": return renderPanel(p);
    case "ring": return renderRing(p);
  }
}

/** Ground footprint [x0, x1, y0, y1] in world units (used by spotlights). */
export function footprint(p: Props): [number, number, number, number] {
  if (p.type === "crowd" || p.type === "zone") return [p.x0, p.x1, p.y0, p.y1];
  if (p.type === "device") return [p.x - p.d / 2, p.x + p.d / 2, p.y - p.w / 2, p.y + p.w / 2];
  if (p.type === "db" || p.type === "ring") return [p.x - p.r, p.x + p.r, p.y - p.r, p.y + p.r];
  const s = ("s" in p && p.s ? p.s : 4) / 2;
  const x = p.x ?? 0;
  const y = p.y ?? 0;
  return [x - s, x + s, y - s, y + s];
}

/** World anchor used by link endpoints. */
export function anchor(p: Props): Pt {
  return p.type === "crowd" || p.type === "zone" ? [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2] : [p.x ?? 0, p.y ?? 0];
}

/** Painter's-order key: smaller paints first (further back). */
export function depthKey(p: Props): number {
  if (p.type === "zone" || p.type === "ring") return -1e4;
  if (p.type === "queue") return -1e3;
  if (p.type === "panel") return 1e4;
  const [x, y] = anchor(p);
  return x - y - (p.type === "ghost" ? 0.5 : 0);
}

/** Types rendered in the floor layer (never depth-sorted). */
export const FLOOR_TYPES = new Set<EntityType>(["zone", "ring"]);
