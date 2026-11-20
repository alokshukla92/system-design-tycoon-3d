// Search modal `.sx` (doc 04 §9, doc 06 F8; original JS L5726-6035).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { CHAPTERS, FLAT, getLesson } from "../content";
import { iconInner, iconSvg } from "../icons";
import type { Chapter, Lesson, Module } from "../types/lesson";
import {
  GROUP_CAPS,
  SUGGESTIONS,
  buildIndex,
  escapeHtml,
  groupOrder,
  highlightHtml,
  query as runQuery,
  resultHref,
  snippet,
} from "./index";
import type { ConceptDoc, DocKind, LessonDoc, SearchIndex, StepDoc } from "./index";
import "./search.css";

export interface RecentEntry {
  lessonId: string;
  step: number;
}

export interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when a result is chosen (Enter / click). `step` is 0-based. The modal then sets `location.hash`. */
  onPick: (lessonId: string, step: number) => void;
  /** Called on ⌘K / Ctrl K / "/" while closed. Omit to disable the global shortcuts for opening. */
  onOpen?: () => void;
  /** Lessons to index (default: every bundled lesson in course order). Pass a filtered list to hide locked lessons. */
  lessons?: readonly Lesson[];
  /** Currently open lesson — excluded from Recent (default: `sdt:last`). */
  currentLessonId?: string | null;
  /** Completed lesson ids (default: `sdt:done`). */
  done?: ReadonlySet<string>;
  /** Most-recent-first visits (default: `sdt:recent`). */
  recent?: readonly RecentEntry[];
}

const FALLBACK_CHAPTERS: Record<Chapter, { label: string; tone: string }> = {
  setup: { label: "Setup", tone: "sand" },
  problem: { label: "Problem", tone: "red" },
  solution: { label: "Solution", tone: "green" },
  technique: { label: "Technique", tone: "blue" },
  tradeoff: { label: "Trade-off", tone: "amber" },
  insight: { label: "Insight", tone: "violet" },
  recap: { label: "Recap", tone: "ink" },
};
const chapterDef = (c: Chapter) => CHAPTERS[c] ?? FALLBACK_CHAPTERS[c] ?? CHAPTERS.insight ?? FALLBACK_CHAPTERS.insight;

function readStore<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`sdt:${name}`);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

const folderSvg = (color: string) => `
  <svg class="folder folder--${color}" width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
    <path d="M1.2 3.2A2 2 0 0 1 3.2 1.2h4.1l2 2.2h7.5a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H3.2a2 2 0 0 1-2-2Z"/>
    <path class="folder__lip" d="M1.2 6.2h17.6"/>
  </svg>`;

const moduleLabel = (m: Module) => `${m.num} · ${m.title}`;
const ENTER = `<kbd class="sx__enter">↵</kbd>`;

// ── Row markup (mirrors the original's innerHTML templates) ──────────────────
type Row =
  | { type: "group"; key: string; label: string; right: string }
  | { type: "item"; key: string; i: number; lessonId: string; step: number; html: string }
  | { type: "empty"; key: string; q: string }
  | { type: "loading"; key: string };

function lessonHtml(d: LessonDoc, text: string, matched: Set<string> | null, meta: string, done: ReadonlySet<string>) {
  const side = done.has(d.lessonId)
    ? iconSvg("circleCheck", { size: 16, stroke: 2, cls: "sx__done" })
    : `<span class="sx__steps">${escapeHtml(`${d.steps} steps`)}</span>`;
  return `
        <span class="sx__icon sx__icon--lesson">${folderSvg(d.module.color)}</span>
        <span class="sx__main">
          <span class="sx__title">${highlightHtml(d.title, matched)}${meta ? `<span class="sx__meta">${escapeHtml(meta)}</span>` : ""}</span>
          <span class="sx__text">${highlightHtml(text, matched)}</span>
        </span>
        <span class="sx__side">${side}${ENTER}</span>`;
}

