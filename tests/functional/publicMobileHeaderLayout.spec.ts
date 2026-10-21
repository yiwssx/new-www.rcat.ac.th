import { expect, test } from "@playwright/test";
import { installPublicAuthIsolationFixture } from "./fixtures/publicAuthIsolationFixture";

test.describe("Public mobile institutional header layout", () => {
  test("keeps the award, identity, actions and search aligned without horizontal overflow", async ({ page }) => {
    await installPublicAuthIsolationFixture(page, { consent: "rejected" });
    await page.goto("/news");

    const identity = page.getByTestId("public-college-identity");
    const actions = page.getByTestId("public-header-actions");
    const searchBox = page.getByRole("searchbox", { name: "ค้นหาในเว็บไซต์" });

    for (const width of [320, 360, 390, 412, 430]) {
      await page.setViewportSize({ width, height: 820 });
      await expect(identity).toBeVisible();
      await expect(actions).toBeVisible();
      await expect(searchBox).toBeVisible();

      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth).toBeLessThanOrEqual(width + 1);

      const identityRect = await identity.boundingBox();
      const searchRect = await searchBox.boundingBox();
      const announcements = await actions.getByRole("link", { name: "ประกาศ" }).boundingBox();

      expect(identityRect).not.toBeNull();
      expect(searchRect).not.toBeNull();
      expect(announcements).not.toBeNull();
      expect(announcements!.width).toBeLessThan(width * 0.53);
      expect(searchRect!.width).toBeLessThanOrEqual(Math.min(340, width - 16) + 1);
      expect(searchRect!.y).toBeGreaterThanOrEqual(announcements!.y + announcements!.height);

      const award = page.getByTestId("public-mobile-award");
      const ribbon = page.locator('[data-mourning-ribbon="true"]');

      if (await award.isVisible()) {
        const awardRect = await award.boundingBox();
        expect(awardRect).not.toBeNull();
        expect(awardRect!.y + awardRect!.height).toBeLessThanOrEqual(identityRect!.y + 1);
      }

      if (await ribbon.isVisible()) {
        const ribbonRect = await ribbon.boundingBox();
        expect(ribbonRect).not.toBeNull();
        expect(identityRect!.y).toBeGreaterThanOrEqual(ribbonRect!.bottom - 1);
      }
    }
  });
});
