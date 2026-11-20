import type { Page } from "@playwright/test";
import { expect, openLesson, openSidebar, readStorage, test } from "./fixtures";

interface SavedLab {
  graph: { nodes: { id: string; data: { kind: string; instances: number } }[]; edges: { source: string; target: string }[] };
  origin?: { lessonId: string; step: number } | null;
}

const inspector = (page: Page) => page.locator("#guide.lab-inspect");
const chipValue = (page: Page, k: string) => page.locator(`#hud .chip[data-k="${k}"] .chip__value`);

async function openLab(page: Page): Promise<void> {
  await page.goto("/#/lab");
  await expect(page.locator('#guide[aria-label="Sandbox"]')).toBeVisible();
  await expect(page.locator("#lab-canvas svg [data-id]").first()).toBeAttached();
}

async function addComponent(page: Page, kind: string): Promise<void> {
  await openSidebar(page);
  await page.locator(`#lab-course li[data-kind="${kind}"] button`).click();
  await expect(page.locator("html")).not.toHaveClass(/\bis-drawer\b/);
}

test.describe("Design Lab", () => {
  test("build, configure, connect and persist a sandbox design", async ({ page }) => {
    await openLab(page);
    await expect(page.locator('.nav__item[data-nav="Design Lab"]').first()).toHaveAttribute("aria-current", "page");

    // Add Redis from the palette: it's selected, so the inspector opens.
    await addComponent(page, "redis");
    await expect(inspector(page)).toBeVisible();
    await expect(inspector(page).locator(".lab-inspect__title")).toContainText("Redis");
    await expect(page.locator('#lab-canvas svg [data-id="n100"]').first()).toBeAttached();

    // Horizontal scaling.
    const instances = inspector(page).locator('input[type="number"][aria-label="Instances"]');
    await expect(instances).toHaveValue("1");
    await inspector(page).getByRole("button", { name: "Increase Instances" }).click();
    await expect(instances).toHaveValue("2");

    // Esc deselects; picking the API server on the diagram selects it.
    await page.locator("body").press("Escape");
    await expect(inspector(page)).toBeHidden();
    await page.locator('#lab-canvas svg g.ent[data-id="start_api_server_1"]').click();
    await expect(inspector(page).locator(".lab-inspect__title")).toContainText("API Server");

    // Wire API Server → Redis.
    await inspector(page).getByLabel("Connect to").selectOption({ label: "Redis" });
    await expect(inspector(page).getByRole("button", { name: "Disconnect Redis" })).toBeVisible();

    await expect
      .poll(async () => {
        const lab = await readStorage<SavedLab>(page, "lab");
        const redis = lab?.graph.nodes.find((n) => n.data.kind === "redis");
        return { nodes: lab?.graph.nodes.length, instances: redis?.data.instances, wired: lab?.graph.edges.some((e) => e.target === redis?.id) };
      })
      .toEqual({ nodes: 4, instances: 2, wired: true });

    await page.reload();
    await expect(page.locator('#guide[aria-label="Sandbox"]')).toBeVisible();
    await expect(page.locator('#lab-canvas svg [data-id="n100"]').first()).toBeAttached();
    const lab = await readStorage<SavedLab>(page, "lab");
    expect(lab?.graph.nodes.map((n) => n.data.kind)).toEqual(["users", "api_server", "mongodb", "redis"]);
  });

  test("running the simulation updates the metric chips over time", async ({ page }) => {
    await openLab(page);
    const clock = page.locator(".lab-run__clock");
    await expect(clock).toHaveText("t+0m");
    await expect(chipValue(page, "rps")).toHaveText("–");

    const run = page.locator("#lab-run");
    await expect(run).toContainText("Launch");
    await page.locator('[aria-label="Speed"] button', { hasText: "4×" }).click();
    await run.click();
    await expect(run).toContainText("Pause");
    await expect(chipValue(page, "rps")).toHaveText(/^[\d.,]+[kKM]? rps$/);
    await expect(page.locator('#hud .chip[data-k="p95"] .chip__label')).toHaveText("p95 latency");
    const first = await chipValue(page, "rps").textContent();
    const firstTick = Number((await clock.textContent())!.replace(/\D/g, ""));
    await expect.poll(async () => Number((await clock.textContent())!.replace(/\D/g, ""))).toBeGreaterThan(firstTick + 3);
    // Sandbox traffic ramps up as the clock runs.
    await expect.poll(() => chipValue(page, "rps").textContent()).not.toBe(first);

    await run.click();
    await expect(run).toContainText("Resume");
    const paused = await clock.textContent();
    // Stepping advances exactly one simulated minute.
    await page.locator(".lab-run .lab-mini", { hasText: "Step" }).click();
    await expect(clock).toHaveText(`t+${Number(paused!.replace(/\D/g, "")) + 1}m`);
  });

  test("Tinker opens a lesson step in the lab with an origin note", async ({ page }) => {
    await openLesson(page, "#/day-one/2");
    await page.locator("#open-lab").click();
    await expect(page).toHaveURL(/#\/lab$/);
    const origin = page.locator("#lab-origin");
    await expect(origin).toBeVisible();
    await expect(origin.getByRole("link")).toHaveAttribute("href", "#/day-one/2");
    await expect(origin).toContainText("step 2");
    await expect.poll(async () => (await readStorage<SavedLab>(page, "lab"))?.origin?.lessonId).toBe("day-one");

    // "Learn" goes back to the lesson.
    await openSidebar(page);
    await page.locator('.nav__item[data-nav="Learn"]:visible').first().click();
    await expect(page).toHaveURL(/#\/day-one\/2$/);
    await expect(page.locator("#tl-count")).toHaveText("Step 2 of 5");

    // Tinkering again with the same step doesn't ask to replace it.
    await page.locator("#open-lab").click();
    await expect(page).toHaveURL(/#\/lab$/);
    await expect(page.locator("#lab-origin")).toBeVisible();

    await page.locator("#lab-origin").getByRole("button", { name: "Dismiss lesson note" }).click();
    await expect(page.locator("#lab-origin")).toBeHidden();
  });
});
