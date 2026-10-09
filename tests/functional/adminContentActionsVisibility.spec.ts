import { expect, test, type Locator, type Page } from "@playwright/test";
import { installAuthenticatedDesignSystemCmsFixture } from "./fixtures/designSystemCmsFixture";

async function openContentAdmin(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await installAuthenticatedDesignSystemCmsFixture(page);
  await page.goto("/admin/content");
  await page.getByRole("heading", { name: "เนื้อหา" }).waitFor();
  await expect(page.getByRole("table", { name: "ตารางเนื้อหา" })).toBeVisible({ timeout: 10_000 });
}

async function getBounds(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

for (const viewport of [
  { name: "desktop", width: 1280, height: 720 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "wide", width: 1440, height: 900 }
] as const) {
  test(`${viewport.name} Admin content row actions stay visible at default zoom`, async ({ page }) => {
    await openContentAdmin(page, viewport);

    const tableScroll = page.locator(".table-scroll");
    const actionsCell = page.locator('tbody [data-column-id="actions"]').first();
    const actionButtons = actionsCell.locator(".MuiIconButton-root");

    await expect(actionsCell).toBeVisible();
    await expect(actionsCell).toHaveCSS("position", "sticky");
    expect(await actionButtons.count()).toBeGreaterThanOrEqual(3);
    expect(await tableScroll.evaluate((element) => element.scrollLeft)).toBe(0);

    const scrollBounds = await getBounds(tableScroll);
    const initialActionsBounds = await getBounds(actionsCell);
    expect(initialActionsBounds.x).toBeGreaterThanOrEqual(scrollBounds.x - 1);
    expect(initialActionsBounds.x + initialActionsBounds.width).toBeLessThanOrEqual(
      scrollBounds.x + scrollBounds.width + 1
    );

    const visibleButtonCount = await actionButtons.count();
    for (let index = 0; index < visibleButtonCount; index += 1) {
      const buttonBounds = await getBounds(actionButtons.nth(index));
      expect(buttonBounds.x).toBeGreaterThanOrEqual(scrollBounds.x - 1);
      expect(buttonBounds.x + buttonBounds.width).toBeLessThanOrEqual(scrollBounds.x + scrollBounds.width + 1);
    }

    const scrollMetrics = await tableScroll.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }));
    if (scrollMetrics.scrollWidth > scrollMetrics.clientWidth + 1) {
      await tableScroll.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      await expect
        .poll(async () => (await actionsCell.boundingBox())?.x ?? -1, {
          message: "sticky action column should remain pinned while table content scrolls"
        })
        .toBeGreaterThanOrEqual(initialActionsBounds.x - 1);
      const scrolledActionsBounds = await getBounds(actionsCell);
      expect(Math.abs(scrolledActionsBounds.x - initialActionsBounds.x)).toBeLessThanOrEqual(1);
    }

    const firstEnabledAction = actionsCell.locator(".MuiIconButton-root:not([disabled])").first();
    await firstEnabledAction.focus();
    const focusedBounds = await getBounds(firstEnabledAction);
    const focusRingExtent = await page.evaluate(
      () =>
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--rcat-focus-ring-extent")) || 0
    );
    expect(focusedBounds.x - focusRingExtent).toBeGreaterThanOrEqual(scrollBounds.x - 1);
    expect(focusedBounds.x + focusedBounds.width + focusRingExtent).toBeLessThanOrEqual(
      scrollBounds.x + scrollBounds.width + 1
    );

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ).toBeLessThanOrEqual(1);
  });
}

for (const viewport of [
  { name: "tablet", width: 768, height: 1024, minWidth: "984px", hideUpdatedAt: false },
  { name: "narrow-mobile", width: 320, height: 640, minWidth: "852px", hideUpdatedAt: true },
  { name: "mobile-375", width: 375, height: 812, minWidth: "852px", hideUpdatedAt: true },
  { name: "mobile", width: 390, height: 844, minWidth: "852px", hideUpdatedAt: true }
] as const) {
  test(`${viewport.name} Admin content prioritizes actions over secondary metadata`, async ({ page }) => {
    await openContentAdmin(page, viewport);

    const table = page.getByRole("table", { name: "ตารางเนื้อหา" });
    const ownerHeader = table.locator('thead [data-column-id="owner"]');
    const ownerCell = table.locator('tbody [data-column-id="owner"]').first();
    const updatedAtHeader = table.locator('thead [data-column-id="updatedAt"]');
    const updatedAtCell = table.locator('tbody [data-column-id="updatedAt"]').first();
    const actionsCell = table.locator('tbody [data-column-id="actions"]').first();

    await expect(table).toHaveCSS("min-width", viewport.minWidth);
    await expect(ownerHeader).toBeHidden();
    await expect(ownerCell).toBeHidden();
    if (viewport.hideUpdatedAt) {
      await expect(updatedAtHeader).toBeHidden();
      await expect(updatedAtCell).toBeHidden();
    } else {
      await expect(updatedAtHeader).toBeVisible();
      await expect(updatedAtCell).toBeVisible();
    }

    await expect(actionsCell).toBeVisible();
    await expect(actionsCell).toHaveCSS("position", "sticky");

    const tableScroll = page.locator(".table-scroll");
    const scrollBounds = await getBounds(tableScroll);
    const actionsBounds = await getBounds(actionsCell);
    expect(actionsBounds.x + actionsBounds.width).toBeLessThanOrEqual(scrollBounds.x + scrollBounds.width + 1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ).toBeLessThanOrEqual(1);
  });
}
