// Icon registry — the original's 127 icon names (doc 05b §8) backed by Lucide (ISC licence).
// Markup lives in icons.data.ts — run `node scripts/gen-icons.mjs` after editing ALIAS/ICON_NAMES.
// `iconSvg` reproduces the original helper `i(name, {size, stroke, cls, fill})`; `iconInner` returns
// just the child markup for embedding in diagram SVG (24×24 coordinate space).
import { ICON_MARKUP } from "./icons.data";

/** Original name → Lucide export name (PascalCase). Omitted entries use PascalCase(name). */
export const ALIAS: Record<string, string> = {
  window: "AppWindow",
  message: "MessageSquareText",
  replay: "RotateCcw",
  alert: "TriangleAlert",
  bulb: "Lightbulb",
  dollar: "CircleDollarSign",
  chart: "ChartColumn",
  cart: "ShoppingCart",
  refresh: "RefreshCw",
  keyhole: "CircleDot",
  flask: "FlaskConical",
  toggle: "ToggleLeft",
  gitPull: "GitPullRequest",
  close: "X",
  expand: "Maximize2",
  collapse: "Minimize2",
  flow: "Workflow",
  sheets: "SquareStack",
  shield: "ShieldCheck",
  share: "Share2",
};

export const ICON_NAMES = [
  "book", "settings", "window", "scan", "search", "chevronRight", "chevronDown", "file", "flame", "scale",
  "shield", "box", "database", "eye", "zap", "users", "play", "arrowRight", "bookmark", "share", "check",
  "user", "userRound", "message", "server", "replay", "pause", "chevronLeft", "arrowLeft", "clock", "lock",
  "alert", "bulb", "info", "gauge", "heartPulse", "layers", "flag", "circleCheck", "network", "split",
  "target", "sparkles", "signal", "listOrdered", "keyboard", "globe", "cpu", "trendingUp", "dollar", "timer",
  "activity", "mail", "package", "chart", "gift", "video", "inbox", "bell", "smartphone", "send", "radio",
  "cart", "braces", "workflow", "refresh", "skull", "hourglass", "bot", "ban", "power", "unplug", "bug",
  "scroll", "chartLine", "waypoints", "siren", "key", "building", "creditCard", "fingerprint", "plane",
  "hotel", "car", "ticket", "puzzle", "rocket", "undo", "wifi", "eyeOff", "fileKey", "hash", "merge", "waves",
  "moon", "signpost", "idCard", "userCheck", "clipboard", "route", "sigma", "filter", "keyhole", "gitBranch",
  "gitCommit", "flask", "container", "toggle", "map", "zoomIn", "code", "boxes", "gitPull", "listChecks",
  "hammer", "packageCheck", "component", "sun", "menu", "close", "expand", "collapse", "zoomOut", "volume2",
  "volumeX", "flow", "sheets",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Inner SVG markup (children only) in a 24×24 viewBox. */
export function iconInner(name: IconName | string): string {
  const out = ICON_MARKUP[name];
  if (out === undefined) throw new Error(`Unknown icon: ${name}`);
  return out;
}

export interface IconOpts {
  size?: number;
  stroke?: number;
  cls?: string;
  fill?: string;
}

/** Full `<svg class="i …">` string — same attributes as the original helper (doc 05b §8). */
export function iconSvg(name: IconName | string, { size = 16, stroke = 1.75, cls = "", fill = "none" }: IconOpts = {}): string {
  return `<svg class="i${cls ? ` ${cls}` : ""}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconInner(name)}</svg>`;
}
