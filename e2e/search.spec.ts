import type { Page } from "@playwright/test";
import { expect, openLesson, test } from "./fixtures";

test.describe("Search", () => {
  test.beforeEach(async ({ page }) => {
    await openLesson(page, "#/day-one/1");
  });

  const modal = (page: Page) => page.locator(".sx");
  const input = (page: Page) => page.getByRole("combobox");

  test("⌘K / Ctrl+K toggles the modal and Esc closes it", async ({ page }) => {
    await expect(modal(page)).toBeHidden();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(modal(page)).toHaveClass(/\bis-open\b/);
    await expect(input(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(modal(page)).toBeHidden();

    await page.keyboard.press("Control+k");
    await expect(modal(page)).toHaveClass(/\bis-open\b/);
    await page.keyboard.press("Control+k");
    await expect(modal(page)).toBeHidden();
  });

  test('"/" opens the modal; empty query lists modules', async ({ page }) => {
    await page.keyboard.press("/");
    await expect(modal(page)).toHaveClass(/\bis-open\b/);
    await expect(input(page)).toHaveValue("");
    await expect(page.locator(".sx__item").first()).toBeVisible();
    await page.getByRole("button", { name: "Close search" }).click();
    await expect(modal(page)).toBeHidden();
  });

  test("query returns results and Enter navigates", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+k");
    await input(page).fill("slow burn");
    const items = page.locator(".sx__item");
    await expect(items.first()).toBeVisible();
    await expect(page.locator(".sx__item.is-sel")).toHaveCount(1);
    await expect(page.locator(".sx__item.is-sel mark").first()).toBeVisible();
    const href = await page.locator(".sx__item.is-sel").getAttribute("href");
    expect(href).toMatch(/^#\/the-slow-burn\/\d+$/);
    await page.keyboard.press("Enter");
    await expect(modal(page)).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${href!.replace(/\//g, "\\/")}$`));
    await expect(page.locator("#head .title")).toHaveText("The Slow Burn");
  });

  test("arrow keys move the selection", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+k");
    await input(page).fill("cache");
    await expect(page.locator(".sx__item").nth(1)).toBeVisible();
    const first = await page.locator(".sx__item.is-sel").getAttribute("id");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".sx__item.is-sel")).not.toHaveAttribute("id", first!);
    await page.keyboard.press("ArrowUp");
    await expect(page.locator(".sx__item.is-sel")).toHaveAttribute("id", first!);
  });

  test("nonsense query shows the empty state with suggestions", async ({ page }) => {
    await page.keyboard.press("ControlOrMeta+k");
    await input(page).fill("zzqxjv");
    await expect(page.locator(".sx__empty-title")).toHaveText("Nothing matches “zzqxjv”");
    await expect(page.locator(".sx__item")).toHaveCount(0);
    const chip = page.locator(".sx__chips [data-q]").first();
    const q = await chip.getAttribute("data-q");
    await chip.click();
    await expect(input(page)).toHaveValue(q!);
    await expect(page.locator(".sx__item").first()).toBeVisible();

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(input(page)).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(modal(page)).toBeHidden();
  });
});
