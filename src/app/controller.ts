// Imperative classroom controller: routing → state, engine wiring, and the DOM animations that the
// original drove by hand (guide slide, chip count-up, fresh sections, sidebar scroll, title shrink).
import { flushSync } from "react-dom";
import { METRICS, getLesson, lessonRef, loadLesson, nextLesson, prefetchLesson } from "../content";
import type { EngineApi } from "../engine";
import { isRtl, t } from "../i18n";
import type { Lesson, MetricValue } from "../types/lesson";
import { defaultLessonId, go, hrefFor, isAvailable, isLabHash, isLocked, resolveRoute } from "./router";
import { storage } from "./storage";
import { getState, setState, showToast } from "./store";
import type { Layout, Theme } from "./store";

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const reflow = (el: Element) => void (el as HTMLElement).offsetWidth;

let engine: EngineApi | null = null;
/** Last displayed metric values for the current lesson (count-up source). */
let shownMetrics: Record<string, MetricValue> = {};
let lastChapter: string | null = null;
/** Lesson to scroll to the top of the sidebar after a search pick. */
let reveal: string | null = null;
let rendered = false;
/** Route revision: a lesson chunk that arrives after a newer navigation is discarded (original: same counter). */
let routeRev = 0;

export const getEngine = () => engine;

export function attachEngine(e: EngineApi): void {
  engine = e;
  e.onCards = (docked) => document.documentElement.classList.toggle("cards-inline", !docked);
  e.onView = (manual) => setState({ manualView: manual });
  e.onSwipe = (dir) => {
    const { lessonId, step } = getState();
    const lesson = lessonId ? getLesson(lessonId) : undefined;
    if (!lesson) return;
    const n = step + dir * (isRtl() ? -1 : 1);
    if (n >= 0 && n < lesson.steps.length) go(lesson.id, n);
  };
}

export function detachEngine(): void {
  engine = null;
}

export const currentLesson = (): Lesson | undefined => {
  const id = getState().lessonId;
  return id ? getLesson(id) : undefined;
};

/** Search picked a result: scroll its lesson to the top of the sidebar. */
export function revealLesson(lessonId: string, href: string): void {
  if (location.hash === href) scrollLessonIntoView(lessonId, true);
  else reveal = lessonId;
}

/** Re-render the current lesson from scratch (the lesson stage was remounted, e.g. after the Design Lab). */
export function rerouteFresh(): void {
  setState({ lessonId: null });
  route();
}

