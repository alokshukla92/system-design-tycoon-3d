// Path routing for the static pages. Like the original (Astro pages at /pricing/, /about/ …) these are real
// paths, not hash routes; the classroom lives at "/" and keeps its own hash router (#/<lesson>/<step>, #/lab …).

export const PAGES = ["pricing", "about", "contact", "privacy", "terms"] as const;
export type SitePageId = (typeof PAGES)[number];
export type PageId = SitePageId | "404";

/** Footer / header link labels, in the original's order. */
export const SITE_LINKS: { id: SitePageId; label: string }[] = [
  { id: "pricing", label: "Pricing" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
  { id: "privacy", label: "Privacy" },
  { id: "terms", label: "Terms of Service" },
];

const base = (): string => (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

export const pageHref = (id: SitePageId): string => `${base()}${id}/`;
export const homeHref = (): string => base();

/** `null` = the classroom (site root); otherwise the static page for `pathname` ("404" when unknown). */
export function pageForPath(pathname: string): PageId | null {
  const root = base();
  let path = pathname.startsWith(root) ? pathname.slice(root.length) : pathname.replace(/^\//, "");
  path = path.replace(/\/+$/, "").replace(/\/index\.html$|^index\.html$/, "");
  if (path === "") return null;
  return (PAGES as readonly string[]).includes(path) ? (path as SitePageId) : "404";
}
