import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  installAuthenticatedDesignSystemCmsFixture,
  installUnauthenticatedCmsFixture
} from "./fixtures/designSystemCmsFixture";
import { installPublicShellClsFixture, PUBLIC_SHELL_CLS_CONTENT_SLUG } from "./fixtures/publicShellClsFixture";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 720 },
  { name: "wide", width: 1440, height: 900 }
] as const;
const baselineMode = process.env.RCAT_DESIGN_BASELINE === "1";

interface UiMeasurement {
  path: string;
  horizontalOverflow: number;
  clippedHeadingCount: number;
  controlsBelowCompactPolicy: number;
  overlappingControlCount: number;
  cardContentEscapeCount: number;
  formViewportEscapeCount: number;
  h1Count: number;
}

async function waitForStableRoute(page: Page, path: string) {
  if (path.startsWith("/admin")) {
    await page.locator("h1").first().waitFor();
    return;
  }

  if (["/login", "/activate-account", "/reset-password"].includes(path)) {
    await page.locator("input, textarea").first().waitFor();
    return;
  }

  await page.locator('[data-footer-directory-state="ready"]').waitFor();
}

async function measureUi(page: Page, path: string): Promise<UiMeasurement> {
  await page.goto(path);
  await waitForStableRoute(page, path);
  await page.evaluate(() => document.fonts.ready);

  return page.evaluate((currentPath) => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };

    const clippedHeadingCount = [...document.querySelectorAll("h1, h2, h3")].filter((heading) => {
      if (!visible(heading)) {
        return false;
      }
      const style = window.getComputedStyle(heading);
      const clipsInline = ["hidden", "clip"].includes(style.overflowX);
      const clipsBlock = ["hidden", "clip"].includes(style.overflowY);
      return (
        (clipsInline && heading.scrollWidth - heading.clientWidth > 1) ||
        (clipsBlock && heading.scrollHeight - heading.clientHeight > 1)
      );
    }).length;

    const rawControls = [
      ...document.querySelectorAll<HTMLElement>(
        'button, [role="button"], input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select, textarea, .MuiSelect-select'
      )
    ];
    const policyControls = [
      ...new Set(
        rawControls.map((control) => {
          if (control.matches("input, select, textarea, .MuiSelect-select")) {
            return (control.closest(".MuiInputBase-root") as HTMLElement | null) ?? control;
          }
          return control;
        })
      )
    ].filter(visible);

    const controlsBelowCompactPolicy = policyControls.filter((control) => {
      if (!visible(control)) {
        return false;
      }

      const rect = control.getBoundingClientRect();
      return rect.width < 40 || rect.height < 40;
    }).length;
    let overlappingControlCount = 0;
    for (let leftIndex = 0; leftIndex < policyControls.length; leftIndex += 1) {
      const left = policyControls[leftIndex];
      if (!left) {
        continue;
      }
      const leftRect = left.getBoundingClientRect();
      for (let rightIndex = leftIndex + 1; rightIndex < policyControls.length; rightIndex += 1) {
        const right = policyControls[rightIndex];
        if (!right || left.contains(right) || right.contains(left)) {
          continue;
        }
        const rightRect = right.getBoundingClientRect();
        const overlaps =
          Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left) > 1 &&
          Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top) > 1;
        if (overlaps) {
          overlappingControlCount += 1;
        }
      }
    }

    const cardContentEscapeCount = [...document.querySelectorAll<HTMLElement>(".MuiCard-root")].filter((card) => {
      if (!visible(card)) {
        return false;
      }
      const style = window.getComputedStyle(card);
      return card.scrollWidth - card.clientWidth > 1 && !["auto", "scroll"].includes(style.overflowX);
    }).length;
    const formViewportEscapeCount = [...document.querySelectorAll<HTMLElement>("form")].filter((form) => {
      if (!visible(form)) {
        return false;
      }
      const rect = form.getBoundingClientRect();
      return rect.left < -1 || rect.right > window.innerWidth + 1;
    }).length;

    return {
      path: currentPath,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      clippedHeadingCount,
      controlsBelowCompactPolicy,
      overlappingControlCount,
      cardContentEscapeCount,
      formViewportEscapeCount,
      h1Count: [...document.querySelectorAll("h1")].filter(visible).length
    };
  }, path);
}

async function readVisibleKeyboardFocus(page: Page, scope?: Locator) {
  const focusTarget = (scope ?? page)
    .locator('a[href], button, input:not([type="hidden"]), textarea, select')
    .filter({ visible: true })
    .first();
  await focusTarget.focus();

  const focusStyle = await focusTarget.evaluate((element) => {
    const visibleFocusOwner = element.matches("input, textarea, select")
      ? (element.closest(".MuiInputBase-root") ?? element)
      : element;
    const style = window.getComputedStyle(visibleFocusOwner);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth || "0"),
      boxShadow: style.boxShadow
    };
  });

  return (
    focusStyle.outlineWidth >= 2 ||
    (focusStyle.boxShadow !== "none" && focusStyle.boxShadow !== "") ||
    focusStyle.outlineStyle === "auto"
  );
}