// ── Route → render ───────────────────────────────────────────────────────────
export function route(): void {
  if (isLabHash()) return;
  const rev = ++routeRev;
  const prev = getState();
  let { lessonId, step } = resolveRoute();

  if (lessonId && isLocked(lessonId)) {
    setState({ upgradeOpen: true });
    lessonId = prev.lessonId && !isLocked(prev.lessonId) ? prev.lessonId : defaultLessonId();
    step = prev.lessonId === lessonId ? prev.step : 0;
    if (lessonId) history.replaceState(null, "", hrefFor(lessonId, step));
  }

  const lesson = lessonId ? getLesson(lessonId) : undefined;
  if (!lesson && lessonId && isAvailable(lessonId)) {
    // Not loaded yet: keep the current lesson on screen, fetch its chunk, then route again.
    const id = lessonId;
    if (prev.loadingLesson !== id) setState({ loadingLesson: id });
    loadLesson(id).then(
      () => {
        if (rev === routeRev) route();
      },
      (err: unknown) => {
        if (rev !== routeRev) return;
        console.warn(`[lesson] could not load "${id}"`, err);
        setState({ loadingLesson: null });
        lessonFailed(id);
      },
    );
    return;
  }
  if (prev.loadingLesson) setState({ loadingLesson: null });
  if (!lesson) {
    if (lessonId) lessonFailed(lessonId);
    else if (!prev.lessonId) fallBack(lessonId);
    return;
  }

  step = Math.min(step, lesson.steps.length - 1);
  const ref = lessonRef(lesson.id)!;
  const changed = lesson.id !== prev.lessonId;
  const prevStep = prev.lessonId ? prev.step : null;

  storage.set("last", { lessonId: lesson.id, step });
  const recent = [{ lessonId: lesson.id, step }, ...prev.recent.filter((r) => r.lessonId !== lesson.id)].slice(0, 8);
  storage.set("recent", recent);
  let done = prev.done;
  if (step === lesson.steps.length - 1 && !done.has(lesson.id)) {
    done = new Set(done).add(lesson.id);
    storage.set("done", [...done]);
  }

  // Snapshot the outgoing guide copy before React replaces it.
  const dir = (changed || prevStep == null ? 0 : Math.sign(step - prevStep)) * (isRtl() ? -1 : 1);
  const oldContent = dir ? $("#guide .guide__content") : null;
  const ghost = oldContent?.cloneNode(true) as HTMLElement | undefined;
  const box = oldContent && {
    top: oldContent.offsetTop,
    left: oldContent.offsetLeft,
    width: oldContent.offsetWidth,
    height: oldContent.offsetHeight,
    scroll: oldContent.scrollTop,
  };
  document.querySelectorAll("#guide .guide__ghost").forEach((g) => g.remove());

  if (changed) shownMetrics = {};
  flushSync(() =>
    setState({
      lessonId: lesson.id,
      step,
      recent,
      done,
      ...(changed ? { openModule: ref.module.id } : null),
    }),
  );

  const scenes = lesson.steps.map((s) => s.scene);
  if (changed) {
    if (rendered) {
      const sections = ["#head", "#legend", "#timeline", "#hud", "#goals"].map((s) => $(s)).filter(Boolean) as HTMLElement[];
      sections.forEach((s) => s.classList.remove("is-fresh"));
      if (sections[0]) reflow(sections[0]);
      sections.forEach((s) => s.classList.add("is-fresh"));
    }
    engine?.clear();
    engine?.frame(scenes);
    engine?.goTo(scenes[step]);
    shrinkTitles();
    rendered = true;
  } else if (step !== prevStep) {
    engine?.goTo(scenes[step]);
  }

  if (reveal) scrollLessonIntoView(lesson.id, true);
  else if (changed) scrollLessonIntoView(lesson.id, false);
  reveal = null;
  checkTimelineTight();

  engine?.svg.setAttribute("aria-label", `${lesson.title} — ${lesson.steps[step].title}`);
  updateMetrics(lesson, lesson.steps[step].metrics, !changed);

  const content = $("#guide .guide__content");
  if (content) {
    content.style.setProperty("--slide", `${dir * 36}px`);
    content.classList.remove("is-in");
    reflow(content);
    content.classList.add("is-in");
  }
  const chapter = $("#guide .guide__meta .chapter");
  if (chapter && dir && lastChapter !== lesson.steps[step].chapter) {
    chapter.style.setProperty("--slide", `${dir * 14}px`);
    chapter.classList.add("is-in");
  }
  lastChapter = lesson.steps[step].chapter;

  if (ghost && box) {
    ghost.className = "guide__content guide__ghost";
    ghost.style.cssText = `top:${box.top}px;left:${box.left}px;width:${box.width}px;height:${box.height}px;--slide:${-dir * 36}px`;
    $("#guide")?.appendChild(ghost);
    ghost.scrollTop = box.scroll;
    setTimeout(() => ghost.remove(), 200);
  }

  prefetchLesson(nextLesson(lesson.id)?.id);
}

/** Original error path: toast, and on first load (nothing on screen yet) go to the default lesson. */
function lessonFailed(lessonId: string): void {
  showToast(t("This lesson could not be loaded. Please try again."));
  if (!getState().lessonId) fallBack(lessonId);
}

function fallBack(failed: string | null): void {
  const fallback = defaultLessonId();
  if (fallback && fallback !== failed) go(fallback, 0);
}

// ── Sidebar scroll (640 ms easeInOutCubic; a wheel cancels it) ───────────────
let scrollRaf = 0;

