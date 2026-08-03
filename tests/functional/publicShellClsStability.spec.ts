import { expect, test, type Page } from "@playwright/test";
import {
  groupLayoutShiftsBySource,
  installLayoutShiftObserver,
  readCumulativeLayoutShift,
  readPublicLayoutSnapshot,
  resetLayoutShiftEntries,
  waitForLayoutQuietWindow,
  type PublicLayoutSnapshot
} from "./helpers/layoutShift";
import { installPublicShellClsFixture, PUBLIC_SHELL_CLS_CONTENT_SLUG } from "./fixtures/publicShellClsFixture";

interface DirectLayoutCase {
  name: string;
  path: string;
  width: number;
  height: number;
  readyText: string | RegExp;
  baselineCls: number;
}

const directLayoutCases: DirectLayoutCase[] = [
  {
    name: "desktop-news",
    path: "/news",
    width: 1280,
    height: 720,
    readyText: "Fixture news 1",
    baselineCls: 0.847
  },
  {
    name: "mobile-news",
    path: "/news",
    width: 390,
    height: 844,
    readyText: "Fixture news 1",
    baselineCls: 1.469
  },
  {
    name: "desktop-search",
    path: "/search?q=fixture",
    width: 1280,
    height: 720,
    readyText: /พบ 23 รายการ/,
    baselineCls: 0.847
  },
  {
    name: "desktop-departments",
    path: "/departments",
    width: 1280,
    height: 720,
    readyText: "Fixture program 1",
    baselineCls: 0.847
  },
  {
    name: "desktop-content-detail",
    path: `/content/${PUBLIC_SHELL_CLS_CONTENT_SLUG}`,
    width: 1280,
    height: 720,
    readyText: "Deterministic layout stability content detail",
    baselineCls: 0.782
  }
];

function movement(before: PublicLayoutSnapshot, after: PublicLayoutSnapshot, region: keyof PublicLayoutSnapshot) {
  const beforeBox = before[region];
  const afterBox = after[region];

  if (
    !beforeBox ||
    !afterBox ||
    typeof beforeBox !== "object" ||
    typeof afterBox !== "object" ||
    !("top" in beforeBox) ||
    !("top" in afterBox)
  ) {
    throw new Error(`Missing ${String(region)} geometry`);
  }

  return {
    top: afterBox.top - beforeBox.top,
    height: afterBox.height - beforeBox.height
  };
}

async function waitForReadyText(page: Page, readyText: string | RegExp) {
  await page.getByText(readyText).first().waitFor();
}

for (const layoutCase of directLayoutCases) {
  test(`${layoutCase.name} keeps the Public shell stable across delayed API resolution`, async ({ page }) => {
    await page.setViewportSize({ width: layoutCase.width, height: layoutCase.height });
    await installLayoutShiftObserver(page);
    const fixture = await installPublicShellClsFixture(page);

    await page.goto(layoutCase.path);
    const loadingRegion = page.locator('[data-cls-region="public-loading"]');
    const directoryRegion = page.locator('[data-cls-region="footer-directory"]');
    await expect(loadingRegion).toBeVisible();
    await expect(directoryRegion).toHaveAttribute("data-footer-directory-state", "loading");
    await page.waitForTimeout(350);

    const before = await readPublicLayoutSnapshot(page);
    expect(before.loading?.height).toBeGreaterThan(layoutCase.height);
    expect(before.footerDirectory?.height).toBeGreaterThan(250);
    expect(before.darkFooter?.top).toBeGreaterThan(layoutCase.height);

    fixture.release();
    await waitForReadyText(page, layoutCase.readyText);

    if (layoutCase.name === "desktop-news") {
      expect(fixture.requests.filter((request) => request === "/api/public/shell")).toHaveLength(1);
      expect(fixture.requests.filter((request) => request === "/api/public/home")).toHaveLength(0);
    }
    await expect(directoryRegion).toHaveAttribute("data-footer-directory-state", "ready");
    await expect(page.getByRole("heading", { name: "หน่วยงานส่วนกลาง สอศ.(สำนัก)" })).toBeVisible();
    const immediatelyAfterResponse = await readPublicLayoutSnapshot(page);
    await waitForLayoutQuietWindow(page);

    const after = await readPublicLayoutSnapshot(page);
    const cls = await readCumulativeLayoutShift(page);
    const sources = await groupLayoutShiftsBySource(page);
    const directoryMovement = movement(before, after, "footerDirectory");
    const darkFooterMovement = movement(before, after, "darkFooter");

    console.log(
      `PUBLIC_SHELL_CORRECTED ${layoutCase.name} ${JSON.stringify({
        baselineCls: layoutCase.baselineCls,
        cls,
        directoryMovement,
        darkFooterMovement,
        before,
        immediatelyAfterResponse,
        after,
        sources
      })}`
    );

    expect(cls).toBeLessThan(0.1);
    expect(Math.abs(directoryMovement.top)).toBeLessThan(75);
    expect(Math.abs(directoryMovement.height)).toBeLessThan(2);
    expect(Math.abs(darkFooterMovement.top)).toBeLessThan(75);

    if (layoutCase.name === "mobile-news") {
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(1);
    }
  });
}

