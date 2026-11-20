// Client-side lesson search (doc 07 §6; original JS L5306-5725).
// Pure: building and querying the index has no DOM / storage dependencies.
import type { Chapter, Lesson, Module } from "../types/lesson";
import { lessonRef } from "../content";

// ── Constants ────────────────────────────────────────────────────────────────
/** Platform shortcut label shown in the topbar `kbd`. */
export const SEARCH_SHORTCUT =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘K" : "Ctrl K";

/** Max results shown per group. */
export const GROUP_CAPS = { lesson: 6, concept: 5, step: 25 } as const;

/** Suggestion chips in the no-results state. */
export const SUGGESTIONS = ["load balancer", "cache", "replication", "consistent hashing", "rate limit", "websocket", "sagas", "quorum"];

const STOPWORD_LISTS = [
  "a an the of to in on for and or is are be how what why when does do with vs versus my it by at as from into that this i",
  "el la los las un una unos unas de del al y o u en es son ser que qué como cómo por para con sin se su sus lo le mi cuando cuándo donde dónde",
  "os as um uma do da dos das no na nos nas e ou em é são por sem",
  "le les une des du d l et est sont qui quoi comment pour par avec sans ce cette",
  "il lo gli di della dello è sono che per senza",
  "der die das den dem des ein eine einen und oder im ist sind wie was warum für mit ohne von zu zum zur",
  "het een en of hoe wat waarom voor met zonder van te zijn",
  "w na z do jak co czy dla jest się od po",
  "ve veya bir bu ne nasıl neden için ile mi nedir",
  "dan atau yang ke dari untuk dengan apa bagaimana adalah ini itu",
  "là và của có một những các cho với như thế nào gì",
  "ο η το οι τα ένα μια και ή σε του της των για με πώς τι είναι",
  "и в на с по что как это для из к о а или не",
  "і в на з по що як це для до та або не",
  "का की के है और में से को एक क्या कैसे यह",
  "في من على إلى و أو ما كيف هو هي هذا هذه عن مع",
  "של ה ו ב ל מה איך זה עם על את או",
];

const LETTER_MAP: Record<string, string> = {
  ł: "l", ı: "i", ß: "ss", đ: "d", ø: "o", æ: "ae", œ: "oe", ς: "σ", ى: "ي", ة: "ه",
};

const SYNONYMS: Record<string, string[]> = {
  db: ["database"], dbs: ["database"], lb: ["balancer"], lbs: ["balancer"], k8s: ["kubernetes"],
  mq: ["queue"], msg: ["message"], msgs: ["message"], ws: ["websocket"], tx: ["transaction"],
  txn: ["transaction"], txns: ["transaction"], authn: ["authentication"], authz: ["authorization"],
  kv: ["keyvalue"], "2pc": ["twophase"], e2e: ["endtoend"], e2ee: ["endtoend"],
  perf: ["latency", "performance"], ha: ["availability"], sso: ["single"], wal: ["writeahead"],
  lsm: ["logstructured"],
};

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
const CJK_RUNS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+/gu;
const isCjk = (s: string) => CJK.test(s);

// ── Text helpers ─────────────────────────────────────────────────────────────
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

