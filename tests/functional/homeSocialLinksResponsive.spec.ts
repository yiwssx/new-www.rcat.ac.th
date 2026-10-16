import { expect, test } from "@playwright/test";
import { createPublicHomeSnapshot, installPublicHomeFixture } from "./fixtures/publicHomeCarouselFixture";

const socialSettings = {
  enabled: true,
  pageEmbedEnabled: true,
  pageEmbedHeight: 520,
  links: [
    {
      id: "social-dept",
      category: "department",
      label: "แผนกวิชาตัวอย่าง",
      href: "https://www.facebook.com/example-department",
      iconKey: "computer",
      iconUrl: "",
      enabled: true
    },
    {
      id: "social-unit",
      category: "unit",
      label: "งานประชาสัมพันธ์ตัวอย่าง",
      href: "https://www.facebook.com/example-unit",
      iconKey: "custom",
      iconUrl: "https://drive.google.com/thumbnail?id=abcdef123&sz=w256",
      enabled: true
    }
  ]
};

for (const width of [390, 1280]) {
  test(`homepage social links render below visitors and before footer at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await installPublicHomeFixture(page);

    const snapshot = createPublicHomeSnapshot();
    const configuredSite = {
      ...snapshot.siteSettings,
      facebookUrl: "https://www.facebook.com/rcat",
      homepageSocial: socialSettings
    };
    const configuredHome = {
      ...snapshot,
      siteSettings: configuredSite,
      visitorStats: { ...snapshot.visitorStats, enabled: true }
    };

    // Override only the deterministic public snapshots. No production service is contacted.
    await page.route("**/api/public/shell", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteSettings: configuredSite,
          homepageSettings: snapshot.homepageSettings,
          displaySettings: snapshot.displaySettings,
          menu: snapshot.menu,
          generatedAt: snapshot.generatedAt
        })
      });
    });
    await page.route("**/api/public/home", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(configuredHome) });
    });
    await page.route("**/api/public/visitor-stats", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(configuredHome.visitorStats)
      });
    });
    await page.route("https://www.facebook.com/plugins/page.php**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Facebook fixture</body></html>" });
    });

    await page.goto("/");

    const visitors = page.getByRole("region", { name: "Website Visitors" });
    const widget = page.locator('[data-home-social-widget="true"]');
    const footer = page.locator('[data-cls-region="dark-footer"]');

    await expect(visitors).toBeVisible();
    await expect(widget).toHaveCount(1);
    await expect(widget).toBeVisible();
    await expect(widget.getByText("แผนกวิชาตัวอย่าง")).toBeVisible();
    await expect(widget.getByText("งานประชาสัมพันธ์ตัวอย่าง")).toBeVisible();
    await expect(widget.locator('[data-public-deferred-embed="true"]')).toHaveCount(1);

    const visitorBox = await visitors.boundingBox();
    const widgetBox = await widget.boundingBox();
    const footerBox = await footer.boundingBox();
    expect(visitorBox).not.toBeNull();
    expect(widgetBox).not.toBeNull();
    expect(footerBox).not.toBeNull();
    expect(widgetBox!.y).toBeGreaterThan(visitorBox!.y + visitorBox!.height - 3);
    expect(footerBox!.y).toBeGreaterThan(widgetBox!.y + widgetBox!.height - 3);

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
    if (width === 390) {
      expect(widgetBox!.width).toBeGreaterThan(280);
      expect(widgetBox!.width).toBeLessThanOrEqual(390);
    }
  });
}
