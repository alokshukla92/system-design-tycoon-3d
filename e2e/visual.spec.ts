import type { Page } from "@playwright/test";
import { expect, openLesson, test } from "./fixtures";

// Pixel baselines are platform specific (fonts, rasterisation). They're generated on macOS
// (`npm run e2e:update`) and skipped on CI, which runs Linux.
test.skip(!!process.env.CI, "visual baselines are macOS-only");

// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  test.skip(info.project.name === "tablet", "visual set covers desktop + mobile");
});

/** Diagram, packets and animated metric chips are nondeterministic — mask them. */
const masks = (page: Page) => [page.locator("#canvas"), page.locator("#hud"), page.locator("#lab-canvas")];

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: "reduce" });
}

test.describe("Visual", () => {
  test("lesson chrome", async ({ page }) => {
    await openLesson(page, "#/day-one/2");
    await settle(page);
    await expect(page).toHaveScreenshot("lesson.png", { mask: masks(page) });
  });

  test("lesson chrome — dark", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("sdt:theme", '"dark"'));
    await openLesson(page, "#/day-one/1");
    await settle(page);
    await expect(page).toHaveScreenshot("lesson-dark.png", { mask: masks(page) });
  });

  test("search modal", async ({ page }) => {
    await openLesson(page, "#/day-one/1");
    await settle(page);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.locator(".sx")).toHaveClass(/\bis-open\b/);
    await page.getByRole("combobox").fill("cache");
    await expect(page.locator(".sx__item").first()).toBeVisible();
    await expect(page.locator(".sx__dialog")).toHaveScreenshot("search.png");
  });

  test("pricing page", async ({ page }) => {
    await page.goto("/pricing/");
    await expect(page.locator("#page-heading")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("pricing.png");
  });

  test("practice menu", async ({ page }) => {
    await page.goto("/#/practice");
    await expect(page.locator(".lab-cards [data-level-id]").first()).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("practice.png", { mask: masks(page) });
  });
});
