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

interface FocusEffectMeasurement {
  boxShadow: string;
  outlineWidth: number;
  ringExtent: number;
  canonicalLayerCount: number;
  clippedBy: string[];
  viewportClipped: boolean;
  widthDelta: number;
  heightDelta: number;
  focusBoundaryRatio: number;
  bounds: { left: number; top: number; right: number; bottom: number; viewportWidth: number; viewportHeight: number };
}

interface ControlContrastMeasurement {
  foreground: string;
  background: string;
  borderColor: string;
  textRatio: number;
  borderRatio: number;
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

async function inspectFocusEffect(target: Locator): Promise<FocusEffectMeasurement> {
  await target.evaluate(async () => {
    await document.fonts.ready;
  });
  const before = await target.boundingBox();
  expect(before).not.toBeNull();
  await target.focus();
  await expect
    .poll(
      () =>
        target.evaluate((element) => {
          const focusOwner = element.matches("input, textarea, select")
            ? (element.closest(".MuiInputBase-root") ?? element)
            : element;
          const style = window.getComputedStyle(focusOwner);
          return style.boxShadow.includes(" 0px 0px 0px 2px") && style.boxShadow.includes(" 0px 0px 0px 5px");
        }),
      { message: "canonical focus layers settle to their declared geometry" }
    )
    .toBe(true);

  return target.evaluate((element, beforeRect) => {
    const focusOwner = element.matches("input, textarea, select")
      ? ((element.closest(".MuiInputBase-root") as HTMLElement | null) ?? element)
      : element;
    const style = window.getComputedStyle(focusOwner);
    const rootStyle = window.getComputedStyle(document.documentElement);
    const ringExtent = Number.parseFloat(rootStyle.getPropertyValue("--rcat-focus-ring-extent")) || 0;
    const focusRing = rootStyle.getPropertyValue("--rcat-color-focus").trim();
    const focusSeparation = rootStyle.getPropertyValue("--rcat-color-focus-separation").trim();
    const rect = focusOwner.getBoundingClientRect();
    const clippedBy: string[] = [];
    const clipValues = new Set(["auto", "clip", "hidden", "scroll"]);

    const parseColor = (value: string) => {
      const normalized = value.trim();
      if (normalized.startsWith("#")) {
        const hex = normalized.slice(1);
        const expanded = hex.length === 3 ? [...hex].map((character) => character.repeat(2)).join("") : hex;
        return [
          Number.parseInt(expanded.slice(0, 2), 16),
          Number.parseInt(expanded.slice(2, 4), 16),
          Number.parseInt(expanded.slice(4, 6), 16)
        ];
      }
      const match = normalized.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
    };
    const relativeLuminance = (value: string) => {
      const channels = parseColor(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
    };
    const contrast = (left: string, right: string) => {
      const leftLuminance = relativeLuminance(left);
      const rightLuminance = relativeLuminance(right);
      return (Math.max(leftLuminance, rightLuminance) + 0.05) / (Math.min(leftLuminance, rightLuminance) + 0.05);
    };
    const opaqueBackground = (node: Element) => {
      let current: Element | null = node;
      while (current) {
        const background = window.getComputedStyle(current).backgroundColor;
        const alpha = background.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1];
        if (background !== "transparent" && (alpha === undefined || Number(alpha) > 0.99)) {
          return background;
        }
        current = current.parentElement;
      }
      return "rgb(255, 255, 255)";
    };

    let ancestor = focusOwner.parentElement;
    while (ancestor) {
      const ancestorStyle = window.getComputedStyle(ancestor);
      const ancestorRect = ancestor.getBoundingClientRect();
      // Root scrolling/Modal scroll-lock overflow is represented by the viewport check below;
      // it does not establish a descendant paint-clipping box like an ordinary wrapper.
      const isDocumentScroller = ancestor === document.body || ancestor === document.documentElement;
      const clipsX = !isDocumentScroller && clipValues.has(ancestorStyle.overflowX);
      const clipsY = !isDocumentScroller && clipValues.has(ancestorStyle.overflowY);
      if (
        (clipsX &&
          (rect.left - ringExtent < ancestorRect.left - 0.5 || rect.right + ringExtent > ancestorRect.right + 0.5)) ||
        (clipsY &&
          (rect.top - ringExtent < ancestorRect.top - 0.5 || rect.bottom + ringExtent > ancestorRect.bottom + 0.5))
      ) {
        clippedBy.push(
          `${ancestor.tagName.toLowerCase()}${ancestor.id ? `#${ancestor.id}` : ""}.${ancestor.className || ""}`
        );
      }
      ancestor = ancestor.parentElement;
    }

    const ringRgb = `rgb(${parseColor(focusRing).join(", ")})`;
    const separationRgb = `rgb(${parseColor(focusSeparation).join(", ")})`;
    const background = opaqueBackground(focusOwner);
    const canonicalLayerCount = [ringRgb, separationRgb].filter((color) => style.boxShadow.includes(color)).length;

    return {
      boxShadow: style.boxShadow,
      outlineWidth: Number.parseFloat(style.outlineWidth || "0"),
      ringExtent,
      canonicalLayerCount,
      clippedBy,
      viewportClipped:
        rect.left - ringExtent < -0.5 ||
        rect.top - ringExtent < -0.5 ||
        rect.right + ringExtent > window.innerWidth + 0.5 ||
        rect.bottom + ringExtent > window.innerHeight + 0.5,
      widthDelta: Math.abs(rect.width - (beforeRect?.width ?? rect.width)),
      heightDelta: Math.abs(rect.height - (beforeRect?.height ?? rect.height)),
      focusBoundaryRatio: Math.max(contrast(focusRing, background), contrast(focusSeparation, background)),
      bounds: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      }
    };
  }, before);
}

