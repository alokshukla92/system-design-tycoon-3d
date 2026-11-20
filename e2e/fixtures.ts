import { test as base, expect, type Page } from "@playwright/test";

export type Layout = "desktop" | "tablet" | "stack";

interface Fixtures {
  /** Console errors and uncaught page errors seen during the test; the test fails if any remain. */
  pageErrors: string[];
}

export const test = base.extend<Fixtures>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
      });
      await use(errors);
      expect(errors, `console / page errors on ${page.url()}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Layout the app should pick for the current project's viewport (mirrors index.html / applyLayout). */
export function expectedLayout(page: Page): Layout {
  const { width: w, height: h } = page.viewportSize()!;
  return w >= 1200 && h >= 560 ? "desktop" : w >= 960 && h >= 600 ? "tablet" : "stack";
}

/** Current step title (the outgoing copy is a `.guide__ghost` clone while it slides out). */
export const GUIDE_TITLE = "#guide .guide__content:not(.guide__ghost) .guide__title";

export const isDesktop = (page: Page) => expectedLayout(page) === "desktop";

/** Open a classroom hash route and wait for the app to have rendered it. */
export async function openLesson(page: Page, hash: string): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.locator(GUIDE_TITLE)).toBeVisible();
}

/** On tablet / phone the sidebar is an off-canvas drawer: open it so its contents can be used. */
export async function openSidebar(page: Page): Promise<void> {
  if (isDesktop(page)) return;
  await page.locator("#menu-btn").click();
  await expect(page.locator("html")).toHaveClass(/\bis-drawer\b/);
  await expect(page.locator("#drawer-close")).toBeFocused();
}

export async function readStorage<T>(page: Page, name: string): Promise<T | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), `sdt:${name}`);
}

export const hashOf = (page: Page) => new URL(page.url()).hash;
