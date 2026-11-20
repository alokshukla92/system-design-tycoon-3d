// UI string table + translator (original: `O(key, vars)` / `D(key)`, JS L5279, L8139).
// Keys are the English source strings, so t("Back") === "Back" in en. Each other locale is a lazy chunk
// (`./locales/<id>.ts`, like the original's `course-i18n-{locale}.js`) loaded once at boot for the URL's
// locale prefix (`/es/#/…`). Switching language is a full navigation, exactly like the original.
import type { EN_KEYS } from "./en";

export interface Locale {
  id: string;
  code: string;
  native: string;
  english: string;
  rtl?: boolean;
}

export const LOCALES: Locale[] = [
  { id: "en", code: "EN", native: "English", english: "English" },
  { id: "es", code: "ES", native: "Español", english: "Spanish" },
  { id: "pt", code: "PT", native: "Português", english: "Portuguese" },
  { id: "fr", code: "FR", native: "Français", english: "French" },
  { id: "it", code: "IT", native: "Italiano", english: "Italian" },
  { id: "de", code: "DE", native: "Deutsch", english: "German" },
  { id: "nl", code: "NL", native: "Nederlands", english: "Dutch" },
  { id: "pl", code: "PL", native: "Polski", english: "Polish" },
  { id: "tr", code: "TR", native: "Türkçe", english: "Turkish" },
  { id: "id", code: "ID", native: "Bahasa Indonesia", english: "Indonesian" },
  { id: "vi", code: "VI", native: "Tiếng Việt", english: "Vietnamese" },
  { id: "el", code: "EL", native: "Ελληνικά", english: "Greek" },
  { id: "uk", code: "UA", native: "Українська", english: "Ukrainian" },
  { id: "ru", code: "RU", native: "Русский", english: "Russian" },
  { id: "zh-Hans", code: "简", native: "简体中文", english: "Chinese (Simplified)" },
  { id: "zh-Hant", code: "繁", native: "繁體中文", english: "Chinese (Traditional)" },
  { id: "ja", code: "JA", native: "日本語", english: "Japanese" },
  { id: "ko", code: "KO", native: "한국어", english: "Korean" },
  { id: "hi", code: "HI", native: "हिन्दी", english: "Hindi" },
  { id: "ar", code: "AR", native: "العربية", english: "Arabic", rtl: true },
  { id: "he", code: "HE", native: "עברית", english: "Hebrew", rtl: true },
];

/** A UI string key (the English text). */
export type MessageKey = (typeof EN_KEYS)[number];
/** A locale's string table: exactly the English key set. */
export type Messages = { [K in MessageKey]: string };

const LOADERS = import.meta.glob<{ default: Messages }>("./locales/*.ts");
const loaderFor = (id: string) => LOADERS[`./locales/${id}.ts`];

/** Locales with a bundled string table (en is built in). Any other shows a "coming soon" toast. */
export const AVAILABLE_LOCALES: string[] = LOCALES.filter((l) => l.id === "en" || loaderFor(l.id)).map((l) => l.id);

export const localeById = (id: string): Locale => LOCALES.find((l) => l.id === id) ?? LOCALES[0];

let current = "en";
let table: Partial<Record<string, string>> = {};

function applyDocument(id: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = id;
  document.documentElement.dir = localeById(id).rtl ? "rtl" : "ltr";
}

/** Load `id`'s string table (lazy chunk) and make it current; unknown ids fall back to English. */
export async function loadLocale(id: string): Promise<string> {
  const load = id === "en" ? undefined : loaderFor(id);
  const next = load ? (await load()).default : {};
  current = load ? id : "en";
  table = next;
  applyDocument(current);
  return current;
}

/** Synchronously switch to an already-loaded table (tests) or back to English. */
export function setLocale(id: string, messages?: Partial<Messages>): void {
  current = id === "en" || messages ? id : "en";
  table = id === "en" ? {} : (messages ?? {});
  applyDocument(current);
}

export const getLocale = (): string => current;

export const isRtl = (): boolean => typeof document !== "undefined" && document.documentElement.dir === "rtl";

const BASE = (): string => (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

/** Locale named by the URL's first path segment (`/es/…` → "es"); "en" when there is none. */
export function localeFromPath(pathname: string): string {
  const root = BASE();
  const rest = pathname.startsWith(root) ? pathname.slice(root.length) : pathname.replace(/^\//, "");
  const seg = rest.split("/")[0];
  return seg !== "en" && LOCALES.some((l) => l.id === seg) ? seg : "en";
}

/** `pathname` without its locale prefix (always starts with the base path). */
export function stripLocale(pathname: string): string {
  const loc = localeFromPath(pathname);
  if (loc === "en") return pathname;
  const root = BASE();
  return root + pathname.slice(root.length + loc.length).replace(/^\//, "");
}

/** Path under the current (or given) locale's prefix: `localePath("pricing/")` → "/es/pricing/". */
export const localePath = (rest = "", id = current): string => `${BASE()}${id === "en" ? "" : `${id}/`}${rest.replace(/^\//, "")}`;

/** URL of the current page in another language (original `ug()`: same page + hash, new path prefix). */
export function localeUrl(id: string, href = location.href): string {
  const url = new URL(href);
  const root = BASE();
  url.pathname = localePath(stripLocale(url.pathname).slice(root.length), id);
  return url.toString();
}

const missing = new Set<string>();
/** Keys looked up in a non-English locale that have no translation (dev aid; lesson content is expected here). */
export const missingKeys = (): string[] => [...missing];

/** Translate `key` and interpolate `{name}` placeholders. Missing keys fall back to English (the key itself). */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = table[key];
  if (s == null) {
    if (current !== "en") missing.add(key);
    s = key;
  }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Marks a string as a UI key for extraction without translating it (original `D(key)`); translate with t() at render. */
export const D = <T extends string>(key: T): T => key;

/** Interpolate `{name}` placeholders without translating: long-form English-only copy (legal/about prose, lesson text). */
export const fmt = (s: string, vars?: Record<string, string | number>): string =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
