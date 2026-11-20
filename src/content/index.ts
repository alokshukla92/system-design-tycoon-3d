// Content contract — the ONLY part of the replica that differs from the original.
// Implemented by: course.ts (modules), lessons/*.json (lesson data, loaded on demand), registries.ts (metrics, legend,
// chapters, callouts, levels — original registries, doc 11 §5, §6, §8).
import type { Course, FlatLessonRef, Lesson } from "../types/lesson";
import { COURSE, FREE_MODULES } from "./course";
import type { LessonMeta } from "./derive";
import { LOADERS, META } from "./lessons";

export { COURSE } from "./course";
export { METRICS, LEGEND, CHAPTERS, CALLOUTS, LEVELS } from "./registries";
export type { MetricDef, LegendDef, ChapterDef, CalloutDef } from "./registries";
export type { LessonMeta } from "./derive";

export const course: Course = COURSE;

/** Flat ordered list of lesson refs across all modules (doc 11 §1 "derived at runtime"). */
export const FLAT: FlatLessonRef[] = COURSE.flatMap((module) =>
  module.lessons.map((ref, i) => ({ ...ref, module, index: i + 1, of: module.lessons.length })),
);

export function lessonRef(id: string): FlatLessonRef | undefined {
  return FLAT.find((l) => l.id === id);
}

/** Free = module listed in FREE_MODULES (original: module id "foundations"). */
export function isFreeLesson(id: string): boolean {
  const ref = lessonRef(id);
  return !!ref && FREE_MODULES.includes(ref.module.id);
}

// ── Lesson data ──────────────────────────────────────────────────────────────
// Original: free lessons are bundled, Pro lessons are fetched from /pro-lessons/<id>.json on navigation.
// Replica: every lesson is its own lazily imported chunk; only LessonMeta is in the main bundle.

/** Build-time metadata (title, summary, minutes, step count, goals) — available synchronously for every lesson. */
export function lessonMeta(id: string): LessonMeta | undefined {
  return META[id];
}

/** Whether lesson data exists for this id (it may not be loaded yet). */
export function hasLesson(id: string): boolean {
  return id in META && id in LOADERS;
}

const loaded = new Map<string, Lesson>();
const loading = new Map<string, Promise<Lesson>>();

/** The lesson if it has been loaded, else undefined (see loadLesson). */
export function getLesson(id: string): Lesson | undefined {
  return loaded.get(id);
}

/** Load a lesson's chunk (cached; a failed load is retried on the next call). */
export function loadLesson(id: string): Promise<Lesson> {
  const done = loaded.get(id);
  if (done) return Promise.resolve(done);
  let p = loading.get(id);
  if (!p) {
    const load = LOADERS[id] as (() => Promise<Lesson>) | undefined;
    p = load
      ? load().then(
          (lesson) => {
            loaded.set(id, lesson);
            loading.delete(id);
            return lesson;
          },
          (err: unknown) => {
            loading.delete(id);
            throw err;
          },
        )
      : Promise.reject(new Error(`Unknown lesson "${id}"`));
    if (load) loading.set(id, p);
  }
  return p;
}

/** Warm the cache for a lesson the user is likely to open next; failures are ignored. */
export function prefetchLesson(id: string | undefined): void {
  if (id && hasLesson(id) && !loaded.has(id)) loadLesson(id).catch(() => {});
}

export function nextLesson(id: string): FlatLessonRef | undefined {
  const i = FLAT.findIndex((l) => l.id === id);
  return i >= 0 ? FLAT[i + 1] : undefined;
}

export function prevLesson(id: string): FlatLessonRef | undefined {
  const i = FLAT.findIndex((l) => l.id === id);
  return i > 0 ? FLAT[i - 1] : undefined;
}

/** Default lesson when there is no hash and no sdt:last (original: first lesson). */
export const DEFAULT_LESSON_ID = FLAT[0]?.id ?? "";
