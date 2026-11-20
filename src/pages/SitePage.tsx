import { useEffect } from "react";
import type { ReactNode } from "react";
import { BRAND } from "../brand";
import { t } from "../i18n";
import { showToast } from "../app/store";
import { Toast } from "../components/Overlays";
import { SiteLinks } from "./SiteLinks";
import { homeHref } from "./routes";
import type { PageId } from "./routes";

function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.7 4.7 0 0 1-2 3v2.6h3.4c2-1.9 3-4.5 3-7.6Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.8-2.4l-3.4-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4H2.9a10 10 0 0 0 9.1 5.9Z" />
      <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.3H2.9a10 10 0 0 0 0 9.4Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9.1 5.3L6.4 10c.8-2.3 3-4 5.6-4Z" />
    </svg>
  );
}

/** Green "Start learning →" link (also used for plan CTAs). */
export function StartLearning({ label = "Start learning", href = homeHref() }: { label?: string; href?: string }) {
  return (
    <a className="start-learning" href={href}>
      {t(label)} <span aria-hidden="true">→</span>
    </a>
  );
}

/** Owner-review banner for placeholder legal copy. */
export function TodoNote({ children }: { children: ReactNode }) {
  return (
    <p className="todo-note" role="note">
      <b>TODO</b> {children}
    </p>
  );
}

export interface SitePageProps {
  page: PageId;
  title: string;
  heading: string;
  lead: ReactNode;
  children: ReactNode;
}

/** Static info page shell: header (brand, site nav, sign-in), hero card, body card, footer links. */
export function SitePage({ page, title, heading, lead, children }: SitePageProps) {
  useEffect(() => {
    document.title = `${title} | ${BRAND.name}`;
    const root = document.documentElement;
    root.dataset.page = page;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue("--card").trim() || meta.content;
    return () => {
      delete root.dataset.page;
    };
  }, [page, title]);

  return (
    <div className="site-page">
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href={homeHref()}>
            <img src="/favicon.svg" width={30} height={30} alt="" /> {BRAND.name}
          </a>
          <SiteLinks current={page} className="" />
          <div id="course-account">
            <button
              type="button"
              data-login=""
              aria-label={t("Sign in with Google")}
              title={t("Sign in with Google")}
              onClick={() => showToast(t("Sign-in is temporarily unavailable. Please try again."), "user")}
            >
              <GoogleMark />
              <span>{t("Sign in")}</span>
            </button>
          </div>
        </div>
      </header>
      <main className="shell">
        <section className="info-hero" aria-labelledby="page-heading">
          <div>
            <h1 id="page-heading">{heading}</h1>
            <p>{lead}</p>
          </div>
          <StartLearning />
        </section>
        <div className="info-body">{children}</div>
      </main>
      <footer className="shell">
        <SiteLinks />
      </footer>
      <Toast />
    </div>
  );
}