async function expectAccessibleFocus(target: Locator) {
  const measurement = await inspectFocusEffect(target);
  expect(measurement.ringExtent).toBeGreaterThanOrEqual(5);
  expect(measurement.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(measurement.canonicalLayerCount, JSON.stringify(measurement)).toBe(2);
  expect(measurement.focusBoundaryRatio).toBeGreaterThanOrEqual(3);
  expect(measurement.clippedBy).toEqual([]);
  expect(measurement.viewportClipped, JSON.stringify(measurement)).toBe(false);
  expect(measurement.widthDelta).toBeLessThanOrEqual(0.1);
  expect(measurement.heightDelta).toBeLessThanOrEqual(0.1);
  return measurement;
}

async function readControlContrast(target: Locator): Promise<ControlContrastMeasurement> {
  return target.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const parseColor = (value: string) => {
      const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
    };
    const relativeLuminance = (value: string) => {
      const channels = parseColor(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
    };
    const contrast = (left: string, right: string) => {
      const leftLuminance = relativeLuminance(left);
      const rightLuminance = relativeLuminance(right);
      return (Math.max(leftLuminance, rightLuminance) + 0.05) / (Math.min(leftLuminance, rightLuminance) + 0.05);
    };
    const opaqueBackground = (node: Element) => {
      let current: Element | null = node;
      while (current) {
        const background = window.getComputedStyle(current).backgroundColor;
        const alpha = background.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1];
        if (background !== "transparent" && (alpha === undefined || Number(alpha) > 0.99)) {
          return background;
        }
        current = current.parentElement;
      }
      return "rgb(255, 255, 255)";
    };

    const background = opaqueBackground(element);
    return {
      foreground: style.color,
      background,
      borderColor: style.borderColor,
      textRatio: contrast(style.color, background),
      borderRatio: contrast(style.borderColor, background)
    };
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ).toBeLessThanOrEqual(1);
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

test("Public top-bar social IconButtons inherit white and retain visible focus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installPublicShellClsFixture(page, { delayed: false, includeSocialLinks: true });
  await page.goto("/");
  await page.locator('[data-footer-directory-state="ready"]').waitFor();

  for (const label of ["Facebook", "YouTube", "TikTok"]) {
    const socialIcon = page.getByRole("link", { name: label });
    await expect(socialIcon).toBeVisible();
    await expect(socialIcon).toHaveClass(/MuiIconButton-colorInherit/);

    const colors = await socialIcon.evaluate((element) => ({
      foreground: window.getComputedStyle(element).color,
      inheritedForeground: window.getComputedStyle(element.parentElement as Element).color
    }));
    expect(colors.foreground).toBe("rgb(255, 255, 255)");
    expect(colors.foreground).toBe(colors.inheritedForeground);

    await socialIcon.focus();
    const focusStyle = await socialIcon.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        outlineWidth: Number.parseFloat(style.outlineWidth || "0"),
        boxShadow: style.boxShadow
      };
    });
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(focusStyle.boxShadow).not.toBe("none");
  }
});

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

