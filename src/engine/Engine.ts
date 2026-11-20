// Isometric diagram engine: scene diffing, tweens, links, packets, camera and gestures (docs 05, 05b).
import type { Entity, Link, PacketKind, Scene } from "../types/lesson";
import type { EngineApi, GoToOptions } from "./index";
import { FLOOR_TYPES, anchor, depthKey, footprint, render, resolve, type Corner, type PanelP, type Props } from "./entities";
import { cardFootprint, dockRect, planFor, resolvePoint, type Cam, type Plan, type Viewport } from "./framing";
import { attachGestures } from "./gestures";
import { LABEL_SIZE, labelBox, placeLabel } from "./labels";
import {
  BURST_MS, DT_CAP_S, HOP_DWELL_S, LABEL_SWAP_MS, LINK_FADE_MS, PACKET_LEAVE_MS, SPOT_MS, TIMING, ZOOM_BLEND_MS,
  clamp01, ease, lerp, r2, type Easing,
} from "./math";
import { burstShape, packetShape, packetSpeed, pickRoute, travelSpan, type FlowState } from "./packets";
import { panelSize } from "./panel";
import { GRID_DEFS, pill, themeDefs } from "./prims";
import { clipEnd, clipStart, iso, roundedPolygon, roundedPolyline, type Pt } from "./projection";
import { recolor } from "./theme";
import "./stage.css";

const SVG_NS = "http://www.w3.org/2000/svg";
const CARD_ID = "__card";
const HUD_SCALE_MAX = 1.16;
const CARDS_MIN_WIDTH = 520;

type Bag = Record<string, unknown>;

/** Start-state overrides for entering entities (default: rise from lift 120). */
const ENTER_FROM: Partial<Record<Entity["type"], Bag>> = {
  crowd: { count: 0, lift: 26 },
  device: { lift: 40 },
  ghost: {},
  zone: {},
  ring: {},
  queue: { n: 0, opacity: 1 },
  panel: { lift: -14 },
};
/** End-state overrides for exiting entities (default: sink to lift −22). */
const EXIT_TO: Partial<Record<Entity["type"], Bag>> = {
  crowd: { count: 0 },
  queue: { n: 0, opacity: 1 },
  ghost: {},
  zone: {},
  ring: {},
  panel: { lift: -10 },
};

interface CardMorph {
  swap: boolean;
  w0: number;
  h0: number;
  w1: number;
  h1: number;
  keep: Corner | null;
}

interface EntTween {
  from: Props;
  to: Props;
  start: number;
  delay: number;
  dur: number;
  ease: Easing;
  remove?: boolean;
  liftEase?: Easing;
  countEase?: Easing;
  started?: boolean;
  tagSwap?: boolean;
  labelSwap?: boolean;
  card?: CardMorph;
}

interface EntState {
  id: string;
  cur: Props;
  el: SVGGElement;
  overEl: SVGGElement;
  poly: Pt[] | null;
  tween: EntTween | null;
}

interface LinkTween {
  from: number;
  to: number;
  key: "draw" | "opacity";
  start: number;
  delay: number;
  dur: number;
  remove?: boolean;
}

interface LinkState {
  id: string;
  spec: Link;
  el: SVGPathElement;
  label: SVGGElement;
  draw: number;
  opacity: number;
  tween: LinkTween | null;
  len: number;
  pts?: Pt[];
  labelKey: string | null;
  labelBorn: number;
  lpos?: [number, number];
}

interface Packet {
  route: string[];
  seg: number;
  d: number;
  kind: PacketKind;
  el: SVGGElement;
  back: boolean;
  bounce: boolean;
  dwell: number;
  speed: number;
  hold: number;
}

interface Anim {
  cam: { from: Cam; to: Cam; delay: number; dur: number };
  start: number;
  end: number;
  flows: NonNullable<Scene["flows"]>;
  spot: string[];
  /** Property-only refresh started by update(): settling keeps the running flows. */
  live?: boolean;
}

/** Duration of the property tween used by update() for live (simulation) refreshes. */
const UPDATE_MS = 420;
const GEOMETRY_KEYS = ["type", "x", "y", "x0", "x1", "y0", "y1", "s", "h", "r", "w", "d"] as const;

/** Structural fingerprint of a scene: ids, entity geometry and link topology (no live properties). */
function structureKey(scene: Scene): string {
  const ents = Object.entries(scene.entities)
    .map(([id, e]) => {
      const b = e as unknown as Bag;
      return `${id}:${GEOMETRY_KEYS.map((k) => b[k] ?? "").join(",")}`;
    })
    .sort();
  const links = Object.entries(scene.links || {})
    .map(([id, l]) => `${id}:${l.from}>${l.to ?? ""}:${JSON.stringify(l.pts)}:${l.heads ?? ""}`)
    .sort();
  return `${ents.join("|")}#${links.join("|")}`;
}

