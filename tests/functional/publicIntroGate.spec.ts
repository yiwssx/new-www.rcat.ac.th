import { expect, test, type Page } from "@playwright/test";
import { createPublicHomeSnapshot } from "./fixtures/publicHomeCarouselFixture";

const introImageBody =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1250" height="1000" viewBox="0 0 1250 1000"><rect width="1250" height="1000" fill="#1f5a2c"/><rect x="25" y="25" width="1200" height="950" fill="none" stroke="#ffffff" stroke-width="20"/></svg>';
const messengerLabel = "Messenger fixture";
const storageKey = "functional-intro-layout";

const viewports = [
  { width: 390, height: 844 },
  { width: 503, height: 733 },
  { width: 768, height: 720 },
  { width: 827, height: 733 },
  { width: 916, height: 731 },
  { width: 1280, height: 720 },
  { width: 844, height: 390 }
] as const;

function createIntroSnapshot() {
  const base = createPublicHomeSnapshot();

  return {
    ...base,
    siteSettings: {
      ...base.siteSettings,
      messengerEnabled: true,
      messengerUrl: "https://m.me/rcat",
      messengerLabel
    },
    homepageSettings: {
      ...base.homepageSettings,
      introGate: {
        enabled: true,
        imageUrl: "/__intro_gate_fixture__/landscape.svg",
        imageAlt: "Intro gate landscape fixture",
        primaryButtonLabel: "เข้าสู่เว็บไซต์",
        secondaryButtonLabel: "อ่านรายละเอียด",
        secondaryButtonUrl: "https://example.edu/intro-details",
        storageKey
      }
    },
    carouselSlides: []
  };
}

async function installIntroFixture(page: Page) {
  await page.addInitScript(() => {
    const initializationKey = "__intro_gate_fixture_initialized__";

    if (window.sessionStorage.getItem(initializationKey) !== "true") {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.sessionStorage.setItem(initializationKey, "true");
    }
  });

  await page.route("**/__intro_gate_fixture__/landscape.svg", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: introImageBody
    });
  });

  await page.route("**/api/public/home", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createIntroSnapshot())
    });
  });

  await page.route("**/api/public/shell", async (route) => {
    const snapshot = createIntroSnapshot();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        siteSettings: snapshot.siteSettings,
        homepageSettings: snapshot.homepageSettings,
        displaySettings: snapshot.displaySettings,
        menu: snapshot.menu,
        generatedAt: snapshot.generatedAt
      })
    });
  });

  await page.route("**/api/public/visitor-stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createIntroSnapshot().visitorStats)
    });
  });

  for (const path of ["**/api/public/site-view", "**/api/public/presence"]) {
    await page.route(path, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accepted: true })
      });
    });
  }
}

function rectanglesOverlap(
  first: { left: number; right: number; top: number; bottom: number },
  second: { left: number; right: number; top: number; bottom: number }
) {
  return (
    Math.min(first.right, second.right) > Math.max(first.left, second.left) &&
    Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top)
  );
}

