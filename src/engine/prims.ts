// Shared SVG primitives: palette, text measurement, pills, icons, iso boxes, defs (doc 05b §2.1, §3.0–3.1).
import { iconInner } from "../icons";
import { dirAttr } from "./locale";
import { clamp01, r2 } from "./math";
import { iso, roundedPolygon, roundedPolyline, type Pt } from "./projection";

export const INK = "#211e1b";
export const DROP = "#1c1a17";

export type PaletteKey = "orange" | "green" | "blue" | "yellow" | "purple" | "slab" | "store";
export const PALETTE: Record<PaletteKey, { top: [string, string]; side: [string, string] }> = {
  orange: { top: ["#fee6cc", "#fcd4ad"], side: ["#f9c697", "#f3b47f"] },
  green: { top: ["#e2f2d7", "#d1e9c2"], side: ["#c3e1b2", "#b3d79f"] },
  blue: { top: ["#dfebf9", "#cde0f5"], side: ["#bcd3ef", "#a9c5e8"] },
  yellow: { top: ["#fff3d6", "#fee7b8"], side: ["#fcdb9c", "#f6cd82"] },
  purple: { top: ["#f2eaf9", "#e6dbf4"], side: ["#d9cbef", "#cbbae6"] },
  slab: { top: ["#f7f0e7", "#f0e7dc"], side: ["#ece2d5", "#e3d7c8"] },
  store: { top: ["#f6f1fa", "#ece4f4"], side: ["#e2d8ee", "#d6c9e6"] },
};
export const paletteOf = (key: string) => PALETTE[key as PaletteKey] ?? PALETTE.blue;

export const TONES: Record<string, { bg: string; fg: string }> = {
  paper: { bg: "#fbf6ef", fg: INK },
  red: { bg: "#f8d5cf", fg: "#8f2a22" },
  green: { bg: "#dcefd2", fg: "#24521c" },
  amber: { bg: "#fbe5bd", fg: "#6d4a0c" },
  violet: { bg: "#e7ddf5", fg: "#47306f" },
  gray: { bg: "#ebe5dc", fg: "#5f5850" },
};

// ── Text measurement ────────────────────────────────────────────────────────
// oxlint-disable-next-line no-control-regex -- range intentionally starts at U+0000
const MONO_RANGE = /^[\u0000-\u058F\u1E00-\u1FFF\u2000-\u2BFF\u2E00-\u2E7F]*$/u;
const BIDI_MARKS = /[\u200e\u200f\u2066-\u2069]/g;
const measured = new Map<string, number>();
let ctx2d: CanvasRenderingContext2D | null = null;
let fontFamily = "";

if (typeof document !== "undefined" && document.fonts) {
  document.fonts.addEventListener("loadingdone", () => measured.clear());
}

/** Text width estimate: monospace 0.6em for Latin-ish text, canvas measurement otherwise. */
export function measureText(text: string | number, size: number): number {
  const s = String(text);
  if (MONO_RANGE.test(s) || typeof document === "undefined") return s.replace(BIDI_MARKS, "").length * size * 0.6;
  const key = `${size}|${s}`;
  let w = measured.get(key);
  if (w === undefined) {
    if (!ctx2d) {
      ctx2d = document.createElement("canvas").getContext("2d");
      fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--font").trim() || "monospace";
    }
    if (!ctx2d) return s.length * size * 0.6;
    ctx2d.font = `700 ${size}px ${fontFamily}`;
    w = ctx2d.measureText(s).width;
    measured.set(key, w);
  }
  return w;
}

// ── Text & icons ────────────────────────────────────────────────────────────
export const svgText = (x: number, y: number, text: string, size = 12.5, weight = 700, extra = ""): string =>
  `<text x="${r2(x)}" y="${r2(y)}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${INK}"${dirAttr(text)} ${extra}>${text}</text>`;

export interface IconAtOpts {
  stroke?: number;
  color?: string;
  fill?: string;
}

