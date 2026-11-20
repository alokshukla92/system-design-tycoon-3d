// Packet flow helpers (doc 05 §4): shapes, speeds, route picking and travel spans.
import type { Flow, LinkStyle, PacketKind } from "../types/lesson";

export const PACKET_SPEED = 155;
export const KIND_SPEED: Partial<Record<PacketKind, number>> = { heavy: 0.7, ping: 0.85, slow: 0.32 };
/** Distance kept clear of an arrowhead at a link end. */
export const HEAD_CLEARANCE = 16;

export function packetShape(kind: PacketKind): string {
  switch (kind) {
    case "ping":
    case "kill":
      return `<circle r="3.6"/>`;
    case "heavy":
      return `<rect x="-6" y="-6" width="12" height="12" rx="3.5"/>`;
    case "write":
      return `<rect x="-4.2" y="-4.2" width="8.4" height="8.4" rx="2"/>`;
    case "msg":
    case "poison":
      return `<rect x="-4.8" y="-4.8" width="9.6" height="9.6" rx="2.4"/>`;
    default:
      return `<circle r="4.3"/>`;
  }
}

export const burstShape = (kind: "ok" | "fail"): string =>
  kind === "fail"
    ? `<circle r="5" class="fx-ring"/><path d="M-3.6,-3.6 L3.6,3.6 M3.6,-3.6 L-3.6,3.6" class="fx-x"/>`
    : `<circle r="4.3" class="fx-ring"/>`;

/** Packet speed in px/s. */
export const packetSpeed = (kind: PacketKind, speed = 1): number => PACKET_SPEED * speed * (KIND_SPEED[kind] ?? 1);

/** Usable [start, end] distances along a link path of length `len`, keeping clear of arrowheads. */
export function travelSpan(len: number, heads: "end" | "both" | "none" | undefined, style: LinkStyle | undefined): [number, number] {
  const h = style === "beat" || style === "cut" ? "none" : heads;
  let start = h === "both" ? HEAD_CLEARANCE : 0;
  let end = len - (h === "none" ? 0 : HEAD_CLEARANCE);
  if (end - start < 10) {
    start = 0;
    end = len;
  }
  return [start, end];
}

/** Live flow state: spec + spawn accumulator, spawn counter, round-robin cursor. */
export type FlowState = Flow & { acc: number; n: number; rr: number };

/** Pick the next packet's route (link ids) and kind; advances the flow's counters. */
export function pickRoute(f: FlowState, rand: () => number = Math.random): { route: string[]; kind: PacketKind } {
  const kind: PacketKind = f.pattern ? f.pattern[f.n % f.pattern.length] : f.kind || "req";
  if ("routes" in f) {
    let i: number;
    if (f.pick === "weights") {
      const ws = f.routes.map((r) => r.weight ?? 1);
      let r = rand() * ws.reduce((a, b) => a + b, 0);
      i = ws.findIndex((w) => (r -= w) <= 0);
      if (i < 0) i = ws.length - 1;
    } else {
      i = f.rr % f.routes.length;
      f.rr += 1;
    }
    f.n += 1;
    return { route: f.routes[i].path, kind: f.routes[i].kind || kind };
  }
  const route = f.route.map((step) => {
    if (typeof step === "string") return step;
    if (f.pick === "weights") {
      const ws = f.weights || step.map(() => 1);
      let r = rand() * ws.reduce((a, b) => a + b, 0);
      for (let k = 0; k < step.length; k++) if ((r -= ws[k]) <= 0) return step[k];
      return step[step.length - 1];
    }
    const id = step[f.rr % step.length];
    f.rr += 1;
    return id;
  });
  f.n += 1;
  return { route, kind };
}
