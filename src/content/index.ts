// Content contract — the ONLY part of the replica that differs from the original.
// Implemented by: course.ts (modules), lessons/*.json (lesson data), registries.ts (metrics, legend,
// chapters, callouts, levels — original registries, doc 11 §5, §6, §8).
import type { Course, FlatLessonRef, Lesson } from "../types/lesson";
import { COURSE, FREE_MODULES } from "./course";
import { LESSONS } from "./lessons";

export { COURSE } from "./course";
export { METRICS, LEGEND, CHAPTERS, CALLOUTS, LEVELS } from "./registries";
export type { MetricDef, LegendDef, ChapterDef, CalloutDef } from "./registries";

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

/** Lesson data. Original fetches Pro lessons from /pro-lessons/<id>.json; all replica lessons are bundled. */
export function getLesson(id: string): Lesson | undefined {
  return LESSONS[id];
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