/** Lucide glyph centred at (cx, cy) inside diagram SVG; on-screen stroke equals `stroke`. */
export function iconAt(name: string, cx: number, cy: number, size = 22, { stroke = 1.9, color = "#1d1b19", fill = "none" }: IconAtOpts = {}): string {
  let inner: string;
  try {
    inner = iconInner(name);
  } catch {
    return "";
  }
  const k = size / 24;
  return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${k})" fill="${fill}" stroke="${color}" stroke-width="${stroke / k}" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
}

// ── Pills ───────────────────────────────────────────────────────────────────
export const lineHeight = (size: number): number => Math.round(size * 1.3);

export function pillMetrics(text: string, size: number): { lines: string[]; tw: number; h: number } {
  const lines = String(text).split("\n");
  return { lines, tw: Math.max(...lines.map((l) => measureText(l, size))), h: 21 + (lines.length - 1) * lineHeight(size) };
}

export interface PillOpts {
  tone?: string;
  size?: number;
  icon?: string | null;
}

export function pill(cx: number, cy: number, text: string, { tone = "paper", size = 10.5, icon = null }: PillOpts = {}): string {
  const t = TONES[tone] || TONES.paper;
  const iconW = icon ? 15 : 0;
  const { lines, tw, h } = pillMetrics(text, size);
  const w = tw + 18 + iconW;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const lh = lineHeight(size);
  const rows = lines
    .map(
      (line, i) =>
        `<text x="${r2(x + 9 + iconW + tw / 2)}" y="${r2(cy + size * 0.36 + (i - (lines.length - 1) / 2) * lh)}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${t.fg}"${dirAttr(line)}>${line}</text>`,
    )
    .join("");
  return `
    <g class="pill">
      <rect x="${r2(x)}" y="${r2(y + 2)}" width="${r2(w)}" height="${h}" rx="10.5" fill="${DROP}"/>
      <rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${h}" rx="10.5" fill="${t.bg}" stroke="${INK}" stroke-width="1.3"/>
      ${icon ? iconAt(icon, x + 15, cy, 12, { stroke: 2.2, color: t.fg }) : ""}
      ${rows}
    </g>`;
}

/** Half-width of the widest pill in an entity's pill stack (CPU pill counts as 43). */
export const pillHalfWidth = (e: { cpu?: number; tags?: { text: string; icon?: string }[] }): number =>
  Math.max(0, (e.cpu ?? -1) >= 0 ? 43 : 0, ...(e.tags || []).map((t) => (measureText(t.text, 10.5) + 18 + (t.icon ? 15 : 0)) / 2));

export const cpuColor = (v: number): string => (v < 0.6 ? "#7fc278" : v < 0.85 ? "#efb041" : "#e5534b");

export function cpuPill(cx: number, cy: number, v: number): string {
  const x = cx - 43;
  const y = cy - 21 / 2;
  const track = x + 23;
  return `
    <g class="pill">
      <rect x="${r2(x)}" y="${r2(y + 2)}" width="86" height="21" rx="10.5" fill="${DROP}"/>
      <rect x="${r2(x)}" y="${r2(y)}" width="86" height="21" rx="10.5" fill="#fbf6ef" stroke="${INK}" stroke-width="1.3"/>
      ${iconAt("cpu", x + 13, cy, 11, { stroke: 2.2, color: "#6f6961" })}
      <rect x="${r2(track)}" y="${r2(cy - 3.5)}" width="28" height="7" rx="3.5" fill="#e6ddd0"/>
      <rect x="${r2(track)}" y="${r2(cy - 3.5)}" width="${r2(Math.max(3, 28 * clamp01(v)))}" height="7" rx="3.5" fill="${cpuColor(v)}"/>
      <text x="${r2(x + 86 - 9)}" y="${r2(cy + 3.6)}" text-anchor="end" font-size="10.5" font-weight="800" fill="${INK}">${Math.round(clamp01(v) * 100)}%</text>
    </g>`;
}

