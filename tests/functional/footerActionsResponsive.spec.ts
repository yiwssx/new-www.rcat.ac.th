import { expect, test } from "@playwright/test";
import { createPublicHomeSnapshot, installPublicHomeFixture } from "./fixtures/publicHomeCarouselFixture";

for (const width of [320, 360, 390, 430, 768, 1280]) {
  test(`footer actions remain usable and clear of Messenger at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await installPublicHomeFixture(page);

    const snapshot = createPublicHomeSnapshot();
    const siteSettings = {
      ...snapshot.siteSettings,
      footerTitle: "วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด",
      footerDescription: "© 2026 งานศูนย์ดิจิทัลและสื่อสารองค์กร",
      messengerEnabled: true,
      messengerUrl: "https://m.me/rcat",
      messengerLabel: "แชทกับเจ้าหน้าที่"
    };

    await page.route("**/api/public/shell", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          siteSettings,
          homepageSettings: snapshot.homepageSettings,
          displaySettings: snapshot.displaySettings,
          menu: snapshot.menu,
          generatedAt: snapshot.generatedAt
        })
      });
    });
    await page.route("**/api/public/home", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...snapshot, siteSettings })
      });
    });

    await page.goto("/");

    const footer = page.locator('[data-cls-region="dark-footer"]');
    const staff = footer.getByRole("link", { name: "สำหรับเจ้าหน้าที่" });
    const backToTop = footer.getByRole("button", { name: "กลับขึ้นด้านบน" });

    await expect(staff).toHaveAttribute("href", "/login");
    await expect(backToTop).toBeVisible();
    await expect(footer.getByRole("link", { name: "นโยบายความเป็นส่วนตัว" })).toHaveAttribute(
      "href",
      "/privacy-policy"
    );
    await expect(footer.getByRole("link", { name: "นโยบายการใช้คุกกี้" })).toHaveAttribute("href", "/cookie-policy");
    await expect(footer.getByRole("button", { name: "ตั้งค่าคุกกี้" })).toBeVisible();
    await expect(page.locator('[data-public-floating-messenger="true"]')).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(footer).toBeInViewport();

    const layout = await page.evaluate(() => {
      const footer = document.querySelector('[data-cls-region="dark-footer"]');
      const branding = footer?.querySelector('[data-footer-branding="true"]');
      const actions = footer?.querySelector('[data-footer-actions="true"]');
      const staff = actions?.querySelector('a[href="/login"]');
      const backToTop = actions?.querySelector("button");
      const messenger = document.querySelector('[data-public-floating-messenger="true"]');
      if (!branding || !actions || !staff || !backToTop || !messenger) return null;
      const rect = (element: Element) => element.getBoundingClientRect();
      const brandingBox = rect(branding);
      const actionsBox = rect(actions);
      const staffBox = rect(staff);
      const topBox = rect(backToTop);
      const messengerBox = rect(messenger);
      const overlapping = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        brandingTop: brandingBox.top,
        brandingLeft: brandingBox.left,
        actionsTop: actionsBox.top,
        actionsLeft: actionsBox.left,
        staffTop: staffBox.top,
        staffRight: staffBox.right,
        staffHeight: staffBox.height,
        topTop: topBox.top,
        topLeft: topBox.left,
        topHeight: topBox.height,
        viewportWidth: document.documentElement.clientWidth,
        actionOverlapsMessenger: overlapping(actionsBox, messengerBox),
        staffOverlapsMessenger: overlapping(staffBox, messengerBox),
        backOverlapsMessenger: overlapping(topBox, messengerBox)
      };
    });

    expect(layout).not.toBeNull();
    expect(layout!.actionOverlapsMessenger).toBe(false);
    expect(layout!.staffOverlapsMessenger).toBe(false);
    expect(layout!.backOverlapsMessenger).toBe(false);
    expect(layout!.staffHeight).toBeGreaterThanOrEqual(44);
    expect(layout!.topHeight).toBeGreaterThanOrEqual(44);

    if (width < 900) {
      expect(layout!.actionsTop).toBeLessThan(layout!.brandingTop);
      expect(Math.abs(layout!.staffTop - layout!.topTop)).toBeLessThanOrEqual(1);
      expect(layout!.staffRight).toBeLessThanOrEqual(layout!.topLeft + 1);
      expect(layout!.topLeft).toBeGreaterThanOrEqual(0);
      expect(layout!.staffRight).toBeLessThanOrEqual(layout!.viewportWidth);
    } else {
      expect(layout!.actionsLeft).toBeGreaterThan(layout!.brandingLeft);
    }

    await backToTop.click();
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(2);
  });
}