for (const viewport of [
  { name: "desktop", width: 1280, height: 720 },
  { name: "wide", width: 1440, height: 900 }
] as const) {
  test(`${viewport.name} Admin content table preserves readable columns and contained scrolling`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installAuthenticatedDesignSystemCmsFixture(page);
    await page.goto("/admin/content");
    await page.getByRole("heading", { name: "เนื้อหา" }).waitFor();

    const table = page.getByRole("table", { name: "ตารางเนื้อหา" });
    await expect(table).toBeVisible({ timeout: 10_000 });
    const tableScroll = page.locator(".table-scroll");

    const tableMetrics = await table.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        minWidth: Number.parseFloat(style.minWidth),
        width: element.getBoundingClientRect().width
      };
    });
    expect(tableMetrics.minWidth).toBeGreaterThanOrEqual(1_100);
    expect(tableMetrics.width).toBeGreaterThanOrEqual(1_100);

    for (const [columnId, expectedMinWidth] of [
      ["type", 88],
      ["status", 120],
      ["owner", 120],
      ["updatedAt", 132],
      ["actions", 184]
    ] as const) {
      const header = table.locator(`thead [data-column-id="${columnId}"]`);
      const cell = table.locator(`tbody [data-column-id="${columnId}"]`).first();
      await expect(header).toHaveCSS("white-space", "nowrap");
      await expect(cell).toHaveCSS("white-space", "nowrap");
      expect((await header.boundingBox())?.width ?? 0, columnId).toBeGreaterThanOrEqual(expectedMinWidth - 1);
      expect((await cell.boundingBox())?.width ?? 0, columnId).toBeGreaterThanOrEqual(expectedMinWidth - 1);
    }

    const titleCell = table.locator('tbody [data-column-id="title"]').first();
    await expect(titleCell).toHaveCSS("white-space", "normal");
    await expect(titleCell).toHaveCSS("word-break", "normal");
    expect((await titleCell.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(459);

    const actionButtons = table.locator('tbody [data-column-id="actions"] .MuiIconButton-root');
    const actionYPositions = await actionButtons.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().y))
    );
    expect(new Set(actionYPositions).size).toBe(1);
    await expect(table.locator('tbody [data-column-id="actions"] .MuiStack-root')).toHaveCSS("flex-wrap", "nowrap");

    expect(await tableScroll.evaluate((element) => element.scrollWidth >= element.clientWidth)).toBe(true);
    await expectNoHorizontalOverflow(page);
  });
}

test("mobile Admin content table scrolls inside its container without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAuthenticatedDesignSystemCmsFixture(page);
  await page.goto("/admin/content");
  await page.getByRole("heading", { name: "เนื้อหา" }).waitFor();

  const table = page.getByRole("table", { name: "ตารางเนื้อหา" });
  await expect(table).toBeVisible({ timeout: 10_000 });
  const tableScroll = page.locator(".table-scroll");
  const scrollMetrics = await tableScroll.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: window.getComputedStyle(element).overflowX
  }));
  expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
  expect(scrollMetrics.overflowX).toBe("auto");
  await expectNoHorizontalOverflow(page);
});

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

