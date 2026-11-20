// Content validation (doc 12 §8 step 4): every lesson must be renderable by the original engine
// using only the original registries.
import { describe, expect, it } from "vitest";
import { ICON_NAMES } from "../icons";
import type { Entity, Flow, Lesson, PointRef } from "../types/lesson";
import { CALLOUTS, CHAPTERS, COURSE, FLAT, LEGEND, LEVELS, METRICS, getLesson } from "./index";
import { FREE_MODULES } from "./course";
import { LESSONS } from "./lessons";

const ICONS = new Set<string>(ICON_NAMES);
const ENTITY_TYPES = new Set(["block", "crowd", "ghost", "device", "db", "zone", "queue", "panel", "ring"]);
const PACKETS = new Set(["req", "slow", "heavy", "ping", "kill", "write", "msg", "poison", "push", "empty", "mine"]);
const TONES = new Set(["paper", "red", "green", "amber", "violet", "gray"]);
const COLORS = new Set(["orange", "green", "blue", "yellow", "purple", "slab", "store"]);
const STYLES = new Set(["solid", "dashed", "off", "beat", "cut"]);
// Raw file text (JSON.parse would hide duplicate keys) keyed by lesson id.
const RAW: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("./lessons/*.json", { query: "?raw", import: "default", eager: true })).map(
    ([path, text]) => [path.replace(/^.*\/|\.json$/g, ""), text],
  ),
);

/** Throws on duplicate object keys, which JSON.parse would silently collapse. */
function assertNoDuplicateKeys(text: string, file: string): void {
  let i = 0;
  const ws = () => {
    while (/\s/.test(text[i])) i++;
  };
  const str = () => {
    const start = i++;
    while (text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
    i++;
    return JSON.parse(text.slice(start, i)) as string;
  };
  const value = (path: string): void => {
    ws();
    if (text[i] === "{") {
      i++;
      const seen = new Set<string>();
      for (ws(); text[i] !== "}"; ws()) {
        const key = str();
        if (seen.has(key)) throw new Error(`${file}: duplicate key "${key}" at ${path}`);
        seen.add(key);
        ws();
        i++; // :
        value(`${path}.${key}`);
        ws();
        if (text[i] === ",") i++;
      }
      i++;
    } else if (text[i] === "[") {
      i++;
      for (let n = 0; (ws(), text[i] !== "]"); n++) {
        value(`${path}[${n}]`);
        ws();
        if (text[i] === ",") i++;
      }
      i++;
    } else if (text[i] === '"') str();
    else while (i < text.length && !/[,\]}\s]/.test(text[i])) i++;
  };
  value("$");
}

const refId = (ref: string) => ref.replace(/[+-][\d.]+$/, "");

function iconsOf(e: Entity): string[] {
  const out: string[] = [];
  if ("tags" in e && e.tags) out.push(...e.tags.flatMap((t) => (t.icon ? [t.icon] : [])));
  if (e.type === "panel" && e.icon) out.push(e.icon);
  if (e.type === "db" && e.glyph) out.push(e.glyph);
  if (e.type === "block" && e.glyph && e.glyph !== "server" && e.glyph !== "balancer") out.push(e.glyph);
  return out;
}

function flowPaths(f: Flow): (string | string[])[][] {
  return "routes" in f ? f.routes.map((r) => r.path) : [f.route];
}

describe("registries", () => {
  it("uses only valid icons", () => {
    for (const [k, m] of Object.entries(METRICS)) expect(ICONS.has(m.icon), `metric ${k}: ${m.icon}`).toBe(true);
    for (const [k, c] of Object.entries(CALLOUTS)) expect(ICONS.has(c.icon), `callout ${k}`).toBe(true);
  });

  it("formats the lesson metrics like the original", () => {
    expect(METRICS.p95.fmt(1400)).toBe("1.4 s");
    expect(METRICS.p95.nullText).toBe("timeout");
    expect(METRICS.p95.level?.(null)).toBe("bad");
    expect(METRICS.errors.fmt(6.8)).toBe("7%");
    expect(METRICS.errors.level?.(0.4)).toBe("good");
    expect(METRICS.users.fmt(150_000_000)).toBe("150,000,000");
  });
});

describe("course", () => {
  it("has lesson data for every course ref, and no orphan lessons", () => {
    const refs = COURSE.flatMap((m) => m.lessons.map((l) => l.id));
    expect(new Set(refs).size).toBe(refs.length);
    for (const ref of FLAT) {
      const lesson = getLesson(ref.id);
      expect(lesson, ref.id).toBeDefined();
      expect(lesson!.title).toBe(ref.title);
    }
    expect(Object.keys(LESSONS).sort()).toEqual([...refs].sort());
    expect(Object.keys(RAW).sort()).toEqual([...refs].sort());
  });

  it("only frees modules that exist", () => {
    for (const id of FREE_MODULES) expect(COURSE.some((m) => m.id === id), id).toBe(true);
  });
});

