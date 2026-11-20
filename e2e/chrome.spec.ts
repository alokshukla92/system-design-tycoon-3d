import { expect, expectedLayout, isDesktop, openLesson, readStorage, test } from "./fixtures";

test.describe("Theme", () => {
  test("toggle sets data-theme, persists, and boots without a flash", async ({ page }) => {
    await openLesson(page, "#/day-one/1");
    const html = page.locator("html");
    await expect(html).not.toHaveAttribute("data-theme", "dark");
    await page.locator("#theme-btn").click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("#theme-btn")).toHaveAttribute("aria-label", "Switch to light theme");
    await expect.poll(() => readStorage(page, "theme")).toBe("dark");

    // Record the theme at the moment <body> is parsed — before any module script runs.
    await page.addInitScript(() => {
      new MutationObserver((_, obs) => {
        if (!document.body) return;
        (window as unknown as { __themeAtBody?: string }).__themeAtBody = document.documentElement.dataset.theme ?? "";
        obs.disconnect();
      }).observe(document, { childList: true, subtree: true });
    });
    await page.reload();
    expect(await page.evaluate(() => (window as unknown as { __themeAtBody?: string }).__themeAtBody)).toBe("dark");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('meta[name="theme-color"]')).not.toHaveAttribute("content", "#f4ebe0");

    await page.locator("#theme-btn").click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect.poll(() => readStorage(page, "theme")).toBe("light");
  });
});

test.describe("Layout modes", () => {
  test("data-layout matches the viewport", async ({ page }) => {
    await openLesson(page, "#/day-one/1");
    await expect(page.locator("html")).toHaveAttribute("data-layout", expectedLayout(page));
    await expect(page.locator("#menu-btn")).toBeVisible({ visible: !isDesktop(page) });
    if (isDesktop(page)) await expect(page.locator("#sidebar")).toBeInViewport();
    else await expect(page.locator("#sidebar")).not.toBeInViewport();
  });

  test("drawer opens and closes (close button, backdrop, Esc)", async ({ page }) => {
    test.skip(isDesktop(page), "the sidebar is always docked on desktop");
    await openLesson(page, "#/day-one/1");
    const html = page.locator("html");
    const menu = page.locator("#menu-btn");
    const sidebar = page.locator("#sidebar");
    await expect(sidebar).not.toBeInViewport();

    await menu.click();
    await expect(html).toHaveClass(/\bis-drawer\b/);
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#drawer-close")).toBeFocused();
    await expect(sidebar).toBeInViewport();
    await page.locator("#drawer-close").click();
    await expect(html).not.toHaveClass(/\bis-drawer\b/);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();

    await menu.click();
    await expect(html).toHaveClass(/\bis-drawer\b/);
    const vp = page.viewportSize()!;
    await page.locator("#drawer-backdrop").click({ position: { x: vp.width - 10, y: vp.height / 2 } });
    await expect(html).not.toHaveClass(/\bis-drawer\b/);

    await menu.click();
    await expect(page.locator("#drawer-close")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(html).not.toHaveClass(/\bis-drawer\b/);
    await expect(sidebar).not.toBeInViewport();
  });

  test("stack layout pins Back / Next in a bottom bar", async ({ page }) => {
    test.skip(expectedLayout(page) !== "stack", "bottom bar only exists in the stack layout");
    await openLesson(page, "#/day-one/1");
    const nav = page.locator("#guide .guide__nav");
    await expect(nav).toHaveCSS("position", "fixed");
    const box = (await nav.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);
    await page.locator("#next").tap();
    await expect(page).toHaveURL(/#\/day-one\/2$/);
    await expect(page.locator("#tl-count")).toHaveText("Step 2 of 5");
    await page.locator("#back").tap();
    await expect(page).toHaveURL(/#\/day-one\/1$/);
  });
});
