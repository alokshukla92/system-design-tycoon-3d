// Facts about the course derived from the lesson data (src/content/**), used by the static copy.
import { COURSE, FLAT, getLesson } from "../content";
import type { Lesson } from "../types/lesson";
import { homeHref } from "./routes";

const strip = (html: string): string => html.replace(/<[^>]+>/g, "");

export const LESSONS: Lesson[] = FLAT.map((l) => getLesson(l.id)).filter((l): l is Lesson => !!l);

export const lessonCount = FLAT.length;
export const moduleCount = COURSE.length;
export const stepCount = LESSONS.reduce((n, l) => n + l.steps.length, 0);
export const totalMinutes = LESSONS.reduce((n, l) => n + (l.minutes || 0), 0);

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** Fictional products the lessons follow ("linkly — a URL shortener…" → "linkly"), in course order. */
export const products: string[] = [
  ...new Set(
    LESSONS.map((l) => strip(l.summary ?? "").split(" — ")[0]?.trim() ?? "").filter((p) => p && !/\s/.test(p)),
  ),
];

/** The technique each lesson teaches: its middle goal ("Caching — and the stampede…" → "Caching"). */
export const techniques: string[] = LESSONS.map((l) => {
  const g = l.goals[Math.min(1, l.goals.length - 1)]?.text ?? l.title;
  return strip(g).split(" — ")[0].trim();
});

export const lessonHref = (id: string): string => `${homeHref()}#/${id}/1`;

export const first = FLAT[0];
export const last = FLAT[FLAT.length - 1];
/** A lesson from the middle of the course, used for the "closer look" example. */
export const featured = FLAT[Math.floor((FLAT.length - 1) / 2)];

export const summaryText = (id: string): string => strip(getLesson(id)?.summary ?? "");

/** "a, b and c". */
export const listJoin = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