for (const viewport of viewports) {
  test(`Intro Gate keeps intrinsic geometry at ${viewport.width} x ${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installIntroFixture(page);
    await page.goto("/");

    const dialog = page.getByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" });
    const image = page.getByRole("img", { name: "Intro gate landscape fixture" });
    const messenger = page.getByRole("link", { name: `${messengerLabel}ผ่าน Messenger` });

    await expect(dialog).toBeVisible();
    await expect(image).toBeVisible();
    await expect(messenger).toHaveCount(0);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await expect
      .poll(() =>
        image.evaluate((element) => {
          const imageElement = element as HTMLImageElement;

          return imageElement.complete && imageElement.naturalWidth > 0;
        })
      )
      .toBe(true);

    const layout = await page.evaluate(() => {
      const dialogElement = document.querySelector('[role="dialog"]') as HTMLElement;
      const imageElement = document.querySelector('[data-public-image-intent="intro-gate"] img') as HTMLImageElement;
      const responsiveWrapper = imageElement.closest('[data-public-responsive-image="true"]') as HTMLElement;
      const imageRegion = document.querySelector('[data-intro-gate-image-region="true"]') as HTMLElement;
      const actions = document.querySelector('[data-intro-gate-actions="true"]') as HTMLElement;
      const controls = [...actions.querySelectorAll<HTMLElement>("a, button")];
      const toRect = (element: Element) => {
        const rect = element.getBoundingClientRect();

        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      };

      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        dialog: toRect(dialogElement),
        image: toRect(imageElement),
        responsiveWrapper: toRect(responsiveWrapper),
        imageRegion: toRect(imageRegion),
        actions: toRect(actions),
        controls: controls.map(toRect),
        imageStyle: {
          objectFit: window.getComputedStyle(imageElement).objectFit,
          position: window.getComputedStyle(imageElement).position
        },
        imageLayout: responsiveWrapper.dataset.publicImageLayout,
        naturalRatio: imageElement.naturalWidth / imageElement.naturalHeight,
        documentHorizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        dialogVerticalOverflow: dialogElement.scrollHeight - dialogElement.clientHeight,
        bodyStyles: {
          overflow: document.body.style.overflow,
          position: document.body.style.position
        }
      };
    });

    expect(layout.dialog.left).toBeCloseTo(0, 0);
    expect(layout.dialog.top).toBeCloseTo(0, 0);
    expect(layout.dialog.width).toBeCloseTo(layout.viewport.width, 0);
    expect(layout.dialog.height).toBeCloseTo(layout.viewport.height, 0);
    expect(layout.imageLayout).toBe("intrinsic");
    expect(layout.imageStyle.objectFit).toBe("contain");
    expect(layout.imageStyle.position).not.toBe("absolute");
    expect(layout.naturalRatio).toBeCloseTo(1.25, 5);
    expect(layout.image.width / layout.image.height).toBeCloseTo(layout.naturalRatio, 2);
    expect(layout.image.left).toBeGreaterThanOrEqual(-0.5);
    expect(layout.image.top).toBeGreaterThanOrEqual(-0.5);
    expect(layout.image.right).toBeLessThanOrEqual(layout.viewport.width + 0.5);
    expect(layout.image.bottom).toBeLessThanOrEqual(layout.viewport.height + 0.5);
    expect(Math.abs(layout.imageRegion.width - layout.image.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.imageRegion.height - layout.image.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.responsiveWrapper.width - layout.image.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.responsiveWrapper.height - layout.image.height)).toBeLessThanOrEqual(1);
    expect(layout.actions.top - layout.image.bottom).toBeGreaterThanOrEqual(5.5);
    expect(layout.actions.top - layout.image.bottom).toBeLessThanOrEqual(10.5);
    expect(rectanglesOverlap(layout.image, layout.actions)).toBe(false);
    expect(layout.controls).toHaveLength(2);
    expect(rectanglesOverlap(layout.controls[0], layout.controls[1])).toBe(false);

    for (const control of layout.controls) {
      expect(control.left).toBeGreaterThanOrEqual(-0.5);
      expect(control.top).toBeGreaterThanOrEqual(-0.5);
      expect(control.right).toBeLessThanOrEqual(layout.viewport.width + 0.5);
      expect(control.bottom).toBeLessThanOrEqual(layout.viewport.height + 0.5);
      expect(control.height).toBeGreaterThanOrEqual(46);
    }

    expect(layout.documentHorizontalOverflow).toBeLessThanOrEqual(0);
    expect(layout.dialogVerticalOverflow).toBeLessThanOrEqual(1);
    expect(layout.bodyStyles).toEqual({
      overflow: "hidden",
      position: "fixed"
    });

    await page.getByRole("button", { name: "เข้าสู่เว็บไซต์" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(messenger).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => window.sessionStorage.getItem("functional-intro-layout")))
      .toBe("dismissed");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          overflow: document.body.style.overflow,
          position: document.body.style.position
        }))
      )
      .toEqual({ overflow: "", position: "" });

    await page.reload();

    await expect(dialog).toHaveCount(0);
    await expect(messenger).toBeVisible();
  });
}
