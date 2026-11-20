import { useEffect, useRef, useState } from "react";
import { BRAND } from "../brand";
import { AVAILABLE_LOCALES, LOCALES, getLocale, isRtl, localeById, t } from "../i18n";
import { SEARCH_SHORTCUT } from "../search";
import { setDrawer, toggleTheme } from "../app/controller";
import { setState, showToast, useClassroom } from "../app/store";
import { learnHref } from "../app/router";
import type { LabRoute } from "../app/router";
import { useLabRoute } from "../app/useHash";
import { Icon } from "./Icon";

export const NAV = [
  { key: "Learn", icon: "book", soon: "" },
  { key: "Practice", icon: "settings", soon: "" },
  { key: "Design Lab", icon: "window", soon: "" },
  { key: "Cheatsheets", icon: "sheets", soon: "Cheatsheets are coming soon" },
] as const;

/** Nav section for the current route. */
export function navKeyFor(route: LabRoute | null): string {
  if (!route) return "Learn";
  return route.view === "lab" ? "Design Lab" : "Practice";
}

export function onNav(key: string): void {
  const item = NAV.find((n) => n.key === key);
  if (!item) return;
  if (key === "Learn") location.hash = learnHref();
  else if (key === "Practice") location.hash = "#/practice";
  else if (key === "Design Lab") location.hash = "#/lab";
  else if (item.soon) showToast(t(item.soon), item.icon);
}

