import { expect, test } from "@playwright/test";
import { installPublicAuthIsolationFixture } from "./fixtures/publicAuthIsolationFixture";
import { createPublicHomeSnapshot } from "./fixtures/publicHomeCarouselFixture";

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
        expect(identityRect!.y).toBeGreaterThanOrEqual(ribbonRect!.y + ribbonRect!.height - 1);
      }
    }
  });

  test("keeps the mourning ribbon fixed during mobile and desktop scrolling", async ({ page }) => {
    const snapshot = createPublicHomeSnapshot();
    await installPublicAuthIsolationFixture(page, {
      consent: "rejected",
      siteSettings: { ...snapshot.siteSettings, mourningRibbonEnabled: true }
    });
    await page.goto("/news");

    const ribbon = page.locator('[data-mourning-ribbon="true"]');
    await expect(ribbon).toBeVisible();

    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 700 });
      await page.evaluate(() => {
        document.body.style.minHeight = "260vh";
        window.scrollTo(0, 450);
      });

      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      expect(await ribbon.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");

      const ribbonRect = await ribbon.boundingBox();
      expect(ribbonRect).not.toBeNull();
      expect(Math.abs(ribbonRect!.y)).toBeLessThanOrEqual(1);

      await page.evaluate(() => window.scrollTo(0, 0));
    }
  });

  test("preserves mobile contact parity and ribbon clearance", async ({ page }) => {
    const snapshot = createPublicHomeSnapshot();
    const siteSettings = {
      ...snapshot.siteSettings,
      siteName: "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
      campus: "ธวัชบุรี จังหวัดร้อยเอ็ด",
      phone: "0 4356 9117",
      email: "contact@rcat.example",
      facebookUrl: "https://facebook.com/rcat-fixture",
      youtubeUrl: "https://youtube.com/@rcat-fixture",
      tiktokUrl: "https://tiktok.com/@rcat-fixture",
      mourningRibbonEnabled: true
    };

    await installPublicAuthIsolationFixture(page, {
      consent: "rejected",
      siteSettings
    });

    await page.goto("/news");

    const primary = page.getByTestId("public-mobile-topbar-primary");
    const contact = page.getByTestId("public-mobile-topbar-contact");
    const social = page.getByTestId("public-mobile-topbar-social");
    const ribbon = page.locator('[data-mourning-ribbon="true"]');

    for (const width of [320, 360, 390, 412, 430]) {
      await page.setViewportSize({ width, height: 820 });
      await expect(primary).toBeVisible();
      await expect(primary.getByText(siteSettings.siteName, { exact: true })).toBeVisible();
      await expect(primary.getByText(siteSettings.campus, { exact: true })).toBeVisible();
      await expect(primary.getByRole("link", { name: siteSettings.phone })).toBeVisible();
      await expect(primary.getByRole("link", { name: siteSettings.email })).toBeVisible();
      await expect(social.getByText("ช่องทางติดตาม")).toBeVisible();

      for (const platform of ["facebook", "youtube", "tiktok"]) {
        await expect(social.locator(`[data-social-icon-link="${platform}"]`)).toBeVisible();
      }

      const ribbonRect = await ribbon.boundingBox();
      const contactRect = await contact.boundingBox();
      const primaryRect = await primary.boundingBox();
      expect(ribbonRect).not.toBeNull();
      expect(contactRect).not.toBeNull();
      expect(primaryRect).not.toBeNull();
      expect(contactRect!.x).toBeGreaterThanOrEqual(ribbonRect!.x + ribbonRect!.width - 1);
      expect(primaryRect!.height).toBeGreaterThanOrEqual(ribbonRect!.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    }

    await page.setViewportSize({ width: 1280, height: 820 });
    await expect(primary).toBeHidden();
    const desktopTopBar = page.getByTestId("public-desktop-topbar");
    await expect(desktopTopBar).toBeVisible();
    await expect(desktopTopBar.getByText(siteSettings.campus, { exact: true })).toBeVisible();
    await expect(desktopTopBar.getByText(siteSettings.email, { exact: true })).toBeVisible();
  });
});