// ── Iso boxes ───────────────────────────────────────────────────────────────
export interface IsoBox {
  T: Pt;
  R: Pt;
  B: Pt;
  L: Pt;
  Rd: Pt;
  Bd: Pt;
  Ld: Pt;
  ty: number;
  outline: Pt[];
  sil: string;
  top: string;
  sheen: string;
  right: string;
  bevel: string;
}

export function isoBox({ x0, x1, y0, y1, h, radius = 9 }: { x0: number; x1: number; y0: number; y1: number; h: number; radius?: number }): IsoBox {
  const T = iso(x0, y1, h);
  const R = iso(x1, y1, h);
  const B = iso(x1, y0, h);
  const L = iso(x0, y0, h);
  const Rd = iso(x1, y1, 0);
  const Bd = iso(x1, y0, 0);
  const Ld = iso(x0, y0, 0);
  const p = Math.max(1, Math.min(radius, h / 2 - 0.5));
  const ty = iso((x0 + x1) / 2, (y0 + y1) / 2, h)[1];
  const outline: Pt[] = [T, R, Rd, Bd, Ld, L];
  const topR = [radius + 1, p, 6, p];
  return {
    T, R, B, L, Rd, Bd, Ld, ty, outline,
    sil: roundedPolygon(outline, [radius + 1, p, p, radius + 3, p, p]),
    top: roundedPolygon([T, R, B, L], topR),
    sheen: roundedPolygon(
      [T, R, B, L].map(([x, y]): Pt => [x, y - 3 + (y - ty) * -0.25]),
      topR,
    ),
    right: roundedPolygon([B, R, Rd, Bd], [6, p, p, radius + 3]),
    bevel: roundedPolyline([L, B, R], 8),
  };
}