/** Case/diacritic fold used for both indexing and querying. */
export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05c7\u0640\u064b-\u065f\u0670]/g, "")
    .normalize("NFC")
    .replace(/[’'‘`]/g, "")
    .toLowerCase()
    .replace(/[łıßđøæœςىة]/g, (c) => LETTER_MAP[c]);
}

const STOPWORDS = new Set(STOPWORD_LISTS.join(" ").split(" ").map(fold));

/** Tokens: letter/number runs; CJK runs → unigram (if single) + bigrams; hyphen/slash compounds also joined. */
export function tokenize(text: string): string[] {
  const f = fold(text);
  const out: string[] = [];
  for (const [word] of f.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    if (!isCjk(word)) {
      out.push(word);
      continue;
    }
    let at = 0;
    for (const m of word.matchAll(CJK_RUNS)) {
      const idx = m.index ?? 0;
      if (idx > at) out.push(word.slice(at, idx));
      const run = m[0];
      if (run.length === 1) out.push(run);
      for (let i = 0; i + 1 < run.length; i++) out.push(run.slice(i, i + 2));
      at = idx + run.length;
    }
    if (at < word.length) out.push(word.slice(at));
  }
  for (const c of f.match(/[\p{L}\p{M}\p{N}]+(?:[-–/][\p{L}\p{M}\p{N}]+)+/gu) ?? []) {
    if (!isCjk(c)) out.push(c.replace(/[-–/]/g, ""));
  }
  return out;
}

/** Light suffix stemmer (tokens longer than 4 chars without digits). */
export function stem(t: string): string {
  if (t.length <= 4 || /\d/.test(t)) return t;
  const s = t.replace(/ies$/, "y").replace(/(ing|ed|es|s|e)$/, "");
  return s.length >= 3 ? s : t;
}

/** Bounded optimal-string-alignment distance; returns max+1 once it exceeds max. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] | null = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let c = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) c = Math.min(c, prev2[j - 2] + 1);
      cur[j] = c;
      rowMin = Math.min(rowMin, c);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** Match quality between a vocabulary term (and its stem) and a query term (and its stem). */
function termMatch(vocab: string, vocabStem: string, q: string, qStem: string): number {
  if (vocab === q) return 1;
  if (vocabStem === qStem) return 0.95;
  if (vocab.startsWith(q)) return q.length < 3 ? 0.6 : 0.85;
  if (qStem.length >= 3 && vocabStem.startsWith(qStem)) return 0.75;
  if (vocabStem.length >= 6 && qStem.length - vocabStem.length <= 3 && qStem.startsWith(vocabStem)) return 0.7;
  if (q.length >= 4 && vocab.includes(q)) return 0.45;
  return 0;
}

// ── Highlighting & snippets ──────────────────────────────────────────────────
export type Range = [start: number, end: number];

/** Merged [start, end) ranges of words in `text` whose folded form is in `matched`. */
export function highlightRanges(text: string, matched: ReadonlySet<string> | null | undefined): Range[] {
  const hits: Range[] = [];
  if (!matched || !matched.size) return hits;
  for (const m of text.matchAll(/[\p{L}\p{M}\p{N}’'‘`]+/gu)) {
    const i = m.index ?? 0;
    if (matched.has(fold(m[0]))) hits.push([i, i + m[0].length]);
  }
  for (const t of matched) {
    if (!isCjk(t)) continue;
    for (let i = text.indexOf(t); i >= 0; i = text.indexOf(t, i + 1)) hits.push([i, i + t.length]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h[0] <= last[1]) last[1] = Math.max(last[1], h[1]);
    else merged.push([h[0], h[1]]);
  }
  return merged;
}

export const escapeHtml = (s: string | number) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escaped HTML of `text` with `<mark>` around matched words. */
export function highlightHtml(text: string, matched: ReadonlySet<string> | null | undefined): string {
  let out = "";
  let at = 0;
  for (const [s, e] of highlightRanges(text, matched)) {
    out += `${escapeHtml(text.slice(at, s))}<mark>${escapeHtml(text.slice(s, e))}</mark>`;
    at = e;
  }
  return out + escapeHtml(text.slice(at));
}

/** ≤ `max`-char excerpt positioned so the first hit is visible (with "…" on cut sides). */
export function snippet(text: string, matched: ReadonlySet<string> | null | undefined, max = 190): string {
  const first = highlightRanges(text, matched)[0]?.[0] ?? -1;
  if (first < 60) return text.length > max ? `${text.slice(0, text.lastIndexOf(" ", max))}…` : text;
  let start = text.lastIndexOf(" ", first - 34);
  start = start < 0 ? 0 : start + 1;
  const sentence = text.lastIndexOf(". ", first);
  if (sentence >= 0 && sentence + 2 > start && sentence + 2 <= first) start = sentence + 2;
  const end = start + max < text.length ? text.lastIndexOf(" ", start + max) : text.length;
  const body = text.slice(start, end).replace(/^[\s·]+/, "");
  return `${start ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

/** Sentence of `text` containing `term` (case-insensitive), or the whole text. */
function sentenceAround(text: string, term: string): string {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text;
  const a = text.lastIndexOf(". ", i);
  const b = text.indexOf(". ", i + term.length);
  return text.slice(a < 0 ? 0 : a + 2, b < 0 ? text.length : b + 1).trim();
}

// ── Index ────────────────────────────────────────────────────────────────────
export type DocKind = "lesson" | "concept" | "step";
export type FieldName =
  | "title" | "summary" | "module" | "goals"
  | "short" | "body" | "callout" | "changes" | "panel" | "labels" | "lesson"
  | "term" | "sentence";

/** [text, weight, isKey] — a match in at least one key field is required. */
type Field = [name: FieldName, text: string, weight: number, key: boolean];

interface DocBase {
  lessonId: string;
  /** 0-based step index the result opens at. */
  step: number;
  order: number;
  title: string;
  text: string;
  module: Module;
  titleFold: string;
}
export interface LessonDoc extends DocBase {
  kind: "lesson";
  steps: number;
}
export interface StepDoc extends DocBase {
  kind: "step";
  lesson: string;
  chapter: Chapter;
  steps: number;
}
export interface ConceptDoc extends DocBase {
  kind: "concept";
  lesson: string;
  /** Number of other lessons that use the same concept ("+N more"). */
  also: number;
}
export type SearchDoc = LessonDoc | StepDoc | ConceptDoc;

/** Posting: [docIndex, weight, isKey, field] */
type Posting = [doc: number, weight: number, key: boolean, field: FieldName];

export interface SearchIndex {
  docs: SearchDoc[];
  post: Map<string, Posting[]>;
  vocab: string[];
  stems: string[];
  counts: { lessons: number; steps: number; concepts: number };
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Build the index. `moduleOf` maps a lesson id to its module (default: course lookup);
 * lessons without a module are skipped.
 */
export function buildIndex(
  lessons: readonly Lesson[],
  moduleOf: (lessonId: string) => Module | undefined = (id) => lessonRef(id)?.module,
): SearchIndex {
  const docs: (SearchDoc & { fields: Field[] })[] = [];
  const concepts = new Map<
    string,
    { term: string; lessonId: string; step: number; lesson: string; module: Module; sentence: string; lessons: Set<string> }
  >();
  let order = 0;

  for (const lesson of lessons) {
    const module = moduleOf(lesson.id);
    if (!module) continue;
    docs.push({
      kind: "lesson",
      lessonId: lesson.id,
      step: 0,
      order: order++,
      title: lesson.title,
      text: lesson.summary,
      module,
      steps: lesson.steps.length,
      titleFold: "",
      fields: [
        ["title", lesson.title, 10, true],
        ["summary", lesson.summary, 4, true],
        ["module", module.title, 3, true],
        ["goals", lesson.goals.map((g) => g.text).join(" "), 3, true],
      ],
    });

    lesson.steps.forEach((step, si) => {
      const body = step.body.map(htmlToText).join(" ");
      const entities = Object.values(step.scene.entities);
      const panels = entities
        .flatMap((e) => (e.type === "panel" ? [e] : []))
        .map((p) =>
          [p.title, ...(p.lines ?? []).map(panelLine), ...(p.bars ?? []).map((b) => `${b.label} ${b.note || ""}`)].join(" "),
        )
        .join(" ");
      const labels = [
        ...entities.flatMap((e) => {
          const label = "label" in e ? e.label : undefined;
          return [
            ...(Array.isArray(label) ? label : [label]),
            "sub" in e ? e.sub : undefined,
            ...("tags" in e && e.tags ? e.tags.map((t) => t.text) : []),
          ];
        }),
        ...Object.values(step.scene.links ?? {}).map((l) => l.label),
      ]
        .filter((s): s is string => typeof s === "string" && !!s)
        .join(" ");

      docs.push({
        kind: "step",
        lessonId: lesson.id,
        step: si,
        order: order++,
        title: step.title,
        text: body,
        lesson: lesson.title,
        module,
        chapter: step.chapter,
        steps: lesson.steps.length,
        titleFold: "",
        fields: [
          ["title", step.title, 8, true],
          ["short", step.short, 6, true],
          ["body", body, 3, true],
          ["callout", htmlToText(step.callout?.text), 2, true],
          ["changes", (step.changes ?? []).map((c) => c.replace(/^[+~−-]\s*/, "")).join(" "), 1.5, true],
          ["panel", panels, 1.5, true],
          ["labels", labels, 1, true],
          ["lesson", lesson.title, 1, false],
        ],
      });

      for (const para of step.body) {
        for (const m of para.matchAll(/<span class="term">([\s\S]*?)<\/span>/g)) {
          const term = htmlToText(m[1]);
          const key = tokenize(term).map(stem).join(" ");
          if (!key) continue;
          const existing = concepts.get(key);
          if (existing) existing.lessons.add(lesson.id);
          else
            concepts.set(key, {
              term,
              lessonId: lesson.id,
              step: si,
              lesson: lesson.title,
              module,
              sentence: sentenceAround(htmlToText(para), term),
              lessons: new Set([lesson.id]),
            });
        }
      }
    });
  }

  for (const c of concepts.values()) {
    docs.push({
      kind: "concept",
      lessonId: c.lessonId,
      step: c.step,
      order: order++,
      title: capitalise(c.term),
      text: c.sentence,
      lesson: c.lesson,
      module: c.module,
      also: c.lessons.size - 1,
      titleFold: "",
      fields: [
        ["term", c.term, 10, true],
        ["sentence", c.sentence, 1, false],
      ],
    });
  }

  const post = new Map<string, Posting[]>();
  docs.forEach((doc, di) => {
    doc.titleFold = fold(doc.title);
    const best = new Map<string, [number, boolean, FieldName]>();
    for (const [name, text, weight, key] of doc.fields) {
      for (const tok of tokenize(text || "")) {
        const cur = best.get(tok);
        if (!cur || weight > cur[0] || (weight === cur[0] && key && !cur[1])) best.set(tok, [weight, key, name]);
      }
    }
    for (const [tok, [weight, key, name]] of best) {
      let list = post.get(tok);
      if (!list) post.set(tok, (list = []));
      list.push([di, weight, key, name]);
    }
  });

  const vocab = [...post.keys()];
  return {
    docs: docs.map(({ fields: _f, ...d }) => d as SearchDoc),
    post,
    vocab,
    stems: vocab.map(stem),
    counts: {
      lessons: docs.filter((d) => d.kind === "lesson").length,
      steps: docs.filter((d) => d.kind === "step").length,
      concepts: concepts.size,
    },
  };
}

/** Vocabulary terms matching one query term, with their match quality (synonyms ×0.9, fuzzy fallback). */
function expandTerm(index: SearchIndex, q: string): Map<string, number> {
  const out = new Map<string, number>();
  [q, ...(SYNONYMS[q] ?? [])].forEach((variant, vi) => {
    const vStem = stem(variant);
    const factor = vi ? 0.9 : 1;
    index.vocab.forEach((v, i) => {
      const s = termMatch(v, index.stems[i], variant, vStem) * factor;
      if (s > (out.get(v) || 0)) out.set(v, s);
    });
  });
  if (q.length >= 5 && ![...out.values()].some((s) => s >= 0.85)) {
    const max = q.length >= 8 ? 2 : 1;
    for (const v of index.vocab) {
      if (v.length < q.length - max || (out.get(v) ?? 0) >= 0.6) continue;
      let d = editDistance(v, q, max);
      if (d > max && v.length > q.length) d = editDistance(v.slice(0, q.length), q, max);
      if (d <= max) out.set(v, d === 1 ? 0.6 : 0.45);
    }
  }
  return out;
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  /** Field that contributed the single highest term score. */
  field: FieldName;
}

export interface QueryResult {
  /** Hits per group, each sorted by score desc then document order. Uncapped (see GROUP_CAPS). */
  found: Record<DocKind, SearchHit[]>;
  /** Vocabulary terms the query matched — feed to highlightRanges / highlightHtml / snippet. */
  matched: Set<string>;
  total: number;
}

/** Run a query. Returns null when the query has no searchable tokens. */
export function query(index: SearchIndex, q: string): QueryResult | null {
  let terms = [...new Set(tokenize(q))];
  const content = terms.filter((t) => !STOPWORDS.has(t));
  if (content.length) terms = content;
  if (!terms.length) return null;

  const expansions = terms.map((t) => expandTerm(index, t));
  const matched = new Set<string>();
  for (const m of expansions) for (const v of m.keys()) matched.add(v);

  type Slot = { s: number; key: boolean; field: FieldName | null };
  const perDoc = new Map<number, Slot[]>();
  expansions.forEach((m, ti) => {
    for (const [v, quality] of m) {
      for (const [di, weight, key, field] of index.post.get(v) ?? []) {
        let slots = perDoc.get(di);
        if (!slots) perDoc.set(di, (slots = terms.map(() => ({ s: 0, key: false, field: null }))));
        const s = quality * weight;
        if (s > slots[ti].s) {
          slots[ti].s = s;
          slots[ti].field = field;
        }
        if (key) slots[ti].key = true;
      }
    }
  });

  const cjk = terms.map(isCjk);
  const cjkCount = cjk.filter(Boolean).length;
  const cjkNeeded = cjkCount <= 2 ? cjkCount : Math.ceil(cjkCount * 0.6);
  const whole = fold(q).replace(/\s+/g, " ").trim();
  const found: Record<DocKind, SearchHit[]> = { lesson: [], concept: [], step: [] };

  for (const [di, slots] of perDoc) {
    if (
      slots.some((sl, i) => sl.s === 0 && !cjk[i]) ||
      !slots.some((sl) => sl.key) ||
      slots.filter((sl, i) => cjk[i] && sl.s > 0).length < cjkNeeded
    )
      continue;
    const doc = index.docs[di];
    let score = slots.reduce((a, sl) => a + sl.s, 0);
    if (whole.length > 2 && doc.titleFold.includes(whole)) score += doc.titleFold.startsWith(whole) ? 12 : 8;
    if (doc.titleFold === whole) score += 10;
    const top = slots.reduce((a, b) => (b.s > a.s ? b : a));
    found[doc.kind].push({ doc, score, field: top.field ?? "title" });
  }
  for (const list of Object.values(found)) list.sort((a, b) => b.score - a.score || a.doc.order - b.doc.order);
  return { found, matched, total: found.lesson.length + found.concept.length + found.step.length };
}

/** Group display order: by best score with a +3 lesson / +1 concept bias; empty groups last. */
export function groupOrder(result: QueryResult): DocKind[] {
  const bias: Record<DocKind, number> = { lesson: 3, concept: 1, step: 0 };
  const best = (k: DocKind) => (result.found[k].length ? result.found[k][0].score + bias[k] : -1);
  return (["lesson", "concept", "step"] as DocKind[]).sort((a, b) => best(b) - best(a));
}

/** Hash route for a result (`step` is 0-based). */
export const resultHref = (lessonId: string, step: number) => `#/${lessonId}/${step + 1}`;
