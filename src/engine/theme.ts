// Dark-theme recolor of generated SVG markup (doc 05b §7).
// Lower-case (or letterless) hex tokens are mapped; tokens containing upper-case A–F are left alone on purpose.

const EXACT: Record<string, string> = {
  "#1d1b18": "#efe6d6",
  "#211e1b": "#ece2d0",
  "#34302b": "#ddd3c2",
  "#1c1a17": "#050403",
  "#6b5236": "#000000",
  "#5a4123": "#000000",
  "#3a2a14": "#000000",
};
const EXACT_SVG: Record<string, string> = { "#ffffff": "#ffffff", "#e6ddd0": "#4d463c" };

const normalize = (hex: string): string => {
  const h = hex.replace("#", "").toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h}`;
};

interface Hsl {
  h: number;
  s: number;
  l: number;
  c: number;
}

export function hexToHsl(hex: string): Hsl {
  const v = parseInt(hex.slice(1), 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const c = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (c) {
    h = max === r ? ((g - b) / c) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = c ? c / (1 - Math.abs(2 * l - 1)) : 0;
  return { h, s, l, c };
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const ch = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v + m)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

const cache = { css: new Map<string, string>(), svg: new Map<string, string>() };

/** Map one light-theme colour to its dark equivalent. */
export function darkColor(hex: string, mode: "svg" | "css" = "svg"): string {
  const key = normalize(hex);
  const memo = cache[mode];
  const hit = memo.get(key);
  if (hit) return hit;
  let out = (mode === "svg" && EXACT_SVG[key]) || EXACT[key];
  if (!out) {
    const { h, s, l, c } = hexToHsl(key);
    if (c < 0.045 || (c < 0.13 && h >= 12 && h <= 62)) {
      const hue = c < 0.02 ? 34 : h;
      const n = l >= 0.885 ? 0.118 + (l - 0.92) * 0.9 : 1 - l;
      out = hslToHex(hue, n < 0.5 ? 0.13 : 0.12, Math.max(0.06, Math.min(0.93, n)));
    } else if (l >= 0.66) out = hslToHex(h, Math.min(s, 0.5) * 0.6, 0.16 + (l - 0.66) * 0.55);
    else if (l >= 0.36) out = key;
    else out = hslToHex(h, Math.min(s, 0.6), 0.8);
  }
  memo.set(key, out);
  return out;
}

export const isDark = (): boolean =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";

const HEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

/** Recolor an SVG string for the current theme (no-op in light mode). */
export function recolor(svg: string, dark = isDark()): string {
  if (!svg || !dark) return svg;
  return svg.replace(HEX, (tok) => {
    const body = tok.slice(1);
    return body === body.toLowerCase() || !/[A-F]/.test(body) ? darkColor(tok, "svg") : tok;
  });
}
