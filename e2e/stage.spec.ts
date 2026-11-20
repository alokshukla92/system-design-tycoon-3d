import { expect, openLesson, test } from "./fixtures";

test.describe("Stage tools", () => {
  test("diagram is labelled with the lesson and step", async ({ page }) => {
    await openLesson(page, "#/day-one/1");
    const svg = page.locator("#canvas svg").first();
    await expect(svg).toHaveAttribute("aria-label", "Day One — You shipped a weekend project");
    await expect(page.locator("#canvas svg [data-id]").first()).toBeAttached();
    await page.locator("#next").click();
    await expect(svg).toHaveAttribute("aria-label", "Day One — Front page of Hacker News");
  });

  test("Replay rebuilds the step's scene", async ({ page }) => {
    await openLesson(page, "#/day-one/2");
    const ents = page.locator("#canvas svg g.ent");
    await expect(ents.first()).toBeAttached();
    const before = await ents.count();
    await page.locator("#replay").click();
    await expect(ents).toHaveCount(before);
    await page.keyboard.press("r");
    await expect(ents).toHaveCount(before);
    await expect(page).toHaveURL(/#\/day-one\/2$/);
  });

  test("Pause button and Space toggle traffic", async ({ page }) => {
    await openLesson(page, "#/day-one/1");
    const pause = page.locator("#pause");
    await expect(pause).not.toHaveClass(/\bis-on\b/);
    await pause.click();
    await expect(pause).toHaveClass(/\bis-on\b/);
    await expect(pause).toContainText("Play");
    await pause.blur();
    await page.keyboard.press("Space");
    await expect(pause).not.toHaveClass(/\bis-on\b/);
    await expect(pause).toContainText("Pause");
    await page.keyboard.press("Space");
    await expect(pause).toHaveClass(/\bis-on\b/);
  });

  test("double-click zooms in, then 0 / Fit restores the whole diagram", async ({ page }) => {
    await openLesson(page, "#/day-one/1");
    const fit = page.locator("#fit");
    await expect(fit).toBeHidden();
    const canvas = page.locator("#canvas");
    await canvas.dblclick({ position: { x: 40, y: 40 } });
    await expect(fit).toBeVisible();
    await page.keyboard.press("0");
    await expect(fit).toBeHidden();

    await canvas.dblclick({ position: { x: 40, y: 40 } });
    await expect(fit).toBeVisible();
    await fit.click();
    await expect(fit).toBeHidden();

    // Changing step resets the zoom too.
    await canvas.dblclick({ position: { x: 40, y: 40 } });
    await expect(fit).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/day-one\/2$/);
    await expect(fit).toBeHidden();
  });
});
