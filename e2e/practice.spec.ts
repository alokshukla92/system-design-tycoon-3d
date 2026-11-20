import type { Page } from "@playwright/test";
import { expect, readStorage, test } from "./fixtures";

const cards = (page: Page) => page.locator(".lab-cards [data-level-id]");

async function startFromBrief(page: Page): Promise<void> {
  const brief = page.locator("dialog#lab-brief");
  await expect(brief).toBeVisible();
  await brief.locator(".lab-action").click();
  await expect(brief).toBeHidden();
}

test.describe("Practice", () => {
  test("menu lists campaign, incident and interview modes", async ({ page }) => {
    await page.goto("/#/practice");
    const tabs = page.locator(".lab-tabs--page [role=tab]");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

    // Campaign: only level 1 is unlocked.
    await expect(cards(page).first()).toHaveAttribute("data-level-id", "l1");
    expect(await cards(page).count()).toBeGreaterThan(1);
    await expect(cards(page).nth(0).locator(".lab-play")).toBeEnabled();
    await expect(cards(page).nth(1).locator(".lab-play")).toBeDisabled();

    await tabs.nth(1).click();
    await expect(page).toHaveURL(/#\/practice\/incident$/);
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(cards(page).first().locator(".lab-play")).toBeEnabled();

    await tabs.nth(2).click();
    await expect(page).toHaveURL(/#\/practice\/interview$/);
    await expect(cards(page).first()).toHaveAttribute("data-level-id", /^iv-/);
  });

  test("campaign level 1: brief → run → debrief", async ({ page }) => {
    await page.clock.install();
    await page.goto("/#/practice/campaign");
    await cards(page).first().locator(".lab-play").click();
    await expect(page).toHaveURL(/#\/play\/campaign\/l1$/);
    await startFromBrief(page);

    const clock = page.locator(".lab-run__clock");
    await expect(clock).toContainText("t+0/100m");
    await page.locator('[aria-label="Speed"] button', { hasText: "4×" }).click();
    await page.locator("#lab-run").click();
    await expect(page.locator("#lab-run")).toContainText("Pause");

    // 100 simulated minutes at 4× (175 ms each), on the fake clock.
    await page.clock.runFor(100 * 175 + 1_000);
    const debrief = page.locator("dialog#lab-debrief");
    await expect(debrief).toBeVisible();
    await expect(debrief.locator("#lab-debrief-title")).toContainText("Postmortem");
    await expect.poll(async () => Object.keys((await readStorage<Record<string, unknown>>(page, "practice")) ?? {})).toContain("l1");
  });

  test("interview: submit the design for a report", async ({ page }) => {
    await page.goto("/#/practice/interview");
    const id = await cards(page).first().getAttribute("data-level-id");
    await cards(page).first().locator(".lab-play").click();
    await expect(page).toHaveURL(new RegExp(`#/play/interview/${id}$`));
    await startFromBrief(page);

    await page.locator("#lab-submit").click();
    const report = page.locator("dialog#lab-report");
    await expect(report).toBeVisible();
    await expect(report.locator("#lab-report-title")).not.toBeEmpty();
    await expect.poll(async () => Object.keys((await readStorage<Record<string, unknown>>(page, "practice")) ?? {})).toContain(id);

    await report.locator('a[href="#/practice/interview"]').click();
    await expect(page).toHaveURL(/#\/practice\/interview$/);
    await expect(report).toBeHidden();
  });
});