test("desktop Public menu keeps top-level and submenu focus visible without clipping", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installPublicShellClsFixture(page, { delayed: false, includeNestedMenu: true });
  await page.goto("/");
  await page.locator('[data-footer-directory-state="ready"]').waitFor();

  const navigation = page.getByRole("navigation", { name: "เมนูหลัก" });
  const topLevelLink = navigation.getByRole("link", { name: "หน้าหลัก", exact: true });
  const topLevelFocus = await expectAccessibleFocus(topLevelLink);

  const submenuOwner = navigation.getByRole("link", { name: "หลักสูตร", exact: true });
  await submenuOwner.focus();
  const submenuLink = navigation.getByRole("link", { name: "หลักสูตรเกษตร", exact: true });
  await expect(submenuLink).toBeVisible();
  const submenuFocus = await expectAccessibleFocus(submenuLink);
  await expect(submenuLink).toBeVisible();
  await expectNoHorizontalOverflow(page);

  console.log(`DESIGN_SYSTEM_DESKTOP_MENU_FOCUS ${JSON.stringify({ topLevelFocus, submenuFocus })}`);
});

test("compact Public menu and Drawer items preserve contextual focus geometry", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPublicShellClsFixture(page, { delayed: false, includeNestedMenu: true });
  await page.goto("/");
  await page.locator('[data-footer-directory-state="ready"]').waitFor();

  const menuButton = page.getByRole("button", { name: "เปิดเมนูหลัก" });
  const menuButtonFocus = await expectAccessibleFocus(menuButton);
  await menuButton.click();

  const drawerItem = page.getByRole("button", { name: "หลักสูตร", exact: true });
  await expect(drawerItem).toBeVisible();
  await expect
    .poll(async () => (await drawerItem.boundingBox())?.x ?? -1, {
      message: "Drawer opening transition reaches its final focus-safe inset"
    })
    .toBeGreaterThanOrEqual(4.9);
  const drawerItemFocus = await expectAccessibleFocus(drawerItem);
  await expectNoHorizontalOverflow(page);

  console.log(`DESIGN_SYSTEM_MOBILE_MENU_FOCUS ${JSON.stringify({ menuButtonFocus, drawerItemFocus })}`);
});

test("contextual focus and secondary variants meet rendered contrast policy", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/tests/functional/fixtures/designSystemHarness.html");

  const focusMeasurements: Record<string, FocusEffectMeasurement> = {};
  for (const name of ["page", "paper", "primary", "primary-strong", "accent", "inverse"]) {
    focusMeasurements[name] = await expectAccessibleFocus(page.getByTestId(`focus-${name}`));
  }

  const controls = [
    {
      name: "contained",
      locator: page.getByRole("button", { name: "Secondary contained", exact: true }),
      outlined: false
    },
    {
      name: "outlined",
      locator: page.getByRole("button", { name: "Secondary outlined", exact: true }),
      outlined: true
    },
    { name: "text", locator: page.getByRole("button", { name: "Secondary text", exact: true }), outlined: false },
    {
      name: "outlinedChip",
      locator: page.getByRole("button", { name: "Secondary outlined chip", exact: true }),
      outlined: true
    }
  ] as const;
  const contrastMeasurements: Record<string, ControlContrastMeasurement> = {};

  for (const control of controls) {
    const contrast = await readControlContrast(control.locator);
    contrastMeasurements[control.name] = contrast;
    expect(contrast.textRatio, `${control.name} text contrast`).toBeGreaterThanOrEqual(4.5);
    if (control.outlined) {
      expect(contrast.borderRatio, `${control.name} border contrast`).toBeGreaterThanOrEqual(3);
    }
    await expectAccessibleFocus(control.locator);
  }

  await expectNoHorizontalOverflow(page);
  console.log(`DESIGN_SYSTEM_CONTEXTUAL_CONTRAST ${JSON.stringify({ focusMeasurements, contrastMeasurements })}`);
});
