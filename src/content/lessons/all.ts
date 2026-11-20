// Every lesson, fully loaded (eager). Tests and Node-side checks only — the app loads lessons on demand
// through loadLesson() (../index.ts) so they stay out of the main bundle.
import type { Lesson } from "../../types/lesson";

const FILES = import.meta.glob<Lesson>("./*.json", { import: "default", eager: true });

export const LESSONS: Record<string, Lesson> = Object.fromEntries(Object.values(FILES).map((l) => [l.id, l]));
