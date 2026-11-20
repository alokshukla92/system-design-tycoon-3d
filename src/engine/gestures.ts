// Stage gestures (doc 05 §6): double-click/tap zoom, drag/wheel pan, ctrl/⌘+wheel and pinch zoom, swipe.

export interface GestureTarget {
  /** True while the user has a manual zoom/pan view. */
  zoomed(): boolean;
  /** Multiply zoom by `factor` about the normalised point (fx, fy). */
  zoomAt(fx: number, fy: number, factor: number): void;
  /** Pan by a fraction of the displayed view. */
  panBy(fx: number, fy: number): void;
  toggleZoomAt(fx: number, fy: number): void;
  swipe(dir: 1 | -1): void;
}

export const SWIPE_MIN_PX = 50;
export const SWIPE_MAX_MS = 700;
export const SWIPE_SLOPE = 0.6;
export const TAP_MAX_MS = 300;
export const DOUBLE_TAP_MS = 320;
export const DOUBLE_TAP_PX = 40;
export const MOVE_SLOP_PX = 8;

/** Horizontal swipe direction (+1 next, −1 previous) or 0. */
export function swipeDir(dx: number, dy: number, ms: number, zoomed: boolean): 1 | -1 | 0 {
  if (zoomed || ms >= SWIPE_MAX_MS || Math.abs(dx) <= SWIPE_MIN_PX || Math.abs(dy) >= Math.abs(dx) * SWIPE_SLOPE) return 0;
  return dx < 0 ? 1 : -1;
}

/** Wheel zoom factor for ctrl/⌘+wheel. */
export const wheelZoomFactor = (deltaY: number, deltaMode: number): number => Math.exp(-deltaY * (deltaMode === 1 ? 16 : 1) * 0.01);

type One = { mode: "one"; x: number; y: number; x0: number; y0: number; t0: number; moved: boolean; pinched: boolean };
type Two = { mode: "two"; d: number; x: number; y: number; pinched: true };

/** Attach listeners to `host`; returns a detach function. */
export function attachGestures(host: HTMLElement, t: GestureTarget): () => void {
  const rect = () => host.getBoundingClientRect();
  const norm = (cx: number, cy: number): [number, number] => {
    const r = rect();
    return [(cx - r.left) / r.width, (cy - r.top) / r.height];
  };
  const pair = (ts: TouchList) => ({
    d: Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY),
    x: (ts[0].clientX + ts[1].clientX) / 2,
    y: (ts[0].clientY + ts[1].clientY) / 2,
  });
  let touch: One | Two | null = null;
  let lastTap = { at: 0, x: 0, y: 0 };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length >= 2) {
      e.preventDefault();
      touch = { mode: "two", ...pair(e.touches), pinched: true };
    } else if (e.touches.length === 1) {
      const p = e.touches[0];
      touch = { mode: "one", x: p.clientX, y: p.clientY, x0: p.clientX, y0: p.clientY, t0: performance.now(), moved: false, pinched: false };
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!touch) return;
    if (e.touches.length >= 2) {
      e.preventDefault();
      const p = pair(e.touches);
      if (touch.mode !== "two") touch = { mode: "two", ...p, pinched: true };
      const [fx, fy] = norm(p.x, p.y);
      if (touch.d > 0) t.zoomAt(fx, fy, p.d / touch.d);
      const r = rect();
      t.panBy((p.x - touch.x) / r.width, (p.y - touch.y) / r.height);
      Object.assign(touch, p);
      return;
    }
    if (touch.mode !== "one") return;
    const p = e.touches[0];
    if (Math.hypot(p.clientX - touch.x0, p.clientY - touch.y0) > MOVE_SLOP_PX) touch.moved = true;
    if (t.zoomed()) {
      e.preventDefault();
      const r = rect();
      t.panBy((p.clientX - touch.x) / r.width, (p.clientY - touch.y) / r.height);
    }
    touch.x = p.clientX;
    touch.y = p.clientY;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (!touch) return;
    if (e.touches.length === 1 && touch.mode === "two") {
      const p = e.touches[0];
      touch = { mode: "one", x: p.clientX, y: p.clientY, x0: p.clientX, y0: p.clientY, t0: 0, moved: true, pinched: true };
      return;
    }
    if (e.touches.length) return;
    const now = performance.now();
    if (touch.mode === "one" && !touch.pinched) {
      const p = e.changedTouches[0];
      const dir = swipeDir(p.clientX - touch.x0, p.clientY - touch.y0, now - touch.t0, t.zoomed());
      if (dir) t.swipe(dir);
      else if (!touch.moved && now - touch.t0 < TAP_MAX_MS) {
        const near = Math.hypot(p.clientX - lastTap.x, p.clientY - lastTap.y) < DOUBLE_TAP_PX;
        if (now - lastTap.at < DOUBLE_TAP_MS && near) {
          e.preventDefault();
          const [fx, fy] = norm(p.clientX, p.clientY);
          t.toggleZoomAt(fx, fy);
          lastTap = { at: 0, x: 0, y: 0 };
        } else lastTap = { at: now, x: p.clientX, y: p.clientY };
      }
    }
    touch = null;
  };
  const onTouchCancel = () => {
    touch = null;
  };

  let drag: { x: number; y: number } | null = null;
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !t.zoomed()) return;
    drag = { x: e.clientX, y: e.clientY };
    host.setPointerCapture?.(e.pointerId);
    host.classList.add("is-dragging");
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const r = rect();
    t.panBy((e.clientX - drag.x) / r.width, (e.clientY - drag.y) / r.height);
    drag = { x: e.clientX, y: e.clientY };
  };
  const endDrag = () => {
    drag = null;
    host.classList.remove("is-dragging");
  };
  const onDblClick = (e: MouseEvent) => {
    const [fx, fy] = norm(e.clientX, e.clientY);
    t.toggleZoomAt(fx, fy);
  };
  const onWheel = (e: WheelEvent) => {
    const k = e.deltaMode === 1 ? 16 : 1;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const [fx, fy] = norm(e.clientX, e.clientY);
      t.zoomAt(fx, fy, wheelZoomFactor(e.deltaY, e.deltaMode));
    } else if (t.zoomed()) {
      e.preventDefault();
      const r = rect();
      t.panBy((-e.deltaX * k) / r.width, (-e.deltaY * k) / r.height);
    }
  };

  const active = { passive: false } as const;
  const on: [string, EventListener, AddEventListenerOptions?][] = [
    ["touchstart", onTouchStart as EventListener, active],
    ["touchmove", onTouchMove as EventListener, active],
    ["touchend", onTouchEnd as EventListener],
    ["touchcancel", onTouchCancel],
    ["pointerdown", onPointerDown as EventListener],
    ["pointermove", onPointerMove as EventListener],
    ["pointerup", endDrag],
    ["pointercancel", endDrag],
    ["dblclick", onDblClick as EventListener],
    ["wheel", onWheel as EventListener, active],
  ];
  for (const [type, fn, opts] of on) host.addEventListener(type, fn, opts);
  return () => {
    for (const [type, fn, opts] of on) host.removeEventListener(type, fn, opts);
  };
}
