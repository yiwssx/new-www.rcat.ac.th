import { expect, test, type Locator, type Page } from "@playwright/test";
import { installPublicHomeFixture, type PublicHomeFixtureOptions } from "./fixtures/publicHomeCarouselFixture";

async function openCarousel(page: Page, options: PublicHomeFixtureOptions = {}) {
  await installPublicHomeFixture(page, options);

  await page.goto("/", {
    waitUntil: "domcontentloaded"
  });

  const carousel = page.locator('[data-public-home-carousel="true"]');

  await expect(carousel).toBeVisible();

  return carousel;
}

async function expectInside(inner: Locator, outer: Locator, tolerance = 1) {
  const innerBox = await inner.boundingBox();
  const outerBox = await outer.boundingBox();

  if (!innerBox || !outerBox) {
    throw new Error("Expected both visual contract elements to have bounding boxes.");
  }

  expect(innerBox.x).toBeGreaterThanOrEqual(outerBox.x - tolerance);
  expect(innerBox.y).toBeGreaterThanOrEqual(outerBox.y - tolerance);
  expect(innerBox.x + innerBox.width).toBeLessThanOrEqual(outerBox.x + outerBox.width + tolerance);
  expect(innerBox.y + innerBox.height).toBeLessThanOrEqual(outerBox.y + outerBox.height + tolerance);
}

async function expectCarouselWithinViewport(carousel: Locator) {
  const metrics = await carousel.evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      viewportWidth: document.documentElement.clientWidth
    };
  });

  expect(metrics.left).toBeGreaterThanOrEqual(-1);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function currentImagePath(image: Locator) {
  return image.evaluate((element) => {
    const currentSrc = (element as HTMLImageElement).currentSrc;

    return currentSrc ? new URL(currentSrc).pathname : "";
  });
}

test.describe("public home carousel visual contract", () => {
  test("keeps desktop fade geometry, controls, and keyboard navigation stable", async ({ page }) => {
    await page.setViewportSize({
      width: 1440,
      height: 1000
    });

    const carousel = await openCarousel(page, {
      transition: "fade"
    });
    const viewport = carousel.locator('[data-carousel-viewport="true"]');
    const topControls = carousel.locator('[data-carousel-top-controls="true"]');
    const dots = carousel.locator('[data-carousel-dot-controls="true"]');

    await expect(carousel).toHaveAttribute("data-carousel-transition", "fade");
    await expect(topControls).toBeVisible();
    await expect(dots).toBeVisible();

    const viewportBox = await viewport.boundingBox();

    if (!viewportBox) {
      throw new Error("Carousel viewport has no desktop bounding box.");
    }

    expect(viewportBox.height).toBeGreaterThanOrEqual(430);
    expect(viewportBox.height).toBeLessThanOrEqual(441);

    await expectInside(topControls, carousel);
    await expectInside(dots, carousel);
    await expectInside(viewport, carousel);
    await expect(viewport).toHaveCSS("overflow-x", "hidden");
    await expectCarouselWithinViewport(carousel);

    await carousel.focus();
    await page.keyboard.press("End");

    const selectedSlide = carousel.locator('[data-carousel-slide-selected="true"]');

    await expect(selectedSlide).toHaveAttribute("data-carousel-slide-index", "2");
    await expect(carousel).toHaveAttribute("data-carousel-autoplay-state", "paused");
    await expect(carousel.locator('[aria-live="polite"]')).toContainText("สไลด์ 3 จาก 3: Fixture slide 3");

    await expect(selectedSlide.locator('[data-carousel-image-layer="main"]')).toHaveAttribute(
      "data-carousel-object-position",
      "30% 20%"
    );
    await expect(selectedSlide.locator('[data-carousel-image-layer="background"]')).toHaveCount(1);
  });

  test("uses the mobile source and keeps every control inside a 390px viewport", async ({ page }) => {
    await page.setViewportSize({
      width: 390,
      height: 844
    });
    await page.emulateMedia({
      reducedMotion: "reduce"
    });

    const carousel = await openCarousel(page, {
      transition: "fade"
    });
    const viewport = carousel.locator('[data-carousel-viewport="true"]');
    const topControls = carousel.locator('[data-carousel-top-controls="true"]');
    const dots = carousel.locator('[data-carousel-dot-controls="true"]');
    const firstSlide = carousel.locator('[data-carousel-slide-index="0"]');
    const mainImage = firstSlide.locator('[data-carousel-image-layer="main"]');

    const viewportBox = await viewport.boundingBox();

    if (!viewportBox) {
      throw new Error("Carousel viewport has no mobile bounding box.");
    }

    expect(viewportBox.height).toBeGreaterThanOrEqual(278);
    expect(viewportBox.height).toBeLessThanOrEqual(283);

    await expect.poll(() => currentImagePath(mainImage)).toBe("/__carousel_fixture__/mobile-1.svg");

    await expectInside(topControls, carousel);
    await expectInside(dots, carousel);
    await expectInside(viewport, carousel);
    await expect(viewport).toHaveCSS("overflow-x", "hidden");
    await expectCarouselWithinViewport(carousel);

    const dotButtons = dots.getByRole("button");

    await expect(dotButtons).toHaveCount(3);

    for (const button of await dotButtons.all()) {
      const box = await button.boundingBox();

      if (!box) {
        throw new Error("Carousel dot control has no bounding box.");
      }

      expect(box.width).toBeGreaterThanOrEqual(28);
      expect(box.height).toBeGreaterThanOrEqual(28);
    }

    await page
      .getByRole("button", {
        name: "ไปยังสไลด์ 3"
      })
      .click();

    const thirdSlide = carousel.locator('[data-carousel-slide-index="2"]');

    await expect(thirdSlide).toHaveAttribute("data-carousel-slide-selected", "true");

    const thirdMainImage = thirdSlide.locator('[data-carousel-image-layer="main"]');

    await expect.poll(() => currentImagePath(thirdMainImage)).toBe("/__carousel_fixture__/mobile-3.svg");
  });

  test("disables motion and autoplay when reduced motion is requested", async ({ page }) => {
    await page.setViewportSize({
      width: 1024,
      height: 768
    });
    await page.emulateMedia({
      reducedMotion: "reduce"
    });

    const carousel = await openCarousel(page, {
      transition: "fade",
      autoplayIntervalSeconds: 3
    });
    const control = page.getByRole("button", {
      name: "การเล่นสไลด์อัตโนมัติถูกปิดตามการตั้งค่าลดการเคลื่อนไหว"
    });
    const firstSlide = carousel.locator('[data-carousel-slide-index="0"]');

    await expect(carousel).toHaveAttribute("data-carousel-autoplay-state", "reduced-motion");
    await expect(control).toBeDisabled();
    await expect(control).toHaveAttribute("aria-pressed", "true");
    await expect(firstSlide).toHaveAttribute("data-carousel-slide-selected", "true");

    const transitionDuration = await firstSlide.evaluate((element) => getComputedStyle(element).transitionDuration);

    expect(transitionDuration).toBe("0s");

    await page.waitForTimeout(3_200);

    await expect(firstSlide).toHaveAttribute("data-carousel-slide-selected", "true");
  });
});