function conceptHtml(d: ConceptDoc, matched: Set<string>) {
  const meta = `${d.lesson} · step ${d.step + 1}${d.also ? ` · +${d.also} more` : ""}`;
  return `
        <span class="sx__icon sx__icon--concept">${iconSvg("bookmark", { size: 15, stroke: 2.1 })}</span>
        <span class="sx__main">
          <span class="sx__title">${highlightHtml(d.title, matched)}<span class="sx__meta">${escapeHtml(meta)}</span></span>
          <span class="sx__text">${highlightHtml(snippet(d.text, matched), matched)}</span>
        </span>
        <span class="sx__side"><span class="sx__kind">Concept</span>${ENTER}</span>`;
}

function stepHtml(d: StepDoc, matched: Set<string>) {
  const ch = chapterDef(d.chapter);
  return `
        <span class="sx__icon sx__icon--step chapter--${ch.tone}">${d.step + 1}</span>
        <span class="sx__main">
          <span class="sx__title">${highlightHtml(d.title, matched)}<span class="sx__meta">${escapeHtml(d.lesson)} · ${escapeHtml(`step ${d.step + 1} of ${d.steps}`)}</span></span>
          <span class="sx__text">${highlightHtml(snippet(d.text, matched), matched)}</span>
        </span>
        <span class="sx__side"><span class="sx__chip chapter--${ch.tone}">${escapeHtml(ch.label)}</span>${ENTER}</span>`;
}

const GROUP_LABEL: Record<DocKind, string> = { lesson: "Lessons", concept: "Concepts", step: "Steps" };

interface Snapshot {
  currentLessonId: string | null;
  done: ReadonlySet<string>;
  recent: readonly RecentEntry[];
}

function buildRows(index: SearchIndex | null, q: string, snap: Snapshot): { rows: Row[]; count: string } {
  if (!index) return { rows: [{ type: "loading", key: "loading" }], count: "" };
  const rows: Row[] = [];
  const result = q.trim() ? runQuery(index, q) : null;
  let n = 0;
  const item = (lessonId: string, step: number, html: string) =>
    rows.push({ type: "item", key: `i${n}`, i: n++, lessonId, step, html });

  if (result) {
    for (const kind of groupOrder(result)) {
      const hits = result.found[kind];
      if (!hits.length) continue;
      const shown = hits.slice(0, GROUP_CAPS[kind]);
      rows.push({
        type: "group",
        key: `g-${kind}`,
        label: GROUP_LABEL[kind],
        right: hits.length > shown.length ? `top ${shown.length} of ${hits.length}` : String(hits.length),
      });
      for (const { doc } of shown) {
        if (doc.kind === "lesson") item(doc.lessonId, doc.step, lessonHtml(doc, doc.text, result.matched, moduleLabel(doc.module), snap.done));
        else if (doc.kind === "concept") item(doc.lessonId, doc.step, conceptHtml(doc, result.matched));
        else item(doc.lessonId, doc.step, stepHtml(doc, result.matched));
      }
    }
    if (!result.total) rows.splice(0, rows.length, { type: "empty", key: "empty", q: q.trim() });
    return { rows, count: result.total === 1 ? "1 result" : `${result.total} results` };
  }

  const lessonDocs = new Map<string, LessonDoc>();
  const modules: Module[] = [];
  for (const d of index.docs) {
    if (d.kind !== "lesson") continue;
    lessonDocs.set(d.lessonId, d);
    if (!modules.includes(d.module)) modules.push(d.module);
  }
  const recent = snap.recent.filter((r) => r.lessonId !== snap.currentLessonId && lessonDocs.has(r.lessonId)).slice(0, 4);
  if (recent.length) {
    rows.push({ type: "group", key: "g-recent", label: "Recent", right: String(recent.length) });
    for (const r of recent) {
      const d = lessonDocs.get(r.lessonId)!;
      const stepDoc = index.docs.find((x) => x.kind === "step" && x.lessonId === r.lessonId && x.step === r.step);
      const text = stepDoc ? `Continue at step ${r.step + 1}: ${stepDoc.title}` : d.text;
      item(d.lessonId, r.step, lessonHtml(d, text, null, moduleLabel(d.module), snap.done));
    }
  }
  for (const m of modules) {
    const docs = m.lessons.map((l) => lessonDocs.get(l.id)).filter((d): d is LessonDoc => !!d);
    if (!docs.length) continue;
    const doneCount = docs.filter((d) => snap.done.has(d.lessonId)).length;
    rows.push({ type: "group", key: `g-${m.id}`, label: moduleLabel(m), right: `${doneCount}/${docs.length} done` });
    for (const d of docs) item(d.lessonId, d.step, lessonHtml(d, d.text, null, "", snap.done));
  }
  const c = index.counts;
  return { rows, count: `${c.lessons} lessons · ${c.steps} steps · ${c.concepts} concepts` };
}