test("Public route navigation retains one shell, ready directory content, and cached geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installLayoutShiftObserver(page);
  const fixture = await installPublicShellClsFixture(page, { delayed: false });

  await page.goto("/news");
  await waitForReadyText(page, "Fixture news 1");
  await expect(page.locator('[data-footer-directory-state="ready"]')).toBeVisible();
  await waitForLayoutQuietWindow(page);
  const shellHandle = await page.locator('[data-cls-region="public-shell"]').elementHandle();
  expect(shellHandle).not.toBeNull();

  fixture.hold();
  await resetLayoutShiftEntries(page);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/departments");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.locator('[data-public-loading-variant="card-grid"]')).toBeVisible();
  await expect(page.locator('[data-footer-directory-state="ready"]')).toBeVisible();
  const navigationLoading = await readPublicLayoutSnapshot(page);

  await page.waitForTimeout(650);
  fixture.release();
  await waitForReadyText(page, "Fixture program 1");
  await waitForLayoutQuietWindow(page);
  const navigationReady = await readPublicLayoutSnapshot(page);
  const navigationCls = await readCumulativeLayoutShift(page);

  expect(navigationCls).toBeLessThan(0.1);
  expect(Math.abs(movement(navigationLoading, navigationReady, "darkFooter").top)).toBeLessThan(75);
  expect(
    await shellHandle?.evaluate((node) => node === document.querySelector('[data-cls-region="public-shell"]'))
  ).toBe(true);

  await resetLayoutShiftEntries(page);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/news");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await waitForReadyText(page, "Fixture news 1");
  await waitForLayoutQuietWindow(page);

  const cachedNavigationCls = await readCumulativeLayoutShift(page);
  console.log(`PUBLIC_SHELL_CACHED_NAVIGATION ${JSON.stringify({ navigationCls, cachedNavigationCls })}`);
  expect(cachedNavigationCls).toBeLessThan(0.02);
  await expect(page.locator('[data-cls-region="public-shell"]')).toHaveCount(1);
  await expect(page.locator('[data-footer-directory-state="ready"]')).toHaveCount(1);
});

test("background refetch retains ready route content and Footer Directory", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installLayoutShiftObserver(page);
  const fixture = await installPublicShellClsFixture(page, {
    staleNewsCache: true
  });

  await page.goto("/news");
  await waitForReadyText(page, "Fixture news 1");
  await expect(page.locator('[data-public-loading-variant="listing"]')).toHaveCount(0);
  await expect(page.locator('[data-cls-region="background-progress"]')).toBeVisible();
  await expect(page.locator('[data-footer-directory-state="ready"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await resetLayoutShiftEntries(page);
  const before = await readPublicLayoutSnapshot(page);

  fixture.release();
  await expect
    .poll(() => fixture.requests.filter((request) => request.startsWith("/api/public/content?")).length)
    .toBe(1);
  await waitForLayoutQuietWindow(page);
  const after = await readPublicLayoutSnapshot(page);
  const backgroundRefetchCls = await readCumulativeLayoutShift(page);
  const darkFooterMovement = movement(before, after, "darkFooter");

  await expect(page.getByText("Fixture news 1").first()).toBeVisible();
  await expect(page.locator('[data-footer-directory-state="ready"]')).toBeVisible();
  expect(Math.abs(darkFooterMovement.top)).toBeLessThan(5);
  expect(backgroundRefetchCls).toBeLessThan(0.02);
  console.log(`PUBLIC_SHELL_BACKGROUND_REFETCH ${JSON.stringify({ backgroundRefetchCls, darkFooterMovement })}`);
});

test("resolved empty Footer Directory collapses without a permanent blank region or material CLS", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installLayoutShiftObserver(page);
  const fixture = await installPublicShellClsFixture(page, { emptyFooterDirectory: true });

  await page.goto("/news");
  await expect(page.locator('[data-footer-directory-state="loading"]')).toBeVisible();
  fixture.release();
  await waitForReadyText(page, "Fixture news 1");
  await expect(page.locator('[data-footer-directory-state="empty"]')).toBeHidden();
  await waitForLayoutQuietWindow(page);

  const emptyDirectoryCls = await readCumulativeLayoutShift(page);
  expect(emptyDirectoryCls).toBeLessThan(0.1);
  expect(await page.locator('[data-footer-directory-state="empty"]').boundingBox()).toBeNull();
  await expect(page.locator('[data-cls-region="dark-footer"]')).toBeVisible();
  console.log(`PUBLIC_SHELL_EMPTY_DIRECTORY ${JSON.stringify({ emptyDirectoryCls })}`);
});

test("route API errors keep the shell, directory, and accessible retry state", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await installLayoutShiftObserver(page);
  const fixture = await installPublicShellClsFixture(page, {
    errorPath: "/api/public/content"
  });

  await page.goto("/news");
  await expect(page.locator('[data-footer-directory-state="loading"]')).toBeVisible();
  fixture.release();
  await expect(page.getByRole("alert")).toContainText("ไม่สามารถโหลดข้อมูลได้");
  await expect(page.getByRole("button", { name: "ลองอีกครั้ง" })).toBeVisible();
  await expect(page.locator('[data-footer-directory-state="ready"]')).toBeVisible();
  await waitForLayoutQuietWindow(page);

  const errorStateCls = await readCumulativeLayoutShift(page);
  expect(errorStateCls).toBeLessThan(0.1);
  await expect(page.locator('[data-cls-region="public-shell"]')).toHaveCount(1);
  console.log(`PUBLIC_SHELL_ERROR_STATE ${JSON.stringify({ errorStateCls })}`);
});

test("Auth and Admin routes do not render or request the Public shell", async ({ page }) => {
  const fixture = await installPublicShellClsFixture(page, { delayed: false });

  for (const path of ["/login", "/activate-account", "/reset-password", "/admin"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.locator('[data-cls-region="public-shell"]')).toHaveCount(0);
    await expect(page.locator('[data-cls-region="footer-directory"]')).toHaveCount(0);
  }

  expect(fixture.requests).toEqual([]);
});
