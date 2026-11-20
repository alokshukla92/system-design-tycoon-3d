// HUD panel card renderer (doc 05b §6). Rendered in screen-pixel space inside layer-hud.
import type { PanelBar } from "../types/lesson";
import type { PanelP, Rendered } from "./entities";
import { getLocale, textDir, upper } from "./locale";
import { r2 } from "./math";
import { DROP, INK, iconAt, measureText } from "./prims";
import { iso } from "./projection";

const escapeText = (s: string) => s.replace(/&(?![a-z#0-9]+;)/g, "&amp;").replace(/</g, "&lt;");
const richText = (s: string) =>
  escapeText(s)
    .split("**")
    .map((part, i) => (i % 2 ? `<tspan font-weight="800" fill="${INK}">${part}</tspan>` : part))
    .join("");

/** Latency curve of the hockey-stick chart: flat until ~80 % utilisation, then explodes. */
export const hockeyCurve = (t: number): number => Math.min(1, 0.06 / Math.max(0.02, 1 - t));

const markerColor = (v: number) => (v >= 0.85 ? "#e5534b" : v >= 0.6 ? "#efb041" : "#7fc278");

function hockey(x: number, y: number, w: number, h: number, marker: number): string {
  const sx = (t: number) => x + t * w;
  const sy = (v: number) => y + h - v * h;
  let curve = "";
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * 0.985;
    curve += `${i ? "L" : "M"}${r2(sx(t))},${r2(sy(hockeyCurve(t)))} `;
  }
  const mt = Math.min(0.985, marker);
  const mx = sx(mt);
  const my = sy(hockeyCurve(mt));
  const col = markerColor(marker);
  const { t } = getLocale();
  return `
    <path d="M${r2(x)},${r2(y)} V${r2(y + h)} H${r2(x + w)}" fill="none" stroke="#a59c90" stroke-width="1.2"/>
    <rect x="${r2(sx(0.8))}" y="${r2(y)}" width="${r2(sx(1) - sx(0.8))}" height="${r2(h)}" fill="#e5534b" opacity=".08"/>
    <path d="${curve}" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="M${r2(mx)},${r2(y + h)} V${r2(my)}" stroke="${col}" stroke-width="1.4" stroke-dasharray="3 3"/>
    <circle cx="${r2(mx)}" cy="${r2(my)}" r="5.2" fill="${col}" stroke="${INK}" stroke-width="1.6"/>
    <text x="${r2(x + w)}" y="${r2(y + h + 14)}" text-anchor="end" font-size="9.5" font-weight="700" fill="#6f6961">${t("utilization →")}</text>
    <text x="${r2(x + 4)}" y="${r2(y + 9)}" font-size="9.5" font-weight="700" fill="#6f6961">${t("latency")}</text>
    <text x="${r2(Math.min(mx, x + w - 30))}" y="${r2(Math.max(my - 10, y + 22))}" text-anchor="middle" font-size="10.5" font-weight="800" fill="${INK}">${Math.round(marker * 100)}%</text>`;
}

export const BAR_TONES: Record<string, string> = {
  green: "#9FD28F",
  amber: "#EFB041",
  red: "#E5534B",
  gray: "#B5AB9E",
  violet: "#CBBAE6",
  blue: "#A9C5E8",
};

/** `x="…">text` for a left-aligned run, flipped to right-aligned for RTL text in RTL UIs. */
function startText(text: string, x: number, size: number): string {
  if (!(getLocale().rtl() && textDir(text) === "rtl")) return `x="${r2(x)}">${text}`;
  const trimmed = text.trimStart();
  return `x="${r2(x + measureText(text.slice(0, text.length - trimmed.length), size))}" direction="rtl" text-anchor="end">${trimmed}`;
}

function bars(x: number, y: number, w: number, labelW: number, rows: PanelBar[], noteW = 46): string {
  const trackX = x + labelW;
  const trackW = w - labelW - noteW;
  return rows
    .map((b, i) => {
      const ry = y + i * 19;
      const bx = trackX + (b.from || 0) * trackW;
      const bw = Math.max(3, ((b.to ?? 1) - (b.from || 0)) * trackW);
      return `
        <text y="${r2(ry + 12)}" font-size="10.5" font-weight="${b.bold ? 800 : 500}" fill="#34302b" ${startText(b.label, x, 10.5)}</text>
        <rect x="${r2(trackX)}" y="${r2(ry + 3)}" width="${r2(trackW)}" height="11" rx="3" fill="#f1e8db"/>
        <rect x="${r2(bx)}" y="${r2(ry + 3)}" width="${r2(bw)}" height="11" rx="3" fill="${BAR_TONES[b.tone || "gray"]}" stroke="${INK}" stroke-opacity=".55" stroke-width="1"/>
        <text y="${r2(ry + 12)}" font-size="10" font-weight="800" fill="${INK}" ${startText(b.note || "", bx + bw + 6, 10)}</text>`;
    })
    .join("");
}

/** Natural card size (before any morph). */
export function panelSize(e: Pick<PanelP, "title" | "lines" | "chart" | "bars" | "w">): { w: number; h: number; labelW: number; noteW: number } {
  const textW = Math.max(
    measureText(e.title, 10) + e.title.length + 48,
    ...e.lines.map((l) => measureText(l.replace(/\*\*/g, "").replace(/^[=#!] /, ""), 11.5) + 30),
  );
  const isBars = e.chart === "bars";
  const labelW = isBars ? Math.max(...e.bars.map((b) => measureText(b.label, 10.5))) + 14 : 0;
  const noteW = isBars ? Math.max(46, ...e.bars.map((b) => measureText(b.note || "", 10) + 12)) : 0;
  const w = Math.max(e.w, textW, isBars ? labelW + 184 + noteW : e.chart ? 220 : 0);
  const chartH = e.chart === "hockey" ? 96 : isBars ? e.bars.length * 19 : 0;
  const h = 34 + e.lines.length * 18 + (e.chart === "hockey" ? chartH + 22 : isBars ? chartH + 12 : 0) + 6;
  return { w, h, labelW, noteW };
}

export function renderPanel(e: PanelP): Rendered {
  const [px, py] = iso(e.x, e.y, e.z);
  const { w, h, labelW, noteW } = panelSize(e);
  const u = px + e.dx;
  const d = py + e.dy - e.lift;
  const boxW = e.boxW ?? w;
  const boxH = e.boxH ?? h;
  const fade = e.fade ?? 1;
  const rtl = getLocale().rtl();
  const at = (text: string, off: number) =>
    rtl ? (textDir(text) === "rtl" ? `x="${r2(u + w - off)}" direction="rtl"` : `x="${r2(u + w - off)}" text-anchor="end"`) : `x="${r2(u + off)}"`;
  let lines = "";
  e.lines.forEach((line, i) => {
    const y = d + 34 + i * 18 + 12;
    const band = (fill: string) => `<rect x="${r2(u + 10)}" y="${r2(y - 13)}" width="${r2(w - 20)}" height="18" rx="5" fill="${fill}"/>`;
    if (line.startsWith("= ")) {
      lines += band("#dcefd2");
      lines += `<text ${at(line.slice(2), 16)} y="${r2(y)}" font-size="11.5" font-weight="800" fill="#24521c">${richText(line.slice(2))}</text>`;
    } else if (line.startsWith("! ")) {
      lines += band("#f8d5cf");
      lines += `<text ${at(line.slice(2), 16)} y="${r2(y)}" font-size="11.5" font-weight="800" fill="#8f2a22">${richText(line.slice(2))}</text>`;
    } else if (line.startsWith("# ")) {
      lines += `<text ${at(line.slice(2), 16)} y="${r2(y)}" font-size="10.5" font-weight="500" fill="#8b847a">${richText(line.slice(2))}</text>`;
    } else {
      lines += `<text ${at(line, 16)} y="${r2(y)}" font-size="11.5" font-weight="500" fill="#34302b">${richText(line)}</text>`;
    }
  });
  const v = d + 34 + e.lines.length * 18 + 10;
  const chart =
    e.chart === "hockey" ? hockey(u + 18, v, w - 36, 96 - 14, e.marker) : e.chart === "bars" ? bars(u + 16, v - 2, w - 32, labelW, e.bars, noteW) : "";
  const over = `
    <g opacity="${r2(e.opacity)}">
      <rect x="${r2(u)}" y="${r2(d + 2.5)}" width="${r2(boxW)}" height="${r2(boxH)}" rx="10" fill="${DROP}"/>
      <rect x="${r2(u)}" y="${r2(d)}" width="${r2(boxW)}" height="${r2(boxH)}" rx="10" fill="#fbf7f1" stroke="${INK}" stroke-width="1.4"/>
      <path d="M${r2(u + 12)},${r2(d + 30)} H${r2(u + boxW - 12)}" stroke="#e6ddd0" stroke-width="1"/>
      <g opacity="${r2(fade)}">
        ${iconAt(e.icon, rtl ? u + w - 20 : u + 20, d + 18, 13, { stroke: 2.1, color: "#6f6961" })}
        <text ${at(e.title, 33)} y="${r2(d + 21.5)}" font-size="10" font-weight="800" letter-spacing="1" fill="#6f6961">${escapeText(upper(e.title))}</text>
        ${lines}
        ${chart}
      </g>
    </g>`;
  return { body: "", over, poly: null, size: { w, h }, bounds: [u - 6, d - 6, u + boxW + 6, d + boxH + 10] };
}
