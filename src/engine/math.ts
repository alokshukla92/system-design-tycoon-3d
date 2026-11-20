// Numeric helpers, easing curves and timing constants of the diagram engine (doc 05 §1).

/** Round to 2 decimals — every numeric attribute written into the SVG goes through this. */
export const r2 = (v: number): number => Math.round(v * 100) / 100;

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export type Easing = (t: number) => number;

export const ease = {
  /** easeInOutCubic */
  inOut: ((t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)) as Easing,
  /** easeOutCubic */
  out: ((t) => 1 - (1 - t) ** 3) as Easing,
  /** easeOutBack with overshoot 1.35 — used for `lift` on enter. */
  back: ((t) => 1 + 2.35 * (t - 1) ** 3 + 1.35 * (t - 1) ** 2) as Easing,
};

/** Scene transition timings in ms. */
export const TIMING = { exit: 420, move: 820, enter: 680, stagger: 130, draw: 560 } as const;

export const LINK_FADE_MS = 300;
export const LABEL_SWAP_MS = 320;
export const SPOT_MS = 1600;
export const BURST_MS = 700;
export const PACKET_LEAVE_MS = 260;
export const HOP_DWELL_S = 0.16;
export const ZOOM_BLEND_MS = 360;
export const DT_CAP_S = 0.05;
