// Derived lesson data, computed at build time by the `lessonData` Vite plugin (vite.config.ts) so the main
// bundle never carries step bodies or scenes:
//   ./lessons/<id>.json?lesson-meta   → LessonMeta    (eager: sidebar facts, static pages, routing)
//   ./lessons/<id>.json?lesson-search → SearchLesson  (lazy: search corpus, loaded on first search open)
// Pure and import-free: it also runs in Node (vite.config.ts), so input types are structural.

export interface LessonMeta {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  level: string;
  stepCount: number;
  /** Goal texts, in order. */
  goals: string[];
}

/** Step fields the search index uses, pre-flattened to plain text. */
export interface SearchStep {
  title: string;
  short: string;
  chapter: string;
  body: string;
  callout: string;
  changes: string;
  panel: string;
  labels: string;
  /** `<span class="term">` concepts in the body: [term, sentence containing it]. */
  terms: [term: string, sentence: string][];
}

export interface SearchLesson {
  id: string;
  title: string;
  summary: string;
  /** Goal texts joined by spaces. */
  goals: string;
  steps: SearchStep[];
}

// Structural subset of types/lesson.ts Lesson.
type Obj = Record<string, unknown>;
interface LessonLike {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  level: string;
  goals: { text: string }[];
  steps: {
    title: string;
    short: string;
    chapter: string;
    body: string[];
    callout?: { text: string };
    changes?: string[];
    scene: { entities: Record<string, unknown>; links?: Record<string, unknown> };
  }[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Lesson body HTML → plain text (footnotes dropped, list/table items joined with " · "). */
export function htmlToText(html: string | undefined = ""): string {
  return String(html)
    .replace(/<sup>[\s\S]*?<\/sup>/gi, "")
    .replace(/<\/(li|tr)>/gi, " · ")
    .replace(/<\/(p|td|th|div)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, ent: string) =>
      ent[0] === "#"
        ? String.fromCodePoint(ent[1] === "x" ? parseInt(ent.slice(2), 16) : +ent.slice(1))
        : (ENTITIES[ent] ?? m),
    )
    .replace(/(\s*·\s*)+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const panelLine = (s: string) => s.replace(/^[=!#] /, "").replace(/\*\*/g, "");

/** The sentence of `text` that contains `term`. */
export function sentenceAround(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text;
  const a = text.lastIndexOf(". ", i);
  const b = text.indexOf(". ", i + term.length);
  return text.slice(a < 0 ? 0 : a + 2, b < 0 ? text.length : b + 1).trim();
}

export function lessonMeta(lesson: LessonLike): LessonMeta {
  return {
    id: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    minutes: lesson.minutes,
    level: lesson.level,
    stepCount: lesson.steps.length,
    goals: lesson.goals.map((g) => g.text),
  };
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

export function searchLesson(lesson: LessonLike): SearchLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    goals: lesson.goals.map((g) => g.text).join(" "),
    steps: lesson.steps.map((step) => {
      const entities = Object.values(step.scene.entities) as Obj[];
      const panel = entities
        .filter((e) => e.type === "panel")
        .map((p) =>
          [
            p.title,
            ...((p.lines as string[] | undefined) ?? []).map(panelLine),
            ...((p.bars as { label: string; note?: string }[] | undefined) ?? []).map((b) => `${b.label} ${b.note || ""}`),
          ].join(" "),
        )
        .join(" ");
      const labels = [
        ...entities.flatMap((e) => [
          ...(Array.isArray(e.label) ? (e.label as unknown[]) : [e.label]),
          e.sub,
          ...(Array.isArray(e.tags) ? (e.tags as { text?: unknown }[]).map((t) => t.text) : []),
        ]),
        ...Object.values((step.scene.links ?? {}) as Record<string, Obj>).map((l) => l.label),
      ]
        .map(str)
        .filter((s): s is string => !!s)
        .join(" ");
      const terms: [string, string][] = [];
      for (const para of step.body)
        for (const m of para.matchAll(/<span class="term">([\s\S]*?)<\/span>/g)) {
          const term = htmlToText(m[1]);
          terms.push([term, sentenceAround(htmlToText(para), term)]);
        }
      return {
        title: step.title,
        short: step.short,
        chapter: step.chapter,
        body: step.body.map(htmlToText).join(" "),
        callout: htmlToText(step.callout?.text),
        changes: (step.changes ?? []).map((c) => c.replace(/^[+~−-]\s*/, "")).join(" "),
        panel,
        labels,
        terms,
      };
    }),
  };
}
