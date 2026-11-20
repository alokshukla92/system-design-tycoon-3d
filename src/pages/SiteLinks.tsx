import { BRAND } from "../brand";
import { t } from "../i18n";
import { SITE_LINKS, pageHref } from "./routes";
import type { PageId } from "./routes";

/** `nav.site-links` — the original's footer links (Pricing · About · Contact · Privacy · Terms of Service). */
export function SiteLinks({ current, className = "site-links" }: { current?: PageId | null; className?: string }) {
  return (
    <nav className={className} aria-label={t("Site information")}>
      {SITE_LINKS.map((l) => (
        <a key={l.id} href={pageHref(l.id)} aria-current={l.id === current ? "page" : undefined}>
          {t(l.label)}
        </a>
      ))}
    </nav>
  );
}

export const mailto = (subject?: string): string =>
  `mailto:${BRAND.supportEmail}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;

/** Support email link (placeholder address lives in src/brand.ts). */
export function SupportEmail({ subject }: { subject?: string }) {
  return (
    <a href={mailto(subject)} dir="ltr">
      {BRAND.supportEmail}
    </a>
  );
}
