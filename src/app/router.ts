// Hash routing (#/<lessonId>/<1-based step>) and Pro gating, as in the original controller.
import { DEFAULT_LESSON_ID, FLAT, getLesson, isFreeLesson, lessonRef } from "../content";
import { storage } from "./storage";
import type { RecentEntry } from "./store";

const HASH_RE = /^#\/([\w-]+)\/(\d+)$/;

/** Whether any module is configured as free. Without a free tier, nothing is locked. */
const HAS_FREE_TIER = FLAT.some((l) => isFreeLesson(l.id));

/** The replica has no payments, so Pro is never active. */
export const hasPro = (): boolean => false;

export const isLocked = (id: string): boolean => HAS_FREE_TIER && !isFreeLesson(id) && !hasPro();

/** A lesson can be opened when it's listed in the course and its data is bundled. */
export const isAvailable = (id: string): boolean => !!lessonRef(id) && !!getLesson(id);

/** Default landing lesson: the configured default, else the first available one. */
export function defaultLessonId(): string {
  if (DEFAULT_LESSON_ID && isAvailable(DEFAULT_LESSON_ID) && !isLocked(DEFAULT_LESSON_ID)) return DEFAULT_LESSON_ID;
  return FLAT.find((l) => isAvailable(l.id) && !isLocked(l.id))?.id ?? "";
}

export const hrefFor = (lessonId: string, step: number): string => `#/${lessonId}/${step + 1}`;

/** Resolve the route from the hash: valid hash → saved `sdt:last` → default lesson, step 0. */
export function resolveRoute(): RecentEntry {
  const m = HASH_RE.exec(location.hash);
  if (m && lessonRef(m[1])) return { lessonId: m[1], step: Math.max(0, Number(m[2]) - 1) };
  const saved = storage.get<RecentEntry | null>("last", null);
  if (saved && lessonRef(saved.lessonId)) return saved;
  return { lessonId: defaultLessonId(), step: 0 };
}

export function go(lessonId: string, step: number): void {
  location.hash = hrefFor(lessonId, step);
}

// ── Practice / Design Lab routes (#/lab, #/practice[/<tab>], #/play/<mode>/<id>) ──────────────────
export type PracticeTab = "campaign" | "incident" | "interview";
export type LabRoute =
  | { view: "lab" }
  | { view: "practice"; tab: PracticeTab }
  | { view: "play"; mode: PracticeTab; id: string };

const LAB_RE = /^#\/lab\/?$/;
const PRACTICE_RE = /^#\/practice(?:\/(campaign|incident|interview))?\/?$/;
const PLAY_RE = /^#\/play\/(campaign|incident|interview)\/([\w-]+)\/?$/;

export function labRoute(hash: string = location.hash): LabRoute | null {
  if (LAB_RE.test(hash)) return { view: "lab" };
  let m = PRACTICE_RE.exec(hash);
  if (m) return { view: "practice", tab: (m[1] as PracticeTab | undefined) ?? "campaign" };
  m = PLAY_RE.exec(hash);
  if (m) return { view: "play", mode: m[1] as PracticeTab, id: m[2] };
  return null;
}

export const isLabHash = (hash: string = location.hash): boolean => labRoute(hash) !== null;

/** "Learn" nav target: the last lesson visited, else the default lesson. */
export function learnHref(): string {
  const saved = storage.get<RecentEntry | null>("last", null);
  if (saved && lessonRef(saved.lessonId)) return hrefFor(saved.lessonId, saved.step);
  return hrefFor(defaultLessonId(), 0);
}