export function NavItems({ size }: { size: number }) {
  const active = navKeyFor(useLabRoute());
  return (
    <>
      {NAV.map((n) => (
        <button
          key={n.key}
          type="button"
          className={n.key === active ? "nav__item btn-pop is-active" : "nav__item"}
          data-nav={n.key}
          aria-current={n.key === active ? "page" : undefined}
          onClick={() => {
            setDrawer(false);
            onNav(n.key);
          }}
        >
          <Icon name={n.icon} size={size} />
          <span>{t(n.key)}</span>
        </button>
      ))}
    </>
  );
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/** Brand name with its last word highlighted, like the original's "Designed to <span>Scale</span>". */
function BrandName() {
  const words = BRAND.name.split(" ");
  const last = words.pop();
  return (
    <h1 className="brand__name">
      {words.join(" ")} <span>{last}</span>
    </h1>
  );
}

export function Topbar({ onSearch }: { onSearch: () => void }) {
  const drawer = useClassroom((s) => s.drawer);
  return (
    <header className="topbar">
      <button
        className="menu-btn"
        id="menu-btn"
        type="button"
        aria-label={t("Open the course menu")}
        aria-controls="sidebar"
        aria-expanded={drawer}
        onClick={() => setDrawer(true)}
      >
        <Icon name="menu" size={19} stroke={2.2} />
      </button>
      <a className="brand" href="#/" aria-label={t("{brand} — home", { brand: BRAND.name })}>
        <img className="logo" src="/favicon.svg" width={30} height={30} alt="" />
        <BrandName />
      </a>
      <nav className="nav" aria-label={t("Sections")}>
        <NavItems size={17} />
      </nav>
      <button
        className="search"
        id="search-open"
        type="button"
        aria-label={t("Search the course")}
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
        onClick={onSearch}
      >
        <Icon name="search" size={16} stroke={2} />
        <span className="search__hint">{t("Search lessons & concepts…")}</span>
        <kbd>{SEARCH_SHORTCUT}</kbd>
      </button>
      <button
        className="overview-button"
        type="button"
        aria-label={t("Course")}
        title={t("Course")}
        onClick={() => {
          const el = document.getElementById("course-overview");
          el?.focus({ preventScroll: true });
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 8h6m-6 4h6m-6 4h4" />
        </svg>
      </button>
      <LangMenu />
      <ThemeButton />
      <div id="course-account">
        <button
          type="button"
          data-login=""
          aria-label={t("Sign in with Google")}
          title={t("Sign in with Google")}
          onClick={() => showToast(t("Sign-in is temporarily unavailable. Please try again."), "user")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.7 4.7 0 0 1-2 3v2.6h3.4c2-1.9 3-4.5 3-7.6Z" />
            <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.8-2.4l-3.4-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4H2.9a10 10 0 0 0 9.1 5.9Z" />
            <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.3H2.9a10 10 0 0 0 0 9.4Z" />
            <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9.1 5.3L6.4 10c.8-2.3 3-4 5.6-4Z" />
          </svg>
          <span>{t("Sign in")}</span>
        </button>
      </div>
    </header>
  );
}

function ThemeButton() {
  const theme = useClassroom((s) => s.theme);
  const dark = theme === "dark";
  return (
    <button
      className="theme-btn"
      id="theme-btn"
      type="button"
      aria-label={t(dark ? "Switch to light theme" : "Switch to dark theme")}
      title={t(dark ? "Light theme" : "Dark theme")}
      onClick={(e) => toggleTheme(e.currentTarget)}
    >
      <Icon name={dark ? "sun" : "moon"} size={16} stroke={2} />
    </button>
  );
}

export const openLangMenu = () => setState({ langOpen: true });

function LangMenu() {
  const open = useClassroom((s) => s.langOpen);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"" | "is-open" | "is-leaving">("");
  const menuRef = useRef<HTMLDivElement>(null);
  const current = localeById(getLocale());

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Mount hidden → reflow → add is-open so the entry transition runs.
      requestAnimationFrame(() => {
        const menu = menuRef.current;
        if (!menu) return;
        void menu.offsetWidth;
        setPhase("is-open");
        menu.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
      });
      const away = (e: MouseEvent) => {
        if (!(e.target as Element).closest(".lang, #lang-btn-2")) setState({ langOpen: false });
      };
      document.addEventListener("mousedown", away);
      return () => document.removeEventListener("mousedown", away);
    }
    if (!mounted) return;
    setPhase("is-leaving");
    const id = setTimeout(() => {
      setMounted(false);
      setPhase("");
    }, 160);
    return () => clearTimeout(id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: string) => {
    setState({ langOpen: false });
    if (id === getLocale()) return;
    if (!AVAILABLE_LOCALES.includes(id)) showToast(t("{name} is coming soon", { name: localeById(id).native }), "globe");
  };

  const onKey = (e: React.KeyboardEvent) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>(".lang__item") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const half = Math.ceil(items.length / 2);
    const side = isRtl() ? -1 : 1;
    const delta: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, ArrowRight: half * side, ArrowLeft: -half * side };
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setState({ langOpen: false });
      document.getElementById("lang-btn")?.focus();
    } else if (e.key in delta) {
      e.preventDefault();
      const n = items.length;
      items[(((i < 0 ? 0 : i) + delta[e.key]) % n + n) % n]?.focus();
    }
  };

  return (
    <div className="lang">
      <button
        className={`lang__btn${open ? " is-open" : ""}`}
        id="lang-btn"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="lang-menu"
        aria-label={t("Language: {name}", { name: current.english })}
        onClick={() => setState({ langOpen: !open })}
      >
        <Icon name="globe" size={16} stroke={2} />
        <span className="lang__code">{current.code}</span>
        <Icon name="chevronDown" size={14} stroke={2.2} cls="lang__chev" />
      </button>
      <div
        className={`lang__menu ${phase}`.trim()}
        id="lang-menu"
        role="menu"
        hidden={!mounted}
        ref={menuRef}
        onKeyDown={onKey}
      >
        <div className="lang__head">{t("Language")}</div>
        <div className="lang__grid">
          {LOCALES.map((l) => {
            const on = l.id === current.id;
            return (
              <button
                key={l.id}
                className={`lang__item${on ? " is-on" : ""}`}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                data-lang={l.id}
                onClick={() => pick(l.id)}
              >
                <span className="lang__tile">{on ? <Icon name="check" size={14} stroke={3} /> : l.code}</span>
                <span className="lang__names">
                  <b dir="auto" lang={l.id}>
                    {l.native}
                  </b>
                  <span>{l.english}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
