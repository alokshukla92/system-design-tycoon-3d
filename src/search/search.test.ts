import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { Lesson, Module, Step } from "../types/lesson";
import {
  buildIndex,
  fold,
  groupOrder,
  highlightHtml,
  highlightRanges,
  htmlToText,
  query,
  snippet,
  stem,
  tokenize,
} from "./index";
import { SearchModal } from "./SearchModal";

const step = (p: Partial<Step> & Pick<Step, "title" | "short">): Step => ({
  chapter: "setup",
  body: [],
  metrics: {},
  scene: { entities: {} },
  ...p,
});

const LB: Lesson = {
  id: "load-balancing",
  title: "Load Balancing",
  summary: "Spread traffic across many servers.",
  minutes: 8,
  level: "beginner",
  metrics: [],
  legend: [],
  goals: [{ text: "Understand round robin", step: 1 }],
  steps: [
    step({ title: "One server", short: "One box", body: ["<p>A single server handles every request.</p>"] }),
    step({
      title: "Add a balancer",
      short: "Balance",
      chapter: "solution",
      body: ['<p>A <span class="term">load balancer</span> spreads requests using <b>round robin</b>.</p>'],
      scene: {
        entities: {
          lb: { type: "block", x: 0, y: 0, label: ["Nginx"], tags: [{ text: "healthy" }] },
          p: { type: "panel", title: "Pool", lines: ["= **three** replicas"] },
        },
        links: { a: { from: "lb", pts: [], label: "proxy" } },
      },
    }),
  ],
};

const CACHE: Lesson = {
  id: "caching",
  title: "Caching",
  summary: "Keep hot data close to the reader.",
  minutes: 9,
  level: "beginner",
  metrics: [],
  legend: [],
  goals: [],
  steps: [
    step({
      title: "Cache hits",
      short: "Hits",
      chapter: "problem",
      body: [
        "<p>Reads hit the database every time. A <span class=\"term\">load balancers</span> doesn't help; a <span class=\"term\">cache</span> does.</p>",
      ],
      callout: { kind: "tip", text: "Invalidation is hard." },
      changes: ["+ Redis cache"],
    }),
  ],
};

const MODULE: Module = {
  id: "foundations",
  num: "01",
  title: "Foundations",
  color: "sand",
  lessons: [
    { id: LB.id, title: LB.title },
    { id: CACHE.id, title: CACHE.title },
  ],
};
const index = buildIndex([LB, CACHE], () => MODULE);

describe("text processing", () => {
  it("folds diacritics, apostrophes and special letters", () => {
    expect(fold("Café Straße don’t Łódź")).toBe("cafe strasse dont lodz");
  });
  it("tokenises compounds and CJK", () => {
    expect(tokenize("write-ahead log")).toEqual(["write", "ahead", "log", "writeahead"]);
    expect(tokenize("負荷分散")).toEqual(["負荷", "荷分", "分散"]);
  });
  it("stems long non-numeric words only", () => {
    expect(stem("caches")).toBe("cach");
    expect(stem("queries")).toBe("query");
    expect(stem("cache")).toBe("cach");
    expect(stem("load")).toBe("load");
    expect(stem("http2s")).toBe("http2s");
  });
  it("strips HTML and footnotes", () => {
    expect(htmlToText("<ul><li>a</li><li>b</li></ul>x<sup>1</sup> &amp; &#x41;")).toBe("a · b · x & A");
  });
});

describe("index", () => {
  it("builds lesson, step and de-duplicated concept docs", () => {
    expect(index.counts).toEqual({ lessons: 2, steps: 3, concepts: 2 });
    const lbConcept = index.docs.find((d) => d.kind === "concept" && d.title === "Load balancer");
    expect(lbConcept).toMatchObject({ lessonId: "load-balancing", step: 1, also: 1 });
    expect(lbConcept?.text).toBe("A load balancer spreads requests using round robin.");
  });
});

describe("query", () => {
  it("returns null when nothing is searchable", () => {
    expect(query(index, "  !! ")).toBeNull();
  });

  it("ranks the lesson whose title starts with the query first", () => {
    const r = query(index, "load balancing")!;
    expect(r.found.lesson[0].doc.lessonId).toBe("load-balancing");
    expect(r.found.lesson[0].field).toBe("title");
    expect(groupOrder(r)[0]).toBe("lesson");
  });

  it("requires every term, drops stopwords and uses synonyms", () => {
    expect(query(index, "the cache")!.found.lesson.map((h) => h.doc.lessonId)).toEqual(["caching"]);
    expect(query(index, "cache zzzz")!.total).toBe(0);
    const db = query(index, "db")!;
    expect(db.found.step.map((h) => [h.doc.lessonId, h.doc.step])).toEqual([["caching", 0]]);
    expect(db.matched.has("database")).toBe(true);
  });

  it("matches prefixes, stems and typos", () => {
    expect(query(index, "balanc")!.total).toBeGreaterThan(0);
    expect(query(index, "caches")!.found.lesson[0].doc.lessonId).toBe("caching");
    expect(query(index, "balancre")!.found.concept[0].doc.title).toBe("Load balancer");
  });

  it("indexes scene labels, panels, links, callouts and changes", () => {
    for (const q of ["nginx", "healthy", "replicas", "proxy"]) {
      const hits = query(index, q)!.found.step;
      expect(hits[0]?.doc).toMatchObject({ lessonId: "load-balancing", step: 1 });
    }
    expect(query(index, "invalidation")!.found.step[0].field).toBe("callout");
    expect(query(index, "redis")!.found.step[0].field).toBe("changes");
  });

  it("does not match on non-key fields alone", () => {
    // "Load Balancing" is only a non-key field ("lesson") on its own step docs.
    const r = query(index, "load balancing")!;
    expect(r.found.step.some((h) => h.doc.lessonId === "load-balancing" && h.doc.step === 0)).toBe(false);
    expect(r.found.step.some((h) => h.doc.lessonId === "caching")).toBe(true);
  });
});

describe("highlighting", () => {
  const m = new Set(["cache"]);
  it("marks matched words and escapes HTML", () => {
    expect(highlightRanges("A Cache, a cache!", m)).toEqual([
      [2, 7],
      [11, 16],
    ]);
    expect(highlightHtml("<cache>", m)).toBe("&lt;<mark>cache</mark>&gt;");
  });
  it("snippets centre on the first hit", () => {
    const text = `${"word ".repeat(40)}the cache is here. ${"tail ".repeat(60)}`.trim();
    const s = snippet(text, m);
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s).toContain("cache");
    expect(snippet("short cache text", m)).toBe("short cache text");
  });
});

describe("SearchModal markup", () => {
  it("renders the original structure", () => {
    const html = renderToStaticMarkup(
      createElement(SearchModal, { open: false, onClose: () => {}, onPick: () => {}, lessons: [LB, CACHE] }),
    );
    expect(html).toContain('<div class="sx" hidden="">');
    expect(html).toContain('class="sx__dialog" role="dialog" aria-modal="true" aria-label="Search the course"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('<div class="sx__list" id="sx-list" role="listbox" aria-label="Results">');
    expect(html).toContain("<kbd>↵</kbd> open");
  });
});