interface View {
  k: number;
  cx: number;
  cy: number;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Which parts of an entity need a cross-fade while it moves between two states. */
function morphFlags(a: Props, b: Props): Pick<EntTween, "tagSwap" | "labelSwap" | "card"> {
  const out: Pick<EntTween, "tagSwap" | "labelSwap" | "card"> = {};
  const ab = a as unknown as Bag;
  const bb = b as unknown as Bag;
  if (!same(ab.tags, bb.tags)) out.tagSwap = true;
  if (!same(ab.label, bb.label) || (ab.sub || "") !== (bb.sub || "")) out.labelSwap = true;
  if (a.type === "panel" && b.type === "panel") {
    const key = (p: PanelP) => [p.title, p.icon, p.chart, p.lines, p.bars, p.w];
    const s0 = panelSize(a);
    const s1 = panelSize(b);
    out.card = {
      swap: !same(key(a), key(b)),
      w0: s0.w,
      h0: s0.h,
      w1: s1.w,
      h1: s1.h,
      keep: a.corner && a.corner === b.corner ? b.corner : null,
    };
  }
  return out;
}

const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

export class Engine implements EngineApi {
  readonly svg: SVGSVGElement;
  paused = false;
  onCards: EngineApi["onCards"] = null;
  onSwipe: EngineApi["onSwipe"] = null;
  onView: EngineApi["onView"] = null;
  onPick: EngineApi["onPick"] = null;
  /** Fired once a transition has settled (flows started, spotlights shown). */
  onSettle: (() => void) | null = null;

  private host: HTMLElement;
  private L: Record<"floor" | "links" | "packets" | "ents" | "over" | "hud", SVGGElement>;
  private gridFade: SVGRadialGradientElement;
  private defs: SVGDefsElement;
  private ents = new Map<string, EntState>();
  private links = new Map<string, LinkState>();
  private plans = new Map<Scene, Plan>();
  private hudScale = HUD_SCALE_MAX;
  private showCards = true;
  private view: View | null = null;
  private blend: { from: Cam; start: number; dur: number } | null = null;
  private scenes: Scene[] = [];
  private scene: Scene | null = null;
  private flows: FlowState[] = [];
  private packets: Packet[] = [];
  private anim: Anim | null = null;
  private cam: Cam = { x: -100, y: -60, w: 200, h: 120 };
  private last = performance.now();
  private size = "";
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private detach: () => void;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private picked: string | null = null;
  private pickEl: SVGPathElement | null = null;
  private structure = "";