const defaultLessons = () => FLAT.map((r) => getLesson(r.id)).filter((l): l is Lesson => !!l);

// ── Component ────────────────────────────────────────────────────────────────
export function SearchModal({ open, onClose, onPick, onOpen, lessons, currentLessonId, done, recent }: SearchModalProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrollToSel = useRef(false);

  const [visible, setVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [wanted, setWanted] = useState(false);
  const [q, setQ] = useState("");
  const [snap, setSnap] = useState<Snapshot>({ currentLessonId: null, done: new Set(), recent: [] });

  const index = useMemo(() => (wanted ? buildIndex(lessons ?? defaultLessons()) : null), [wanted, lessons]);
  const { rows, count } = useMemo(() => buildRows(index, q, snap), [index, q, snap]);
  const items = useMemo(() => rows.flatMap((r) => (r.type === "item" ? [r] : [])), [rows]);

  // Selection resets to the first item whenever the row set changes.
  const [selState, setSelState] = useState<{ rows: Row[]; i: number }>({ rows, i: 0 });
  const sel = !items.length ? -1 : selState.rows === rows ? selState.i : 0;
  const select = (i: number, scroll = true) => {
    if (!items.length) return;
    scrollToSel.current = scroll;
    setSelState({ rows, i: (i + items.length) % items.length });
  };

  // Open / close: unhide → reflow → .is-open → focus; close: drop .is-open, hide after 170 ms.
  // Props are snapshotted at open time (the original reads state when the list renders).
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setWanted(true);
      setQ("");
      setSnap({
        currentLessonId: currentLessonId !== undefined ? currentLessonId : (readStore<RecentEntry | null>("last", null)?.lessonId ?? null),
        done: done ?? new Set(readStore<string[]>("done", [])),
        recent: recent ?? readStore<RecentEntry[]>("recent", []),
      });
      setVisible(true);
    } else setIsOpen(false);
  }

  useLayoutEffect(() => {
    clearTimeout(hideTimer.current);
    if (!open && visible) {
      inputRef.current?.blur();
      hideTimer.current = setTimeout(() => setVisible(false), 170);
    }
  }, [open, visible]);

  useLayoutEffect(() => {
    if (open && visible && !isOpen) {
      void rootRef.current?.offsetWidth;
      setIsOpen(true);
      inputRef.current?.focus();
    }
  }, [open, visible, isOpen]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [rows]);

  useLayoutEffect(() => {
    if (!scrollToSel.current || sel < 0) return;
    scrollToSel.current = false;
    const el = listRef.current?.querySelector<HTMLElement>(`#sx-opt-${sel}`);
    if (!el || typeof el.scrollIntoView !== "function") return;
    const prev = el.previousElementSibling;
    const header = prev && prev.classList.contains("sx__group") ? (prev as HTMLElement) : null;
    (header ?? el).scrollIntoView({ block: "nearest" });
    if (header) el.scrollIntoView({ block: "nearest" });
  }, [sel, selState]);

  const latest = useRef({ open, onOpen, onClose });
  useLayoutEffect(() => {
    latest.current = { open, onOpen, onClose };
  });

  // Global shortcuts (capture phase): ⌘K / Ctrl K toggles; "/" opens; while open, Esc closes and keys are contained.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { open: isOpenNow, onOpen: openFn, onClose: closeFn } = latest.current;
      const input = inputRef.current;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        if (isOpenNow) closeFn();
        else openFn?.();
      } else if (isOpenNow) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeFn();
        }
        if (e.target !== input) e.stopPropagation();
      } else if (
        e.key === "/" &&
        !e.metaKey && !e.ctrlKey && !e.altKey &&
        openFn &&
        !(e.target instanceof Element && e.target.closest("input, textarea, [contenteditable]"))
      ) {
        e.preventDefault();
        openFn();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const pick = (i: number) => {
    const it = items[i];
    if (!it) return;
    const href = resultHref(it.lessonId, it.step);
    onClose();
    onPick(it.lessonId, it.step);
    if (location.hash !== href) location.hash = href;
  };

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const k = e.key;
    if (k === "ArrowDown" || (k === "Tab" && !e.shiftKey) || (e.ctrlKey && k === "n")) select(sel + 1);
    else if (k === "ArrowUp" || (k === "Tab" && e.shiftKey) || (e.ctrlKey && k === "p")) select(sel - 1);
    else if (k === "PageDown") select(Math.min(items.length - 1, sel + 6));
    else if (k === "PageUp") select(Math.max(0, sel - 6));
    else if (k === "Enter") pick(sel);
    else if (k === "Escape") onClose();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const onListClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    const chip = target.closest<HTMLElement>("[data-q]");
    if (chip) {
      setQ(chip.dataset.q ?? "");
      return;
    }
    const it = target.closest<HTMLElement>(".sx__item");
    if (!it || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    pick(Number(it.dataset.i));
  };

  const onListMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const it = (e.target as Element).closest<HTMLElement>(".sx__item");
    if (it && Number(it.dataset.i) !== sel) select(Number(it.dataset.i), false);
  };

  return (
    <div ref={rootRef} className={isOpen ? "sx is-open" : "sx"} hidden={!visible}>
      <div className="sx__backdrop" onMouseDown={onClose} />
      <div
        className="sx__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Search the course"
        onMouseDown={(e) => {
          if (e.target !== inputRef.current) e.preventDefault();
        }}
      >
        <div className="sx__bar">
          <svg
            className="i sx__glass"
            width={19}
            height={19}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: iconInner("search") }}
          />
          <input
            ref={inputRef}
            className="sx__input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="sx-list"
            aria-autocomplete="list"
            aria-activedescendant={sel >= 0 ? `sx-opt-${sel}` : undefined}
            placeholder="Search lessons, concepts, systems…"
            spellCheck={false}
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
          />
          <button
            className="sx__clear"
            type="button"
            aria-label="Clear search"
            hidden={!q}
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
          >
            Clear
          </button>
          <button className="sx__esc" type="button" aria-label="Close search" onClick={onClose}>
            esc
          </button>
        </div>
        <div className="sx__list" id="sx-list" role="listbox" aria-label="Results" ref={listRef} onClick={onListClick} onMouseMove={onListMove}>
          {rows.map((r) => {
            if (r.type === "group")
              return (
                <div key={r.key} className="sx__group" role="presentation">
                  <span>{r.label}</span>
                  <span>{r.right}</span>
                </div>
              );
            if (r.type === "loading")
              return (
                <div key={r.key} className="sx__empty">
                  <p>Loading…</p>
                </div>
              );
            if (r.type === "empty")
              return (
                <div key={r.key} className="sx__empty">
                  <div className="sx__empty-title">Nothing matches “{r.q}”</div>
                  <p>Try a single word, or one of these:</p>
                  <div className="sx__chips">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" data-q={s}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              );
            const { i } = r;
            return (
              <a
                key={r.key}
                className={i === sel ? "sx__item is-sel" : "sx__item"}
                role="option"
                id={`sx-opt-${i}`}
                data-i={i}
                aria-selected={i === sel}
                href={resultHref(r.lessonId, r.step)}
                dangerouslySetInnerHTML={{ __html: r.html }}
              />
            );
          })}
        </div>
        <div className="sx__foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
          <span className="sx__count">{count}</span>
        </div>
      </div>
    </div>
  );
}