function offsetWithin(el: HTMLElement, root: HTMLElement): number {
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}

export function scrollLessonIntoView(lessonId: string, toTop: boolean): void {
  const ref = lessonRef(lessonId);
  if (!ref) return;
  if (getState().openModule !== ref.module.id) flushSync(() => setState({ openModule: ref.module.id }));
  const course = $("#course");
  const row = course?.querySelector<HTMLElement>(`.lesson[data-lesson="${CSS.escape(lessonId)}"]`);
  if (!course || !row) return;
  cancelAnimationFrame(scrollRaf);
  const from = course.scrollTop;
  const t0 = performance.now();
  // Target is recomputed each frame because the module body is still expanding.
  const target = () => {
    const y = offsetWithin(row, course);
    const max = course.scrollHeight - course.clientHeight;
    const clamp = (v: number) => Math.max(0, Math.min(max, v));
    if (toTop) return clamp(y - 6);
    if (y >= from + 4 && y + row.offsetHeight <= from + course.clientHeight - 4) return from;
    return clamp(y < from ? y - 6 : y + row.offsetHeight - course.clientHeight + 10);
  };
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / 640);
    const e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
    course.scrollTop = from + (target() - from) * e;
    if (p < 1) scrollRaf = requestAnimationFrame(tick);
  };
  scrollRaf = requestAnimationFrame(tick);
}

export const cancelSidebarScroll = () => cancelAnimationFrame(scrollRaf);

// ── Lesson head auto-shrink ──────────────────────────────────────────────────
function shrink(el: HTMLElement | null, min: number): void {
  if (!el) return;
  el.style.fontSize = "";
  const ratio = el.scrollWidth / el.clientWidth;
  if (!(ratio > 1.002)) return;
  const fs = parseFloat(getComputedStyle(el).fontSize);
  el.style.fontSize = `${(fs * Math.max(min, 1 / ratio) - 0.05).toFixed(2)}px`;
}

export function shrinkTitles(): void {
  shrink($("#head .title"), 0.8);
  shrink($("#head .subtitle"), 0.88);
}

export function checkTimelineTight(): void {
  const steps = $(".timeline__steps");
  if (!steps) return;
  const w = steps.clientWidth / Math.max(1, steps.children.length);
  $("#timeline")?.classList.toggle("is-tight", w > 0 && w < 70);
}

// ── Metric chips ─────────────────────────────────────────────────────────────
const chipAnim = new WeakMap<HTMLElement, object>();

function formatMetric(key: string, v: MetricValue): string {
  const def = METRICS[key];
  if (!def) return v == null ? "—" : String(v);
  if (v == null) return def.nullText ?? "—";
  try {
    return String((def.fmt as (x: unknown) => unknown)(v) ?? "");
  } catch {
    return String(v);
  }
}

function updateMetrics(lesson: Lesson, values: Record<string, MetricValue>, sameLesson: boolean): void {
  for (const key of lesson.metrics) {
    const chip = document.querySelector<HTMLElement>(`.chip[data-k="${CSS.escape(key)}"]`);
    const valueEl = chip?.querySelector<HTMLElement>(".chip__value");
    if (!chip || !valueEl) continue;
    const def = METRICS[key];
    const next = values[key] ?? null;
    const prev = shownMetrics[key];
    chip.dataset.level = def?.level ? def.level(next) : "none";
    shownMetrics[key] = next;

    const changed = prev !== undefined && prev !== next;
    if (changed && sameLesson) {
      chip.classList.remove("is-changed");
      reflow(chip);
      chip.classList.add("is-changed");
    }
    const fromW = chip.offsetWidth;
    chip.style.width = "";
    valueEl.textContent = formatMetric(key, next);
    const toW = chip.offsetWidth;
    const countUp = sameLesson && typeof prev === "number" && typeof next === "number" && prev !== next;
    if (!sameLesson || (!countUp && fromW === toW)) {
      chipAnim.delete(chip);
      continue;
    }
    if (countUp) valueEl.textContent = formatMetric(key, prev);
    else if (changed) {
      valueEl.classList.remove("is-swap");
      reflow(valueEl);
      valueEl.classList.add("is-swap");
    }
    chip.style.width = `${fromW}px`;
    const token = {};
    chipAnim.set(chip, token);
    const t0 = performance.now();
    const dur = countUp ? 900 : 480;
    const frame = (now: number) => {
      if (chipAnim.get(chip) !== token) return;
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - p) ** 3;
      if (countUp) valueEl.textContent = formatMetric(key, (prev as number) + ((next as number) - (prev as number)) * e);
      chip.style.width = `${fromW + (toW - fromW) * e}px`;
      if (p < 1) requestAnimationFrame(frame);
      else {
        chip.style.width = "";
        valueEl.textContent = formatMetric(key, next);
      }
    };
    requestAnimationFrame(frame);
  }
}

