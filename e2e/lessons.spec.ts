import { COURSE } from "../src/content/course";
import { GUIDE_TITLE, expect, hashOf, openLesson, openSidebar, readStorage, test } from "./fixtures";

/** Lessons in the course (the progress card counts every course lesson). */
const TOTAL = COURSE.reduce((n, m) => n + m.lessons.length, 0);

test.describe("Lessons", () => {
  test("deep link renders the lesson and step", async ({ page }) => {
    await openLesson(page, "#/day-one/2");
    await expect(page.locator("#head .title")).toHaveText("Day One");
    await expect(page.locator(GUIDE_TITLE)).toHaveText("Front page of Hacker News");
    await expect(page.locator("#tl-count")).toHaveText("Step 2 of 5");
    await expect(page.locator('#timeline li.is-current button[data-step="1"]')).toHaveCount(1);
    await expect(page.locator('#timeline li.is-done button[data-step="0"]')).toHaveCount(1);
    await expect(page.locator('#sidebar li.lesson.is-current[data-lesson="day-one"]')).toHaveCount(1);
  });

  test("Next / Back buttons and arrow keys step through the lesson", async ({ page }) => {
    await openLesson(page, "#/day-one/1");
    const back = page.locator("#back");
    await expect(back).toBeDisabled();

    await page.locator("#next").click();
    await expect(page).toHaveURL(/#\/day-one\/2$/);
    await expect(page.locator("#tl-count")).toHaveText("Step 2 of 5");

    await back.click();
    await expect(page).toHaveURL(/#\/day-one\/1$/);
    await expect(page.locator("#tl-count")).toHaveText("Step 1 of 5");

    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/day-one\/2$/);
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/day-one\/3$/);
    await expect(page.locator(GUIDE_TITLE)).toHaveText("Going vertical — in the bad sense");
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/#\/day-one\/2$/);
    await expect(page.locator("#tl-count")).toHaveText("Step 2 of 5");

    // ArrowLeft on step 1 stays put.
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/#\/day-one\/1$/);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator("#tl-count")).toHaveText("Step 1 of 5");
    expect(hashOf(page)).toBe("#/day-one/1");
  });

  test("timeline dot jumps to a step", async ({ page }) => {
    await openLesson(page, "#/day-one/1");
    await page.locator('#timeline button[data-step="3"]').click();
    await expect(page).toHaveURL(/#\/day-one\/4$/);
    await expect(page.locator("#tl-count")).toHaveText("Step 4 of 5");
    await expect(page.locator("#timeline li.is-done")).toHaveCount(3);
  });

  test("finishing a lesson marks it done and Next opens the next lesson", async ({ page }) => {
    await openLesson(page, "#/day-one/4");
    expect(await readStorage<string[]>(page, "done")).toBeNull();
    await expect(page.locator("#progress .progress__pct")).toHaveText(`0 / ${TOTAL}`);

    await page.locator("#next").click();
    await expect(page.locator("#tl-count")).toHaveText("Step 5 of 5");
    await expect(page.locator("#next")).toContainText("The Slow Burn");
    await expect.poll(() => readStorage<string[]>(page, "done")).toEqual(["day-one"]);
    await expect(page.locator('#sidebar li[data-lesson="day-one"]')).toHaveAttribute("data-done", "true");
    await expect(page.locator('#sidebar .mod__head[data-mod="startup-career"] .mod__count')).toHaveText("1/10");
    await expect(page.locator("#progress .progress__pct")).toHaveText(`1 / ${TOTAL}`);

    await page.locator("#next").click();
    await expect(page).toHaveURL(/#\/the-slow-burn\/1$/);
    await expect(page.locator("#head .title")).toHaveText("The Slow Burn");
    await expect(page.locator("#tl-count")).toHaveText("Step 1 of 5");
  });

  test("last position and progress persist across reloads", async ({ page }) => {
    await openLesson(page, "#/day-one/5");
    await expect.poll(() => readStorage(page, "last")).toEqual({ lessonId: "day-one", step: 4 });
    await page.locator('#timeline button[data-step="2"]').click();
    await expect.poll(() => readStorage(page, "last")).toEqual({ lessonId: "day-one", step: 2 });

    // No hash: the app resumes from sdt:last.
    await page.goto("/");
    await expect(page.locator("#head .title")).toHaveText("Day One");
    await expect(page.locator("#tl-count")).toHaveText("Step 3 of 5");
    await expect(page.locator('#sidebar li[data-lesson="day-one"]')).toHaveAttribute("data-done", "true");
    await expect(page.locator("#progress .progress__pct")).toHaveText(`1 / ${TOTAL}`);

    await page.reload();
    await expect(page.locator("#tl-count")).toHaveText("Step 3 of 5");
    expect(await readStorage<string[]>(page, "done")).toEqual(["day-one"]);
  });

  test("sidebar opens another lesson and the progress card expands", async ({ page }) => {
    await openLesson(page, "#/day-one/1");
    await openSidebar(page);
    await page.locator('#sidebar li[data-lesson="chatterbox"] a').click();
    await expect(page).toHaveURL(/#\/chatterbox\/1$/);
    await expect(page.locator("#head .title")).toHaveText("Chatterbox");
    await expect(page.locator('#sidebar li.lesson.is-current[data-lesson="chatterbox"] a')).toHaveAttribute("aria-current", "page");
    // The drawer closes on navigation.
    await expect(page.locator("html")).not.toHaveClass(/\bis-drawer\b/);

    // Switch module through its accordion header.
    await openSidebar(page);
    const head = page.locator('#sidebar .mod__head[data-mod="incident-commander"]');
    await head.click();
    await expect(head).toHaveAttribute("aria-expanded", "true");
    await page.locator('#sidebar li[data-lesson="code-red"] a').click();
    await expect(page).toHaveURL(/#\/code-red\/1$/);

    await openSidebar(page);
    const progress = page.locator("#progress .progress__head");
    await expect(progress).toHaveAttribute("aria-expanded", "false");
    await progress.click();
    await expect(progress).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => readStorage(page, "progressOpen")).toBe(true);
    await expect(page.locator("#progress .progress__list li")).toHaveCount(COURSE.length);
  });

  test.describe("lazy lesson chunks", () => {
    // Lessons are code-split; `checkout` is not prefetched from day-one (only the next lesson is).
    const CHUNK = /\/assets\/checkout-[\w-]+\.js$/;
    const ERROR = "This lesson could not be loaded. Please try again.";

    test("the current lesson stays on screen while the next one loads", async ({ page }) => {
      let release = () => {};
      const gate = new Promise<void>((r) => (release = r));
      await page.route(CHUNK, async (route) => {
        await gate;
        await route.continue();
      });
      await openLesson(page, "#/day-one/2");
      await page.evaluate(() => (location.hash = "#/checkout/1"));
      await expect(page.locator("main.sheet")).toHaveAttribute("aria-busy", "true");
      await expect(page.locator("#head .title")).toHaveText("Day One");
      release();
      await expect(page.locator("#head .title")).toHaveText("Checkout");
      await expect(page.locator("#tl-count")).toHaveText(/^Step 1 of \d+$/);
      await expect(page.locator("main.sheet")).not.toHaveAttribute("aria-busy");
    });

    test("a lesson that fails to load shows the error toast and keeps the current lesson", async ({ page, pageErrors }) => {
      await page.route(CHUNK, (route) => route.abort());
      await openLesson(page, "#/day-one/2");
      await page.evaluate(() => (location.hash = "#/checkout/1"));
      await expect(page.locator(".toast__text")).toHaveText(ERROR);
      await expect(page.locator("#head .title")).toHaveText("Day One");
      await expect(page.locator("main.sheet")).not.toHaveAttribute("aria-busy");
      pageErrors.splice(0); // the aborted chunk request is logged as a console error
    });

    test("a failed first load falls back to the default lesson", async ({ page, pageErrors }) => {
      await page.route(CHUNK, (route) => route.abort());
      await page.goto("/#/checkout/1");
      await expect(page.locator(".toast__text")).toHaveText(ERROR);
      await expect(page.locator("#head .title")).toHaveText("Day One");
      await expect(page).toHaveURL(/#\/day-one\/1$/);
      pageErrors.splice(0);
    });
  });
});
