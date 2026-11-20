import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { CALLOUTS, CHAPTERS, LEGEND, LEVELS, METRICS } from "../content/registries";
import { PALETTE_ORDER } from "../lab/sim/catalog/components";
import { EN_KEYS } from "./en";
import { LOCALES, localeFromPath, localeUrl, setLocale, stripLocale, t } from "./index";
import type { Messages } from "./index";

const EN = new Set<string>(EN_KEYS);
const LOCALE_FILES = import.meta.glob<{ default: Messages }>("./locales/*.ts", { eager: true });
const SOURCES = import.meta.glob<string>(
  [
    "../{app,components,search,pages,engine}/**/*.{ts,tsx}",
    "../lab/ui/**/*.{ts,tsx}",
    "../main.tsx",
    "../content/registries.ts",
    "!**/*.test.*",
  ],
  { eager: true, query: "?raw", import: "default" },
);

/** String literals passed to t()/tr()/D() in the UI chrome (and the engine's chart captions). */
function extractKeys(): Map<string, string> {
  const lit = String.raw`("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\`[^\`$\\]*\`)`;
  const re = new RegExp(String.raw`(?<![\w.$])(?:t|tr|D)\(\s*` + lit, "g");
  const out = new Map<string, string>();
  for (const [file, text] of Object.entries(SOURCES)) {
    for (const m of text.matchAll(re)) {
      const raw = m[1];
      const key = raw[0] === "`" ? raw.slice(1, -1) : (JSON.parse(raw[0] === "'" ? `"${raw.slice(1, -1).replace(/"/g, '\\"')}"` : raw) as string);
      out.set(key, file);
    }
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const tags = (s: string) => [...s.matchAll(/<\/?b>/g)].map((m) => m[0]).join("");

describe("English key set", () => {
  it("covers every t()/tr()/D() literal in the UI chrome", () => {
    const found = extractKeys();
    expect(found.size).toBeGreaterThan(350);
    const missing = [...found].filter(([k]) => !EN.has(k)).map(([k, f]) => `${f}: ${k}`);
    expect(missing).toEqual([]);
  });

  it("covers every registry label (metrics, legend, chapters, callouts, levels, palette)", () => {
    const labels = [
      ...Object.values(METRICS).map((d) => d.label),
      ...Object.values(LEGEND).map((d) => d.label),
      ...Object.values(CHAPTERS).map((d) => d.label),
      ...Object.values(CALLOUTS).map((d) => d.title),
      ...Object.values(LEVELS),
      ...PALETTE_ORDER.map((p) => p.label),
    ];
    expect(labels.filter((l) => !EN.has(l))).toEqual([]);
  });

  it("has no duplicates", () => {
    expect(EN.size).toBe(EN_KEYS.length);
  });
});

describe("locale tables", () => {
  const ids = LOCALES.filter((l) => l.id !== "en").map((l) => l.id);

  it("exist for every non-English locale", () => {
    expect(Object.keys(LOCALE_FILES).sort()).toEqual(ids.map((id) => `./locales/${id}.ts`).sort());
  });

  for (const [path, mod] of Object.entries(LOCALE_FILES)) {
    describe(path, () => {
      const table = mod.default as Record<string, string>;

      it("has exactly the English key set", () => {
        const keys = Object.keys(table);
        expect(keys.filter((k) => !EN.has(k))).toEqual([]);
        expect(EN_KEYS.filter((k) => !(k in table))).toEqual([]);
      });

      it("keeps placeholders and <b> markup intact, with no empty strings", () => {
        const bad = EN_KEYS.filter((k) => {
          const v = table[k];
          return !v?.trim() || placeholders(v).join() !== placeholders(k).join() || tags(v) !== tags(k);
        });
        expect(bad).toEqual([]);
      });
    });
  }
});

describe("t()", () => {
  beforeAll(() => {
    if (typeof document === "undefined") Object.assign(globalThis, { document: { documentElement: { lang: "en", dir: "ltr" } } });
  });
  afterEach(() => setLocale("en"));

  it("translates, interpolates and falls back to English", () => {
    setLocale("de", { "{n} users": "{n} Nutzer" } as Partial<Messages>);
    expect(t("{n} users", { n: 5 })).toBe("5 Nutzer");
    expect(t("Not a key")).toBe("Not a key");
    expect(document.documentElement.lang).toBe("de");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("sets dir=rtl for Arabic and Hebrew", () => {
    setLocale("ar", {});
    expect(document.documentElement.dir).toBe("rtl");
    setLocale("he", {});
    expect(document.documentElement.dir).toBe("rtl");
  });
});

describe("locale URLs (original ug(): path prefix, hash kept)", () => {
  it("reads and strips the locale prefix", () => {
    expect(localeFromPath("/")).toBe("en");
    expect(localeFromPath("/es/")).toBe("es");
    expect(localeFromPath("/zh-Hant/pricing/")).toBe("zh-Hant");
    expect(localeFromPath("/en/")).toBe("en");
    expect(localeFromPath("/xx/")).toBe("en");
    expect(stripLocale("/ar/pricing/")).toBe("/pricing/");
    expect(stripLocale("/pricing/")).toBe("/pricing/");
  });

  it("builds the same page under another locale", () => {
    expect(localeUrl("de", "https://x.test/#/caching/3")).toBe("https://x.test/de/#/caching/3");
    expect(localeUrl("en", "https://x.test/de/#/lab")).toBe("https://x.test/#/lab");
    expect(localeUrl("ja", "https://x.test/es/pricing/?a=1#top")).toBe("https://x.test/ja/pricing/?a=1#top");
  });
});