// ── Tools ────────────────────────────────────────────────────────────────────
export function replay(): void {
  const lesson = currentLesson();
  if (!lesson || !engine) return;
  const { step } = getState();
  const before = lesson.steps[step - 1];
  if (before) engine.goTo(before.scene, { instant: true });
  else engine.clear();
  engine.goTo(lesson.steps[step].scene);
}

export function togglePause(): void {
  if (!engine) return;
  engine.paused = !engine.paused;
  setState({ paused: engine.paused });
}

export function fit(): void {
  engine?.fit();
}

// ── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  storage.set("theme", theme);
  syncThemeColor();
  engine?.retheme();
  flushSync(() => setState({ theme }));
}

export function syncThemeColor(): void {
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#f4ebe0";
  $("meta[name=\"theme-color\"]")?.setAttribute("content", paper);
}

export function toggleTheme(origin: HTMLElement): void {
  const next: Theme = getState().theme === "dark" ? "light" : "dark";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduced) {
    applyTheme(next);
    return;
  }
  const r = origin.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(() => applyTheme(next)).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 560, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

// ── Drawer / full screen ─────────────────────────────────────────────────────
export function setDrawer(open: boolean): void {
  const root = document.documentElement;
  if (open === root.classList.contains("is-drawer")) return;
  root.classList.toggle("is-drawer", open);
  setState({ drawer: open });
  if (open) {
    const id = getState().lessonId;
    if (id) scrollLessonIntoView(id, false);
    setTimeout(() => $("#drawer-close")?.focus({ preventScroll: true }), 50);
  } else if (document.activeElement && $("#sidebar")?.contains(document.activeElement)) {
    $("#menu-btn")?.focus({ preventScroll: true });
  }
}

export function setFull(full: boolean): void {
  const stage = $(".stage");
  if (!stage || stage.classList.contains("is-full") === full) return;
  stage.classList.toggle("is-full", full);
  document.documentElement.classList.toggle("has-full", full);
  setState({ full });
}

// ── Layout (desktop canvas zoom) ─────────────────────────────────────────────
const CANVAS = { w: 1672, h: 920 };

export const layoutFor = (w: number, h: number): Layout =>
  w >= 1200 && h >= 560 ? "desktop" : w >= 960 && h >= 600 ? "tablet" : "stack";

export function applyLayout(): void {
  const layout = layoutFor(innerWidth, innerHeight);
  document.documentElement.dataset.layout = layout;
  const win = $(".window");
  if (win) {
    if (layout === "desktop") {
      const zoom = Math.min(1, innerWidth / CANVAS.w, innerHeight / CANVAS.h);
      win.style.zoom = String(zoom);
      win.style.width = `${innerWidth / zoom}px`;
      win.style.height = `${innerHeight / zoom}px`;
      setDrawer(false);
      setFull(false);
    } else {
      win.style.zoom = "";
      win.style.width = "";
      win.style.height = "";
    }
  }
  if (getState().layout !== layout) setState({ layout });
  checkTimelineTight();
  shrinkTitles();
  engine?.refit();
}
