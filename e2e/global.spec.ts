import { COURSE } from "../src/content/course";
import { expect, test } from "./fixtures";

// Every route is visited with the auto `pageErrors` fixture watching: any console error or uncaught
// exception fails the test.
const LESSONS = COURSE.flatMap((m) => m.lessons.map((l) => l.id));

test.describe("Global", () => {
  test("every lesson renders without errors", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#tl-count")).toHaveText(/^Step 1 of \d+$/);
    for (const id of LESSONS) {
      await page.evaluate((h) => (location.hash = h), `#/${id}/1`);
      await expect(page.locator(`#sidebar li.lesson.is-current[data-lesson="${id}"]`)).toHaveCount(1);
      await expect(page.locator("#canvas svg").first()).toHaveAttribute("aria-label", /.+ — .+/);
      // Jump to the last step too (exercises the scene diff across the whole lesson).
      const last = await page.locator("#timeline button[data-step]").count();
      await page.evaluate((h) => (location.hash = h), `#/${id}/${last}`);
      await expect(page.locator("#tl-count")).toHaveText(`Step ${last} of ${last}`);
    }
  });

  test("practice, lab and static routes render without errors", async ({ page }) => {
    const routes: [string, string][] = [
      ["/#/lab", '#guide[aria-label="Sandbox"]'],
      ["/#/practice", ".lab-cards [data-level-id]"],
      ["/#/practice/incident", ".lab-cards [data-level-id]"],
      ["/#/practice/interview", ".lab-cards [data-level-id]"],
      ["/#/play/incident/inc-meltdown", "dialog#lab-brief"],
      ["/#/play/interview/iv-twitter", "dialog#lab-brief"],
      ["/#/play/campaign/l1", "dialog#lab-brief"],
      ["/pricing/", "#page-heading"],
      ["/about/", "#page-heading"],
      ["/contact/", "#page-heading"],
      ["/privacy/", "#page-heading"],
      ["/terms/", "#page-heading"],
      ["/missing/", "#page-heading"],
    ];
    for (const [url, ready] of routes) {
      await page.goto(url);
      await expect(page.locator(ready).first(), url).toBeVisible();
    }
  });

  test("unknown lesson hash falls back to a lesson", async ({ page }) => {
    await page.goto("/#/no-such-lesson/3");
    await expect(page.locator("#tl-count")).toHaveText(/^Step 1 of \d+$/);
    await expect(page.locator("#head .title")).not.toBeEmpty();
  });
});