  constructor(container: HTMLElement) {
    this.host = container;
    this.svg = svgEl("svg", { class: "stage-svg", xmlns: SVG_NS, preserveAspectRatio: "xMidYMid meet", role: "img" });
    this.svg.innerHTML = `
      <defs class="defs-theme">${recolor(themeDefs())}</defs>${GRID_DEFS}
      <rect class="stage-grid" x="-5000" y="-5000" width="10000" height="10000" fill="url(#iso-grid)" mask="url(#grid-mask)"/>
      <g class="layer-floor"></g>
      <g class="layer-links"></g>
      <g class="layer-packets"></g>
      <g class="layer-ents"></g>
      <g class="layer-over"></g>
      <g class="layer-hud"></g>`;
    container.appendChild(this.svg);
    const q = <T extends Element>(sel: string) => this.svg.querySelector(sel) as T;
    this.L = {
      floor: q(".layer-floor"),
      links: q(".layer-links"),
      packets: q(".layer-packets"),
      ents: q(".layer-ents"),
      over: q(".layer-over"),
      hud: q(".layer-hud"),
    };
    this.gridFade = q("#grid-fade");
    this.defs = q(".defs-theme");
    this.detach = attachGestures(container, {
      zoomed: () => !!this.view,
      zoomAt: (fx, fy, k) => this.zoomAt(fx, fy, k),
      panBy: (fx, fy) => this.panBy(fx, fy),
      toggleZoomAt: (fx, fy) => this.toggleZoomAt(fx, fy),
      swipe: (dir) => this.onSwipe?.(dir),
    });
    let down: [number, number] | null = null;
    const onDown = (ev: PointerEvent) => {
      down = [ev.clientX, ev.clientY];
    };
    const onClick = (ev: MouseEvent) => {
      if (!this.onPick) return;
      if (down && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return;
      const hit = (ev.target as Element | null)?.closest?.("[data-id]");
      const id = hit && this.svg.contains(hit) ? hit.getAttribute("data-id") : null;
      this.onPick(id && this.ents.has(id) && id !== CARD_ID ? id : null);
    };
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("click", onClick);
    const detachGestures = this.detach;
    this.detach = () => {
      detachGestures();
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("click", onClick);
    };
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => {
        const s = `${container.clientWidth}x${container.clientHeight}`;
        if (s !== this.size) {
          this.size = s;
          this.refit();
        }
      });
      this.ro.observe(container);
    }
    const loop = (now: number) => {
      this.tick(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // ── framing ───────────────────────────────────────────────────────────────
  private viewport(): Viewport {
    return { width: this.host.clientWidth, height: this.host.clientHeight, hudScale: this.hudScale, showCards: this.showCards };
  }

  /** Update HUD scale and docked-card visibility; returns true when visibility flipped. */
  private measure(): boolean {
    const w = this.host.clientWidth;
    if (!w) return false;
    this.hudScale = Math.min(HUD_SCALE_MAX, Math.max(0.86, w / 780));
    const show = w >= CARDS_MIN_WIDTH;
    if (show === this.showCards) return false;
    this.showCards = show;
    this.onCards?.(show);
    return true;
  }

  private planAll(scenes: Scene[]): void {
    this.plans = new Map();
    let prev: Plan | null = null;
    for (const s of scenes) {
      prev = planFor(s, prev, this.viewport());
      this.plans.set(s, prev);
    }
  }

  frame(scenes: Scene[]): void {
    this.measure();
    this.scenes = scenes;
    this.planAll(scenes);
    if (!scenes.length) return;
    this.scene = scenes[0];
    this.setCam(this.plan(scenes[0]).cam);
  }

  private plan(scene: Scene): Plan {
    let p = this.plans.get(scene);
    if (!p) {
      p = planFor(scene, null, this.viewport());
      this.plans.set(scene, p);
    }
    return p;
  }

  private dockAt(corner: Corner, w: number, h: number): { sx: number; sy: number } {
    const r = dockRect(corner, cardFootprint({ w, h }, this.hudScale), this.host.clientWidth, this.host.clientHeight);
    return { sx: r[0], sy: r[1] };
  }

  // ── camera & manual view ──────────────────────────────────────────────────
  private displayCam(base: Cam = this.cam): Cam {
    let c = base;
    if (this.view) {
      const w = base.w / this.view.k;
      const h = base.h / this.view.k;
      c = { x: this.view.cx - w / 2, y: this.view.cy - h / 2, w, h };
    }
    const b = this.blend;
    if (!b) return c;
    const t = ease.inOut(clamp01((performance.now() - b.start) / b.dur));
    if (t >= 1) {
      this.blend = null;
      return c;
    }
    return { x: lerp(b.from.x, c.x, t), y: lerp(b.from.y, c.y, t), w: lerp(b.from.w, c.w, t), h: lerp(b.from.h, c.h, t) };
  }

  private setCam(cam: Cam): void {
    this.cam = cam;
    const d = this.displayCam(cam);
    this.svg.setAttribute("viewBox", `${r2(d.x)} ${r2(d.y)} ${r2(d.w)} ${r2(d.h)}`);
    const k = d.w / Math.max(1, this.host.clientWidth);
    this.L.hud.setAttribute("transform", `translate(${r2(d.x)} ${r2(d.y)}) scale(${k.toFixed(5)})`);
    const cx = d.x + d.w / 2;
    const cy = d.y + d.h / 2;
    this.gridFade.setAttribute("cx", String(r2(cx)));
    this.gridFade.setAttribute("cy", String(r2(cy)));
    this.gridFade.setAttribute("r", String(r2(d.w * 0.56)));
    this.gridFade.setAttribute("gradientTransform", `translate(${r2(cx)} ${r2(cy)}) scale(1 0.6) translate(${r2(-cx)} ${r2(-cy)})`);
  }

  refit(): void {
    if (!this.scene) return;
    this.clearView();
    const flipped = this.measure();
    const scene = this.scene;
    this.planAll(this.scenes.length ? this.scenes : [scene]);
    const p = this.plan(scene);
    if (flipped) {
      this.goTo(scene, { instant: true });
      return;
    }
    if (this.anim) this.anim.cam.to = p.cam;
    else this.setCam(p.cam);
    for (const e of this.ents.values()) {
      if (e.cur.type !== "panel" || !p.dock) continue;
      const dock = { sx: p.dock.x, sy: p.dock.y, corner: p.dock.corner };
      e.cur = { ...e.cur, ...dock };
      if (e.tween && !e.tween.remove) e.tween.to = { ...e.tween.to, ...dock } as Props;
      this.renderEntity(e);
    }
  }

  private clampView(v: View | null): View | null {
    if (!v) return null;
    const c = this.cam;
    const scale = this.host.clientWidth / c.w;
    const maxK = Math.max(1.5, Math.min(6, 3.2 / scale));
    const k = Math.max(1, Math.min(maxK, v.k));
    if (k <= 1.001) return null;
    const w = c.w / k;
    const h = c.h / k;
    return {
      k,
      cx: Math.max(c.x + w / 2, Math.min(c.x + c.w - w / 2, v.cx)),
      cy: Math.max(c.y + h / 2, Math.min(c.y + c.h - h / 2, v.cy)),
    };
  }

  private setView(v: View | null, animate = false): void {
    const was = !!this.view;
    const from = animate ? { ...this.displayCam() } : null;
    this.view = this.clampView(v);
    this.blend = from ? { from, start: performance.now(), dur: ZOOM_BLEND_MS } : null;
    this.setCam(this.cam);
    if (was !== !!this.view) {
      this.host.classList.toggle("is-zoomed", !!this.view);
      this.onView?.(!!this.view);
    }
  }

  private clearView(): void {
    if (!this.view && !this.blend) return;
    const was = !!this.view;
    this.view = null;
    this.blend = null;
    if (was) {
      this.host.classList.remove("is-zoomed");
      this.onView?.(false);
    }
  }

  private zoomAt(fx: number, fy: number, factor: number): void {
    const d = this.displayCam();
    const px = d.x + fx * d.w;
    const py = d.y + fy * d.h;
    const k = (this.view ? this.view.k : 1) * factor;
    const w = this.cam.w / k;
    const h = this.cam.h / k;
    this.setView({ k, cx: px - fx * w + w / 2, cy: py - fy * h + h / 2 });
  }

  private panBy(fx: number, fy: number): void {
    if (!this.view) return;
    const d = this.displayCam();
    this.setView({ ...this.view, cx: this.view.cx - fx * d.w, cy: this.view.cy - fy * d.h });
  }

  private toggleZoomAt(fx: number, fy: number): void {
    if (this.view) {
      this.setView(null, true);
      return;
    }
    const c = this.cam;
    const w = c.w / 2;
    const h = c.h / 2;
    const px = c.x + fx * c.w;
    const py = c.y + fy * c.h;
    this.setView({ k: 2, cx: px - fx * w + w / 2, cy: py - fy * h + h / 2 }, true);
  }

  fit(): void {
    if (this.view) this.setView(null, true);
  }

  // ── scene transitions ─────────────────────────────────────────────────────
  clear(): void {
    this.finish(true);
    for (const e of this.ents.values()) {
      e.el.remove();
      e.overEl.remove();
    }
    for (const l of this.links.values()) {
      l.el.remove();
      l.label.remove();
    }
    this.ents.clear();
    this.links.clear();
    this.clearPackets(true);
    this.flows = [];
    this.L.floor.innerHTML = "";
    this.pickEl = null;
    this.structure = "";
  }

  /**
   * Live refresh for simulations: when only entity/link/flow properties changed since the last
   * scene, tween them in place (keeping packets, camera and running flows); otherwise goTo().
   */
  update(scene: Scene): void {
    const key = structureKey(scene);
    const prev = this.scene;
    const hasPanel = Object.values(scene.entities).some((e) => e.type === "panel");
    if (!prev || key !== this.structure || hasPanel) {
      if (prev && prev !== scene) this.plans.delete(prev);
      this.goTo(scene);
      return;
    }
    const plan = this.plans.get(prev);
    if (plan && prev !== scene) {
      this.plans.delete(prev);
      this.plans.set(scene, plan);
    }
    this.scene = scene;
    const now = performance.now();
    let touched = false;
    for (const [id, spec] of Object.entries(scene.entities)) {
      const e = this.ents.get(id);
      if (!e) continue;
      const to = resolve(spec);
      if (e.tween && !e.tween.remove) {
        e.tween.to = to;
        continue;
      }
      if (same(e.cur, to)) continue;
      const a = e.cur as unknown as Bag;
      const b = to as unknown as Bag;
      const tagShape = (t: unknown) => ((t as { tone?: string; icon?: string }[] | undefined) || []).map((x) => `${x.tone}/${x.icon}`);
      e.tween = {
        from: { ...e.cur },
        to,
        start: now,
        delay: 0,
        dur: UPDATE_MS,
        ease: ease.inOut,
        tagSwap: !same(tagShape(a.tags), tagShape(b.tags)) || undefined,
      };
      touched = true;
    }
    for (const [id, spec] of Object.entries(scene.links || {})) {
      const l = this.links.get(id);
      if (!l || same(l.spec, spec)) continue;
      l.spec = spec;
      this.styleLink(l);
      touched = true;
    }
    const flows = scene.flows || [];
    if (this.anim && !this.anim.live) this.anim.flows = flows;
    else {
      const old = this.flows;
      this.flows = flows.map((f, i) => ({ ...f, acc: old[i]?.acc ?? 0.6, n: old[i]?.n ?? 0, rr: old[i]?.rr ?? 0 }));
    }
    if (this.anim) this.anim.end = Math.max(this.anim.end, now + UPDATE_MS);
    else if (touched) {
      const cam = { ...this.cam };
      this.anim = { cam: { from: cam, to: cam, delay: 0, dur: 1 }, start: now, end: now + UPDATE_MS, flows, spot: [], live: true };
    }
  }

  /** Highlight one entity with a persistent floor outline (null clears). */
  select(id: string | null): void {
    this.picked = id;
    this.drawPick();
  }

  private drawPick(): void {
    const e = this.picked ? this.ents.get(this.picked) : undefined;
    if (!e || e.tween?.remove || ["panel", "queue", "zone", "ring"].includes(e.cur.type)) {
      this.pickEl?.remove();
      this.pickEl = null;
      return;
    }
    const [x0, x1, y0, y1] = footprint(e.cur);
    const m = 0.7;
    const d = roundedPolygon([iso(x0 - m, y0 - m), iso(x0 - m, y1 + m), iso(x1 + m, y1 + m), iso(x1 + m, y0 - m)], 7);
    if (!this.pickEl) {
      this.pickEl = svgEl("path", { class: "pick" });
      this.L.floor.appendChild(this.pickEl);
    }
    if (this.pickEl.getAttribute("d") !== d) this.pickEl.setAttribute("d", d);
  }

  goTo(scene: Scene, { instant = false }: GoToOptions = {}): void {
    this.structure = structureKey(scene);
    this.finish(true);
    this.clearPackets();
    this.flows = [];
    const now = performance.now();
    const plan = this.plan(scene);
    const target: Record<string, Props> = {};
    for (const [id, spec] of Object.entries(scene.entities)) {
      if (spec.type === "panel" && !this.showCards) continue;
      if (spec.type === "panel" && plan.dock) {
        target[CARD_ID] = { ...resolve(spec), sx: plan.dock.x, sy: plan.dock.y, corner: plan.dock.corner } as Props;
      } else target[id] = resolve(spec);
    }
    const exits = [...this.ents.keys()].filter((id) => !target[id]);
    const moves = Object.keys(target).filter((id) => this.ents.has(id) && !same(this.ents.get(id)!.cur, target[id]));
    const enters = Object.keys(target)
      .filter((id) => !this.ents.has(id))
      .sort((a, b) => depthKey(target[a]) - depthKey(target[b]));
    const moveDelay = exits.length ? TIMING.exit * 0.55 : 0;
    const enterDelay = moves.length ? moveDelay + TIMING.move * 0.75 : exits.length ? TIMING.exit * 0.7 : 0;
    const ready: Record<string, number> = {};
    let end = 0;

    for (const id of exits) {
      const e = this.ents.get(id)!;
      const over = EXIT_TO[e.cur.type] || { lift: -22 };
      e.tween = {
        from: { ...e.cur },
        to: { ...e.cur, opacity: 0, ...over } as Props,
        start: now,
        delay: 0,
        dur: TIMING.exit,
        ease: ease.inOut,
        remove: true,
      };
      end = Math.max(end, TIMING.exit);
    }
    for (const id of Object.keys(target)) {
      const e = this.ents.get(id);
      if (!e) continue;
      if (moves.includes(id)) {
        e.tween = { from: { ...e.cur }, to: target[id], start: now, delay: moveDelay, dur: TIMING.move, ease: ease.inOut, ...morphFlags(e.cur, target[id]) };
        ready[id] = moveDelay + TIMING.move;
        end = Math.max(end, ready[id]);
      } else ready[id] = 0;
    }
    enters.forEach((id, i) => {
      const to = target[id];
      const from = { ...to, opacity: 0, ...(ENTER_FROM[to.type] || { lift: 120 }) } as Props;
      const e = this.addEntity(id, from);
      const delay = enterDelay + i * TIMING.stagger;
      e.tween = { from, to, start: now, delay, dur: TIMING.enter, ease: ease.out, liftEase: ease.back, countEase: ease.inOut };
      ready[id] = delay + TIMING.enter * 0.8;
      end = Math.max(end, delay + TIMING.enter);
    });

    const links = scene.links || {};
    for (const [id, l] of this.links) {
      if (!links[id]) l.tween = { from: l.opacity, to: 0, key: "opacity", start: now, delay: 0, dur: LINK_FADE_MS, remove: true };
    }
    let k = 0;
    for (const [id, spec] of Object.entries(links)) {
      const existing = this.links.get(id);
      if (existing) {
        existing.spec = spec;
        this.styleLink(existing);
        continue;
      }
      const l = this.addLink(id, spec);
      const delay =
        Math.max(ready[spec.from] ?? 0, (spec.to !== undefined ? ready[spec.to] : undefined) ?? 0, moveDelay + (moves.length ? TIMING.move * 0.6 : 0)) +
        60 +
        k * 90;
      k += 1;
      l.draw = 0;
      l.tween = { from: 0, to: 1, key: "draw", start: now, delay, dur: TIMING.draw };
      end = Math.max(end, delay + TIMING.draw);
    }

    this.scene = scene;
    const from = { ...this.displayCam() };
    this.clearView();
    const camDelay = exits.length ? TIMING.exit * 0.4 : 0;
    end = Math.max(end, camDelay + TIMING.move);
    const deadOf = (p: Props | undefined) => (p as unknown as Bag | undefined)?.dead;
    this.anim = {
      cam: { from, to: plan.cam, delay: camDelay, dur: TIMING.move },
      start: now,
      end: now + end,
      flows: scene.flows || [],
      spot: [...enters, ...moves.filter((id) => !deadOf(target[id]) || deadOf(this.ents.get(id)!.cur) !== deadOf(target[id]))],
    };
    if (instant) this.finish();
  }

  /** Jump every running tween to its end; `silent` skips flows/spotlights. */
  private finish(silent = false): void {
    if (!this.anim) return;
    for (const [id, e] of [...this.ents]) {
      if (!e.tween) continue;
      if (e.tween.remove) this.removeEntity(id);
      else {
        e.cur = e.tween.to;
        e.tween = null;
        this.renderEntity(e);
      }
    }
    for (const [id, l] of [...this.links]) {
      if (!l.tween) continue;
      if (l.tween.remove) {
        l.el.remove();
        l.label.remove();
        this.links.delete(id);
      } else {
        l[l.tween.key] = l.tween.to;
        l.tween = null;
      }
    }
    this.setCam(this.anim.cam.to);
    this.sortDepth();
    if (this.picked) this.drawPick();
    this.updateLinks(true);
    const a = this.anim;
    this.anim = null;
    if (!silent) this.settle(a);
  }

  private settle(a: Anim): void {
    if (!a.live) this.flows = a.flows.map((f) => ({ ...f, acc: 0.6, n: 0, rr: 0 }));
    for (const id of a.spot) this.spotlight(id);
    this.onSettle?.();
  }

  retheme(): void {
    this.defs.innerHTML = recolor(themeDefs());
    for (const e of this.ents.values()) this.renderEntity(e);
    for (const l of this.links.values()) {
      l.labelKey = null;
      l.labelBorn = 0;
    }
    this.updateLinks(true);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.detach();
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.host.classList.remove("is-zoomed", "is-dragging");
    this.svg.remove();
  }

  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  // ── entities ──────────────────────────────────────────────────────────────
  private addEntity(id: string, p: Props): EntState {
    const el = svgEl("g", { "data-id": id, class: `ent ent--${p.type}` });
    const overEl = svgEl("g", { "data-id": id });
    (FLOOR_TYPES.has(p.type) ? this.L.floor : this.L.ents).appendChild(el);
    (p.type === "panel" ? this.L.hud : this.L.over).appendChild(overEl);
    const e: EntState = { id, cur: { ...p }, el, overEl, poly: null, tween: null };
    this.ents.set(id, e);
    this.renderEntity(e);
    return e;
  }

  private removeEntity(id: string): void {
    const e = this.ents.get(id);
    if (!e) return;
    e.el.remove();
    e.overEl.remove();
    this.ents.delete(id);
  }

  private renderEntity(e: EntState): void {
    const p = e.cur;
    if (p.type === "panel") {
      const r = render({ ...p, x: 0, y: 0, z: 0, dx: 0, dy: 0 });
      e.overEl.innerHTML = `<g transform="translate(${r2(p.sx || 0)} ${r2(p.sy || 0)}) scale(${r2(this.hudScale)})">${recolor(r.over)}</g>`;
      e.poly = null;
      return;
    }
    const r = render(p);
    e.el.innerHTML = recolor(r.body);
    e.overEl.innerHTML = recolor(r.over);
    e.poly = r.poly;
  }

  private sortDepth(): void {
    const order = [...this.ents.values()].filter((e) => !FLOOR_TYPES.has(e.cur.type)).sort((a, b) => depthKey(a.cur) - depthKey(b.cur));
    const kids = [...this.L.ents.children];
    if (order.some((e, i) => kids[i] !== e.el)) for (const e of order) this.L.ents.appendChild(e.el);
  }

  private spotlight(id: string): void {
    const e = this.ents.get(id);
    if (!e || ["panel", "queue", "zone", "ring"].includes(e.cur.type)) return;
    const [x0, x1, y0, y1] = footprint(e.cur);
    const m = 0.6;
    const path = svgEl("path", {
      class: "spot",
      d: roundedPolygon([iso(x0 - m, y0 - m), iso(x0 - m, y1 + m), iso(x1 + m, y1 + m), iso(x1 + m, y0 - m)], 7),
    });
    this.L.floor.appendChild(path);
    this.later(() => path.remove(), SPOT_MS);
  }

  // ── links ─────────────────────────────────────────────────────────────────
  private addLink(id: string, spec: Link): LinkState {
    const el = svgEl("path", { class: "link" });
    this.L.links.appendChild(el);
    const label = svgEl("g", { class: "link-label" });
    this.L.over.appendChild(label);
    const l: LinkState = { id, spec, el, label, draw: 1, opacity: 1, tween: null, len: 0, labelKey: null, labelBorn: 0 };
    this.links.set(id, l);
    this.styleLink(l);
    return l;
  }

  private styleLink(l: LinkState): void {
    l.el.setAttribute("class", `link link--${l.spec.style || "solid"}`);
  }

  private labelText(l: LinkState): string {
    const pick = this.scene ? this.plans.get(this.scene)?.picks[l.id] : undefined;
    return pick && pick.label === l.spec.label ? pick.text : l.spec.label || "";
  }

  private updateLinks(final = false): void {
    const anchorOf = (id: string): Pt => {
      const e = this.ents.get(id);
      if (!e) throw new Error(`Unknown entity in link: ${id}`);
      return anchor(e.cur);
    };
    const now = performance.now();
    for (const l of this.links.values()) {
      const s = l.spec;
      if (!this.ents.has(s.from) || (s.to && !this.ents.has(s.to))) continue;
      let pts: Pt[];
      try {
        pts = s.pts.map((ref) => {
          const [x, y] = resolvePoint(ref, anchorOf);
          return iso(x, y, 0);
        });
      } catch {
        continue;
      }
      pts = clipStart(pts, this.ents.get(s.from)!.poly, 3);
      if (s.to) pts = clipEnd(pts, this.ents.get(s.to)!.poly, s.heads === "none" ? 3 : 4);
      l.pts = pts;
      l.el.setAttribute("d", roundedPolyline(pts, 9));
      l.len = typeof l.el.getTotalLength === "function" ? l.el.getTotalLength() : 0;
      const style = s.style || "solid";
      const marker = style === "off" ? "url(#arrow-muted)" : "url(#arrow)";
      const heads = l.draw > 0.97 && style !== "beat" && style !== "cut";
      l.el.setAttribute("marker-end", heads && s.heads !== "none" ? marker : "");
      l.el.setAttribute("marker-start", heads && s.heads === "both" ? marker : "");
      if (l.draw < 1 && style === "solid") {
        l.el.style.strokeDasharray = `${r2(l.len)} ${r2(l.len)}`;
        l.el.style.strokeDashoffset = String(r2(l.len * (1 - l.draw)));
        l.el.style.opacity = "1";
      } else {
        l.el.style.strokeDasharray = "";
        l.el.style.strokeDashoffset = "";
        l.el.style.opacity = String(r2(l.opacity * (style === "solid" ? 1 : clamp01(l.draw * 1.4))));
      }
      if (s.label) {
        const text = this.labelText(l);
        const key = `${text}|${s.labelTone || ""}`;
        if (l.labelKey !== key) {
          if (l.labelKey) l.labelBorn = now;
          l.label.innerHTML = recolor(pill(0, 0, text, { tone: s.labelTone || "paper", size: LABEL_SIZE }));
          l.labelKey = key;
        }
        const born = l.labelBorn ? clamp01((now - l.labelBorn) / LABEL_SWAP_MS) : 1;
        l.label.style.opacity = String(r2(clamp01((l.draw - 0.6) / 0.4) * l.opacity * born));
      } else if (l.labelKey) {
        l.label.innerHTML = "";
        l.labelKey = null;
      }
    }
    const picks = (this.scene && this.plans.get(this.scene)?.picks) || {};
    for (const l of this.links.values()) {
      if (!l.spec.label || !l.pts) continue;
      const { w, h } = labelBox(this.labelText(l));
      const at = placeLabel(l.pts, l.spec.labelAt ?? 0.5, w, () => 0, picks[l.id]?.side ?? 0, h);
      l.lpos = l.lpos && this.anim && !final ? [lerp(l.lpos[0], at.cx, 0.16), lerp(l.lpos[1], at.cy, 0.16)] : [at.cx, at.cy];
      l.label.setAttribute("transform", `translate(${r2(l.lpos[0])} ${r2(l.lpos[1])})`);
    }
  }

  // ── packets ───────────────────────────────────────────────────────────────
  private clearPackets(now = false): void {
    for (const p of this.packets) {
      if (now) p.el.remove();
      else {
        p.el.classList.add("pkt--leave");
        this.later(() => p.el.remove(), PACKET_LEAVE_MS);
      }
    }
    this.packets = [];
  }

  private spawn(f: FlowState): void {
    if ("routes" in f && f.fanout) {
      f.n += 1;
      for (const r of f.routes) this.launch(r.path, r.kind || f.kind || "req", f);
      return;
    }
    const { route, kind } = pickRoute(f);
    this.launch(route, kind, f);
  }

  private launch(route: string[], kind: PacketKind, f: FlowState): void {
    if (!route.every((id) => this.links.has(id))) return;
    const el = svgEl("g", { class: `pkt pkt--${kind}` });
    el.innerHTML = packetShape(kind);
    this.L.packets.appendChild(el);
    this.packets.push({ route, seg: 0, d: 0, kind, el, back: false, bounce: !!f.bounce, dwell: 0, speed: f.speed || 1, hold: f.hold || 0 });
  }

  private burst(x: number, y: number, kind: "ok" | "fail"): void {
    const g = svgEl("g", { class: `fx fx--${kind}`, transform: `translate(${r2(x)} ${r2(y)})` });
    g.innerHTML = burstShape(kind);
    this.L.packets.appendChild(g);
    this.later(() => g.remove(), BURST_MS);
  }

  /** Move a packet to the next/previous route segment after a short invisible dwell. */
  private hop(p: Packet, dir: 1 | -1): void {
    p.seg += dir;
    p.d = 0;
    p.dwell = HOP_DWELL_S;
    p.el.style.opacity = "0";
  }

  private stepPackets(dt: number): void {
    for (const f of this.flows) {
      for (f.acc += dt * f.rate; f.acc >= 1; ) {
        f.acc -= 1;
        this.spawn(f);
      }
    }
    const keep: Packet[] = [];
    for (const p of this.packets) {
      if (p.dwell > 0) {
        p.dwell -= dt;
        if (p.dwell > 0) {
          keep.push(p);
          continue;
        }
        p.el.style.opacity = "1";
        if (p.back) {
          p.el.classList.remove("pkt--held");
          p.el.classList.add("pkt--back");
        }
      }
      const l = this.links.get(p.route[p.seg]);
      if (!l) {
        p.el.remove();
        continue;
      }
      p.d += packetSpeed(p.kind, p.speed) * dt;
      const len = l.len || l.el.getTotalLength();
      const [a, b] = travelSpan(len, l.spec.heads, l.spec.style);
      if (p.d >= b - a) {
        const at = l.el.getPointAtLength(p.back ? a : b);
        if (!p.back && Math.random() < (l.spec.fail || 0)) {
          this.burst(at.x, at.y, "fail");
          p.el.remove();
          continue;
        }
        if (!p.back && p.seg < p.route.length - 1) {
          this.hop(p, 1);
          keep.push(p);
          continue;
        }
        if (p.bounce && !p.back) {
          p.back = true;
          p.d = 0;
          if (p.hold) {
            p.dwell = p.hold;
            p.el.classList.add("pkt--held");
          } else p.el.classList.add("pkt--back");
          keep.push(p);
          continue;
        }
        if (p.back && p.seg > 0) {
          this.hop(p, -1);
          keep.push(p);
          continue;
        }
        this.burst(at.x, at.y, "ok");
        p.el.remove();
        continue;
      }
      const pt = l.el.getPointAtLength(p.back ? b - p.d : a + p.d);
      p.el.setAttribute("transform", `translate(${r2(pt.x)} ${r2(pt.y)})`);
      keep.push(p);
    }
    this.packets = keep;
  }

  // ── frame loop ────────────────────────────────────────────────────────────
  private tick(now: number): void {
    const dt = Math.min(DT_CAP_S, (now - this.last) / 1000);
    this.last = now;
    const a = this.anim;
    if (a) {
      const c = a.cam;
      const ct = ease.inOut(clamp01((now - a.start - c.delay) / c.dur));
      this.setCam({ x: lerp(c.from.x, c.to.x, ct), y: lerp(c.from.y, c.to.y, ct), w: lerp(c.from.w, c.to.w, ct), h: lerp(c.from.h, c.to.h, ct) });
      let touched = false;
      for (const [id, e] of [...this.ents]) {
        const tw = e.tween;
        if (!tw) continue;
        const raw = (now - tw.start - tw.delay) / tw.dur;
        if (raw < 0 && !tw.started) continue;
        tw.started = true;
        const o = clamp01(raw);
        const eased = tw.ease(o);
        const from = tw.from as unknown as Bag;
        const to = tw.to as unknown as Bag;
        // Non-numeric props snap at the midpoint; numeric ones interpolate.
        const cur: Bag = tw.remove || o >= 0.5 ? { ...to } : { ...from };
        if (!tw.remove && o < 0.5) cur.cpu = from.cpu;
        for (const key in to) {
          const f = from[key];
          const t = to[key];
          if (typeof f !== "number" || typeof t !== "number" || (key === "cpu" && (f < 0 || t < 0))) continue;
          const k = key === "lift" && tw.liftEase ? tw.liftEase(o) : (key === "count" || key === "n") && tw.countEase ? tw.countEase(o) : eased;
          cur[key] = lerp(f, t, k);
        }
        const fadeOut = 1 - clamp01(o / 0.42);
        const fadeIn = clamp01((o - 0.55) / 0.4);
        if (tw.tagSwap) cur.tagFade = o < 0.5 ? fadeOut : fadeIn;
        if (tw.labelSwap) cur.labelFade = o < 0.5 ? fadeOut : fadeIn;
        if (tw.card) {
          const m = tw.card;
          let w = m.w1;
          let h = m.h1;
          if (m.swap) {
            const st = ease.inOut(clamp01((o - 0.24) / 0.48));
            w = lerp(m.w0, m.w1, st);
            h = lerp(m.h0, m.h1, st);
            cur.boxW = w;
            cur.boxH = h;
            cur.fade = o < 0.5 ? 1 - clamp01(o / 0.24) : clamp01((o - 0.72) / 0.28);
          }
          if (m.keep) Object.assign(cur, this.dockAt(m.keep, w, h));
        }
        e.cur = cur as unknown as Props;
        this.renderEntity(e);
        touched = true;
        if (o >= 1) {
          if (tw.remove) this.removeEntity(id);
          else {
            e.cur = tw.to;
            e.tween = null;
            this.renderEntity(e);
          }
        }
      }
      for (const [id, l] of [...this.links]) {
        const tw = l.tween;
        if (!tw) continue;
        const o = clamp01((now - tw.start - tw.delay) / tw.dur);
        l[tw.key] = lerp(tw.from, tw.to, ease.inOut(o));
        if (o >= 1) {
          if (tw.remove) {
            l.el.remove();
            l.label.remove();
            this.links.delete(id);
          } else l.tween = null;
        }
      }
      if (touched) this.sortDepth();
      if (touched && this.picked) this.drawPick();
      this.updateLinks();
      if (now >= a.end) {
        this.anim = null;
        this.updateLinks(true);
        this.settle(a);
      }
    }
    if (this.blend && !this.anim) this.setCam(this.cam);
    if (!this.paused) this.stepPackets(dt);
  }
}
