// UI string table + translator. Only English ships; other locales fall back to English keys.
// Keys are the English source strings (as in the original), so t("Back") === "Back" in en.

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

/** Locales whose string tables are bundled. Picking any other shows a "coming soon" toast. */
export const AVAILABLE_LOCALES = ["en"];

export const localeById = (id: string): Locale => LOCALES.find((l) => l.id === id) ?? LOCALES[0];

type Table = Record<string, string>;

// English needs no overrides: keys are the English text. Add `{ es: {...} }` etc. to translate.
const TABLES: Record<string, Table> = { en: {} };

let current = "en";

export function setLocale(id: string): void {
  current = TABLES[id] ? id : "en";
  document.documentElement.lang = current;
  document.documentElement.dir = localeById(current).rtl ? "rtl" : "ltr";
}

export const getLocale = (): string => current;

export const isRtl = (): boolean => document.documentElement.dir === "rtl";

/** Translate `key` and interpolate `{name}` placeholders. Missing keys fall back to English (the key itself). */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = TABLES[current]?.[key] ?? TABLES.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}
