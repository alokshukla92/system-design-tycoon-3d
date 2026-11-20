import { GUIDE_TITLE, expect, test } from "./fixtures";

const PAGES = [
  { path: "/pricing/", id: "pricing", heading: "Course pricing" },
  { path: "/about/", id: "about" },
  { path: "/contact/", id: "contact" },
  { path: "/privacy/", id: "privacy" },
  { path: "/terms/", id: "terms" },
];

test.describe("Static pages", () => {
  for (const p of PAGES) {
    test(`${p.path} renders`, async ({ page }) => {
      await page.goto(p.path);
      await expect(page.locator("html")).toHaveAttribute("data-page", p.id);
      const h1 = page.locator("#page-heading");
      await expect(h1).toBeVisible();
      if (p.heading) await expect(h1).toHaveText(p.heading);
      await expect(page).toHaveTitle(/\| /);
      await expect(page.locator(".site-header a.brand")).toHaveAttribute("href", "/");
      await expect(page.locator(".info-body")).not.toBeEmpty();
      // The classroom isn't mounted on static pages.
      await expect(page.locator(".window")).toHaveCount(0);
    });
  }

  test("unknown path shows the 404 page", async ({ page }) => {
    await page.goto("/no-such-page/");
    await expect(page.locator("html")).toHaveAttribute("data-page", "404");
    await expect(page.locator("#page-heading")).toHaveText("Page not found");
    await expect(page.locator(".info-hero")).toContainText("/no-such-page/");
    await expect(page.locator(".info-body a[href*='#/day-one/']").first()).toBeVisible();
  });

  test("Pro CTA shows a toast; Free CTA links home", async ({ page }) => {
    await page.goto("/pricing/");
    await expect(page.locator('[data-plan="free"] a.start-learning')).toHaveAttribute("href", "/");
    await page.locator('[data-plan="pro"] button.start-learning').click();
    const toast = page.locator(".toast");
    await expect(toast).toHaveClass(/\bis-on\b/);
    await expect(toast).toContainText("Pro is coming soon");
  });

  test("Start learning returns to the classroom", async ({ page }) => {
    await page.goto("/about/");
    await page.locator(".info-hero a.start-learning").click();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/(#.*)?$/);
    await expect(page.locator(GUIDE_TITLE)).toBeVisible();
  });
});