export function paintBox(g: IsoBox, color: string, { stroke = INK, sw = 1.9 }: { stroke?: string; sw?: number } = {}): string {
  return `
    <path d="${g.sil}" fill="url(#g-${color}-side)"/>
    <path d="${g.right}" fill="#3a2a14" opacity=".05"/>
    <path d="${g.top}" fill="url(#g-${color}-top)"/>
    <path d="${g.sheen}" fill="#fff" opacity=".22" filter="url(#blur-sm)"/>
    <path d="${g.bevel}" transform="translate(0 1.4)" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round"/>
    <path d="${g.bevel}" transform="translate(0 3.4)" fill="none" stroke="#5a4123" stroke-opacity=".07" stroke-width="2.4" stroke-linecap="round"/>
    <path d="${g.sil}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

/** Blurred ground shadow that stays on the floor while the body lifts. */
export function groundShadow(g: IsoBox, h: number, lift: number, op: number): string {
  const dy = Math.min(9, 3 + h * 0.15);
  const k = 1 - Math.min(1, lift / 140) * 0.85;
  return `<path d="${g.sil}" transform="translate(0 ${r2(dy + lift)})" fill="#6b5236" opacity="${r2(op * k)}" filter="url(#blur-lg)"/>`;
}

export interface Prism {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** Three visible faces (y0 "left", x1 "front", z1 "top") of a small cuboid, plus outline. */
export function paintPrism({ x0, x1, y0, y1, z0, z1 }: Prism, { top, front, left, sw = 1.5, r = 2 }: { top: string; front: string; left: string; sw?: number; r?: number }): string {
  const topF = [iso(x0, y0, z1), iso(x0, y1, z1), iso(x1, y1, z1), iso(x1, y0, z1)];
  const frontF = [iso(x1, y0, z1), iso(x1, y1, z1), iso(x1, y1, z0), iso(x1, y0, z0)];
  const leftF = [iso(x0, y0, z1), iso(x1, y0, z1), iso(x1, y0, z0), iso(x0, y0, z0)];
  const sil = [iso(x0, y0, z1), iso(x0, y1, z1), iso(x1, y1, z1), iso(x1, y1, z0), iso(x1, y0, z0), iso(x0, y0, z0)];
  return `
    <path d="${roundedPolygon(leftF, r)}" fill="${left}"/>
    <path d="${roundedPolygon(frontF, r)}" fill="${front}"/>
    <path d="${roundedPolygon(topF, r)}" fill="${top}"/>
    <path d="${roundedPolygon(sil, r)}" fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

/** Built-in block glyphs (not part of the icon set). */
export const GLYPHS: Record<string, (x: number, y: number, k?: number) => string> = {
  server: (x, y, k = 1) => `
    <g transform="translate(${r2(x)} ${r2(y)}) scale(${k})" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round">
      <rect x="-11" y="-10" width="22" height="8.5" rx="2.2"/>
      <rect x="-11" y="1.5" width="22" height="8.5" rx="2.2"/>
      <path d="M-6.5 -5.75h.01M-6.5 5.75h.01" stroke-width="2.6"/>
      <path d="M1 -5.75h5.5M1 5.75h5.5"/>
    </g>`,
  balancer: (x, y, k = 1) => `
    <g transform="translate(${r2(x)} ${r2(y)}) scale(${k})" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="-8" cy="0" r="3" fill="${INK}"/>
      <path d="M-5 0h4M-1 0 C 3 0 3 -8 8 -8M-1 0 C 3 0 3 8 8 8M-1 0h9"/>
      <path d="M5.5 -10.5l3 2.5-3 2.5M5.5 -2.5l3 2.5-3 2.5M5.5 5.5l3 2.5-3 2.5"/>
    </g>`,
};

// ── Defs ────────────────────────────────────────────────────────────────────
/** Theme-dependent defs (gradients, filters, markers, grid pattern) — pass through recolor() before use. */
export function themeDefs(): string {
  let grads = "";
  for (const [key, c] of Object.entries(PALETTE)) {
    grads += `
      <linearGradient id="g-${key}-top" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stop-color="${c.top[0]}"/><stop offset="1" stop-color="${c.top[1]}"/>
      </linearGradient>
      <linearGradient id="g-${key}-side" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.side[0]}"/><stop offset="1" stop-color="${c.side[1]}"/>
      </linearGradient>`;
  }
  const marker = (id: string, color: string) => `
    <marker id="${id}" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="5.2" markerHeight="5.2" orient="auto-start-reverse" markerUnits="strokeWidth">
      <path d="M1,1.2 L9,5 L1,8.8 Z" fill="${color}" stroke="${color}" stroke-width="1" stroke-linejoin="round"/>
    </marker>`;
  return `
    ${grads}
    <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#E3D6F3"/><stop offset="1" stop-color="#C9B5E6"/>
    </linearGradient>
    <linearGradient id="screen-glare" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="cyl-sheen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".3" stop-color="#fff" stop-opacity=".35"/>
      <stop offset=".55" stop-color="#fff" stop-opacity=".05"/>
      <stop offset="1" stop-color="#4b2f6b" stop-opacity=".08"/>
    </linearGradient>
    <filter id="blur-sm" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="blur-md" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="blur-lg" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6.5"/></filter>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
    ${marker("arrow", INK)}
    ${marker("arrow-muted", "#a59c90")}
    <pattern id="iso-grid" patternUnits="userSpaceOnUse" x="0" y="-7" width="28" height="14">
      <path d="M0 7 L14 0 L28 7 L14 14 Z" fill="none" stroke="#a8916f" stroke-opacity=".3" stroke-width=".8"/>
    </pattern>`;
}

export const GRID_DEFS = `
  <defs>
    <radialGradient id="grid-fade" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff"/>
      <stop offset=".42" stop-color="#fff" stop-opacity=".92"/>
      <stop offset=".78" stop-color="#fff" stop-opacity=".35"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="grid-mask" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000">
      <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#grid-fade)"/>
    </mask>
  </defs>`;
