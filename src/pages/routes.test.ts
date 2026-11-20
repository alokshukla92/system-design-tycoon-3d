import { describe, expect, it } from "vitest";
import { labRoute } from "../app/router";
import { PAGES, SITE_LINKS, pageForPath, pageHref } from "./routes";
import { PLANS } from "./pricing.config";

describe("static page routes", () => {
  it("maps real paths (with or without trailing slash) to pages", () => {
    for (const p of PAGES) {
      expect(pageForPath(`/${p}/`)).toBe(p);
      expect(pageForPath(`/${p}`)).toBe(p);
      expect(pageForPath(`/${p}/index.html`)).toBe(p);
    }
  });

  it("keeps the classroom at the root", () => {
    expect(pageForPath("/")).toBeNull();
    expect(pageForPath("/index.html")).toBeNull();
  });

  it("accepts a locale prefix on every path", () => {
    expect(pageForPath("/es/")).toBeNull();
    expect(pageForPath("/zh-Hant/")).toBeNull();
    expect(pageForPath("/ar/pricing/")).toBe("pricing");
    expect(pageForPath("/de/nope/")).toBe("404");
    expect(pageForPath("/xx/")).toBe("404");
  });

  it("falls back to 404 for unknown paths", () => {
    expect(pageForPath("/does-not-exist")).toBe("404");
    expect(pageForPath("/pricing/extra/")).toBe("404");
  });

  it("links every site page in the original's footer order", () => {
    expect(SITE_LINKS.map((l) => pageHref(l.id))).toEqual(["/pricing/", "/about/", "/contact/", "/privacy/", "/terms/"]);
  });

  it("leaves hash routes to the classroom", () => {
    expect(labRoute("#/lab")).toEqual({ view: "lab" });
    expect(labRoute("#/practice/incident")).toEqual({ view: "practice", tab: "incident" });
    expect(labRoute("#/play/campaign/abc")).toEqual({ view: "play", mode: "campaign", id: "abc" });
    expect(labRoute("#/day-one/2")).toBeNull();
  });
});

describe("pricing config", () => {
  it("never links to a checkout", () => {
    for (const p of PLANS) expect(!!p.cta.href !== !!p.cta.toast).toBe(true);
    expect(PLANS.filter((p) => p.soon).every((p) => p.cta.toast)).toBe(true);
  });
});