for (const viewport of viewports) {
  test(`${viewport.name} representative Public routes remain responsive and keyboard-usable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installPublicShellClsFixture(page, { delayed: false });
    const measurements: UiMeasurement[] = [];

    for (const path of [
      "/",
      "/news",
      "/search?q=fixture",
      "/departments",
      `/content/${PUBLIC_SHELL_CLS_CONTENT_SLUG}`,
      "/contact"
    ]) {
      const measurement = await measureUi(page, path);
      measurements.push(measurement);
      expect(measurement.horizontalOverflow, `${path} overflow`).toBeLessThanOrEqual(1);
      expect(measurement.clippedHeadingCount, `${path} clipped headings`).toBe(0);
      expect(measurement.overlappingControlCount, `${path} overlapping controls`).toBe(0);
      expect(measurement.cardContentEscapeCount, `${path} card content escape`).toBe(0);
      expect(measurement.formViewportEscapeCount, `${path} form viewport escape`).toBe(0);
      if (!baselineMode) {
        expect(measurement.h1Count, `${path} H1 count`).toBe(1);
      }
      if (!baselineMode) {
        expect(measurement.controlsBelowCompactPolicy, `${path} controls below policy`).toBe(0);
      }
    }

    const keyboardFocusVisible = await readVisibleKeyboardFocus(page);
    if (!baselineMode) {
      expect(keyboardFocusVisible).toBe(true);
    }
    await expect(page.locator('[data-cls-region="footer-directory"]')).toHaveAttribute(
      "data-footer-directory-state",
      "ready"
    );
    console.log(
      `DESIGN_SYSTEM_PUBLIC_${viewport.name.toUpperCase()} ${JSON.stringify({ measurements, keyboardFocusVisible })}`
    );
  });
}

test("Auth routes retain isolated, labeled, responsive forms with stable controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await installUnauthenticatedCmsFixture(page);
  const measurements: UiMeasurement[] = [];

  for (const path of ["/login", "/activate-account", "/reset-password"]) {
    const measurement = await measureUi(page, path);
    measurements.push(measurement);
    expect(measurement.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(measurement.clippedHeadingCount).toBe(0);
    expect(measurement.overlappingControlCount).toBe(0);
    expect(measurement.cardContentEscapeCount).toBe(0);
    expect(measurement.formViewportEscapeCount).toBe(0);
    if (!baselineMode) {
      expect(measurement.h1Count).toBe(1);
    }
    if (!baselineMode) {
      expect(measurement.controlsBelowCompactPolicy).toBe(0);
    }
    await expect(page.locator('[data-cls-region="public-shell"]')).toHaveCount(0);
    await expect(page.locator('[data-cls-region="footer-directory"]')).toHaveCount(0);
    await expect(page.locator("input, textarea").first()).toHaveAccessibleName(/.+/);
    const keyboardFocusVisible = await readVisibleKeyboardFocus(page);
    if (!baselineMode) {
      expect(keyboardFocusVisible).toBe(true);
    }
  }

  expect(fixture.publicRequests).toEqual([]);
  console.log(`DESIGN_SYSTEM_AUTH_MOBILE ${JSON.stringify(measurements)}`);
});

for (const viewport of viewports) {
  test(`${viewport.name} representative Admin routes contain overflow and preserve hierarchy`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthenticatedDesignSystemCmsFixture(page);
    const measurements: UiMeasurement[] = [];

    for (const path of ["/admin", "/admin/content", "/admin/media", "/admin/users"]) {
      const measurement = await measureUi(page, path);
      measurements.push(measurement);
      expect(measurement.horizontalOverflow, `${path} overflow`).toBeLessThanOrEqual(1);
      expect(measurement.clippedHeadingCount, `${path} clipped headings`).toBe(0);
      expect(measurement.overlappingControlCount, `${path} overlapping controls`).toBe(0);
      expect(measurement.cardContentEscapeCount, `${path} card content escape`).toBe(0);
      expect(measurement.formViewportEscapeCount, `${path} form viewport escape`).toBe(0);
      if (!baselineMode) {
        expect(measurement.h1Count, `${path} H1 count`).toBe(1);
      }
      if (!baselineMode) {
        expect(measurement.controlsBelowCompactPolicy, `${path} controls below policy`).toBe(0);
      }
    }

    const keyboardFocusVisible = await readVisibleKeyboardFocus(page);
    if (!baselineMode) {
      expect(keyboardFocusVisible).toBe(true);
    }
    console.log(`DESIGN_SYSTEM_ADMIN_${viewport.name.toUpperCase()} ${JSON.stringify(measurements)}`);
  });
}

test("Admin content dialog retains an accessible title, actions, and destructive distinction", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installAuthenticatedDesignSystemCmsFixture(page);
  await page.goto("/admin/content");
  await page.getByRole("heading", { name: "เนื้อหา" }).waitFor();
  await page.getByRole("button", { name: "เพิ่มเนื้อหา" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName(/เพิ่ม|เนื้อหา/);
  await expect(dialog.getByRole("button", { name: /ยกเลิก|ปิด/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /ดำเนินการต่อ/ })).toBeVisible();
  const visibleDestructiveControls = dialog.getByRole("button", { name: /ลบ/ }).filter({ visible: true });
  const destructiveControlCount = await visibleDestructiveControls.count();
  for (let index = 0; index < destructiveControlCount; index += 1) {
    const className = await visibleDestructiveControls.nth(index).getAttribute("class");
    if (!baselineMode) {
      expect(className).toMatch(/colorError/);
    }
  }
  const keyboardFocusVisible = await readVisibleKeyboardFocus(page, dialog);
  if (!baselineMode) {
    expect(keyboardFocusVisible).toBe(true);
  }
});