describe.each(Object.values(LESSONS).map((l) => [l.id, l] as [string, Lesson]))("lesson %s", (id, lesson) => {
  it("has no duplicate keys (entity ids are unique per scene)", () => {
    assertNoDuplicateKeys(RAW[id], `${id}.json`);
  });

  it("uses only original registry keys", () => {
    expect(LEVELS[lesson.level], "level").toBeDefined();
    for (const k of lesson.metrics) expect(METRICS[k], `metric ${k}`).toBeDefined();
    for (const item of lesson.legend) {
      const [key, label] = Array.isArray(item) ? item : [item, ""];
      expect(LEGEND[key], `legend ${key}`).toBeDefined();
      expect(typeof label).toBe("string");
    }
    for (const g of lesson.goals) expect(g.step >= 0 && g.step < lesson.steps.length, g.text).toBe(true);
  });

  lesson.steps.forEach((step, si) => {
    const at = `${id} step ${si + 1}`;

    it(`step ${si + 1}: text, chapter, callout, changes, metrics`, () => {
      expect(step.short.length > 0 && step.short.length <= 14, `${at} short "${step.short}"`).toBe(true);
      expect(CHAPTERS[step.chapter], `${at} chapter`).toBeDefined();
      if (step.callout) expect(CALLOUTS[step.callout.kind], `${at} callout`).toBeDefined();
      for (const c of step.changes ?? []) expect(c, `${at} change`).toMatch(/^(\+ |- |− |~ )\S/);
      expect(step.body.length).toBeGreaterThan(0);
      for (const k of lesson.metrics) {
        expect(k in step.metrics, `${at} metric ${k}`).toBe(true);
        expect(["number", "string"].includes(typeof step.metrics[k]) || step.metrics[k] === null).toBe(true);
      }
      for (const k of Object.keys(step.metrics)) expect(METRICS[k], `${at} metric ${k}`).toBeDefined();
    });

    it(`step ${si + 1}: scene entities, links and flows are consistent`, () => {
      const { entities, links = {}, flows = [] } = step.scene;
      const ids = new Set(Object.keys(entities));
      expect(ids.has("__card"), `${at}: "__card" is reserved for the docked panel`).toBe(false);
      expect(Object.values(entities).filter((e) => e.type === "panel").length, `${at} panels`).toBeLessThanOrEqual(1);

      for (const [eid, e] of Object.entries(entities)) {
        expect(ENTITY_TYPES.has(e.type), `${at} ${eid} type`).toBe(true);
        for (const icon of iconsOf(e)) expect(ICONS.has(icon), `${at} ${eid} icon ${icon}`).toBe(true);
        if ("tags" in e) for (const t of e.tags ?? []) expect(!t.tone || TONES.has(t.tone), `${at} ${eid} tone`).toBe(true);
        if (e.type === "block" && e.color) expect(COLORS.has(e.color), `${at} ${eid} color`).toBe(true);
        if (e.type === "block" && e.label) expect(e.label.length, `${at} ${eid} label lines`).toBeLessThanOrEqual(2);
      }

      for (const [lid, l] of Object.entries(links)) {
        expect(ids.has(l.from), `${at} link ${lid} from ${l.from}`).toBe(true);
        if (l.to) expect(ids.has(l.to), `${at} link ${lid} to ${l.to}`).toBe(true);
        expect(l.pts.length, `${at} link ${lid} pts`).toBeGreaterThanOrEqual(2);
        const refs = l.pts.flatMap((p: PointRef) => (Array.isArray(p) ? p : [p]));
        for (const r of refs) if (typeof r === "string") expect(ids.has(refId(r)), `${at} link ${lid} pt ${r}`).toBe(true);
        if (l.style) expect(STYLES.has(l.style), `${at} link ${lid} style`).toBe(true);
        if (l.fail !== undefined) expect(l.fail >= 0 && l.fail <= 1).toBe(true);
      }

      for (const [fi, f] of flows.entries()) {
        const where = `${at} flow ${fi}`;
        expect(f.rate, where).toBeGreaterThan(0);
        for (const k of [f.kind, ...(f.pattern ?? [])]) if (k) expect(PACKETS.has(k), `${where} kind ${k}`).toBe(true);
        if ("routes" in f) {
          for (const r of f.routes) if (r.kind) expect(PACKETS.has(r.kind), `${where} kind ${r.kind}`).toBe(true);
        } else if (f.weights) {
          for (const s of f.route) if (Array.isArray(s)) expect(s.length, `${where} weights`).toBe(f.weights.length);
        }
        for (const path of flowPaths(f)) {
          expect(path.length, where).toBeGreaterThan(0);
          for (const s of path.flat()) {
            expect(links[s], `${where} link ${s}`).toBeDefined();
            expect(links[s].style, `${where} link ${s} is off`).not.toBe("off");
          }
        }
      }
    });
  });
});
