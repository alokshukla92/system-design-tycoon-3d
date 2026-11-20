import { BRAND } from "../brand";
import { t } from "../i18n";

/** `.credit` — the original's author credit slot (CSS present in the original, unused there), carrying the owner's byline. */
export function Credit() {
  return (
    <a
      className="credit"
      href={`mailto:${BRAND.supportEmail}`}
      title={t("Contact {name}", { name: BRAND.author })}
      aria-label={t("Designed & built by {name}", { name: BRAND.author })}
    >
      <span className="credit__x" aria-hidden="true">
        {BRAND.authorInitials}
      </span>
      <span className="credit__text">
        <small>{t("Built by")}</small>
        <b>
          <span>{BRAND.author}</span>
        </b>
      </span>
    </a>
  );
}

/** Footer byline: "Designed & built by Alok Shukla" (name links to the owner's email). */
export function SiteCredit() {
  const [before, after = ""] = t("Designed & built by {name}").split("{name}");
  return (
    <p className="site-credit">
      <span>
        {before}
        <a href={`mailto:${BRAND.supportEmail}`} title={t("Contact {name}", { name: BRAND.author })}>
          {BRAND.author}
        </a>
        {after}
      </span>
    </p>
  );
}
