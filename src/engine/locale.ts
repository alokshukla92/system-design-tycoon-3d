// Locale hooks used by the renderer (RTL text direction, chart captions, upper-casing).
// The app's i18n layer can install real implementations via setEngineLocale(); defaults are English/LTR.

export interface EngineLocale {
  /** Current language tag (for Intl.Segmenter / toLocaleUpperCase). */
  lang: () => string;
  /** True when the UI language is right-to-left. */
  rtl: () => boolean;
  /** Translate a fixed UI string ("utilization →", "latency"). */
  t: (s: string) => string;
}

const locale: EngineLocale = {
  lang: () => (typeof document !== "undefined" && document.documentElement.lang) || "en",
  rtl: () => false,
  t: (s) => s,
};

export function setEngineLocale(next: Partial<EngineLocale>): void {
  Object.assign(locale, next);
}

export const getLocale = (): EngineLocale => locale;

const RTL_SCRIPT = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;

/** Direction of a text run (only meaningful in RTL UIs). */
export const textDir = (s: string): "rtl" | "ltr" =>
  locale.rtl() && RTL_SCRIPT.test(String(s).replace(/<[^>]+>/g, "")) ? "rtl" : "ltr";

/** ` direction="…"` attribute in RTL UIs, empty otherwise. */
export const dirAttr = (s: string): string => (locale.rtl() ? ` direction="${textDir(s)}"` : "");

export const upper = (s: string): string => {
  try {
    return s.toLocaleUpperCase(locale.lang());
  } catch {
    return s.toUpperCase();
  }
};
