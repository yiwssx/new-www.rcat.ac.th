import { expect, test, type Page } from "@playwright/test";
import { attachProductionDiagnostics } from "./productionDiagnostics";

const productionBaseUrl = process.env.PHASE_A_PRODUCTION_BASE_URL || "https://www.rcat.ac.th";

async function dismissIntroGateIfPresent(page: Page) {
  const dialog = page.getByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" });

  try {
    await dialog.waitFor({ state: "visible", timeout: 1_500 });
    await dialog.getByRole("button").click();
    await expect(dialog).toBeHidden();
  } catch {
    // The gate is optional and can be disabled by current homepage settings.
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  const report = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflow = document.documentElement.scrollWidth - viewportWidth;
    const clippingValues = new Set(["hidden", "clip", "auto", "scroll"]);

    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0" ||
          style.clip !== "auto" ||
          style.clipPath !== "none"
        ) {
          return null;
        }

        let visibleLeft = rect.left;
        let visibleRight = rect.right;
        let ancestor = element.parentElement;
        let clippingAncestor: string | null = null;

        while (ancestor && ancestor !== document.body) {
          const ancestorStyle = window.getComputedStyle(ancestor);

          if (clippingValues.has(ancestorStyle.overflowX)) {
            const ancestorRect = ancestor.getBoundingClientRect();
            visibleLeft = Math.max(visibleLeft, ancestorRect.left);
            visibleRight = Math.min(visibleRight, ancestorRect.right);
            clippingAncestor ||= `${ancestor.tagName.toLowerCase()}.${String(ancestor.className || "")}`;
          }

          if (visibleRight <= visibleLeft) {
            return null;
          }

          ancestor = ancestor.parentElement;
        }

        const leftOverflow = Math.max(0, -visibleLeft);
        const rightOverflow = Math.max(0, visibleRight - viewportWidth);
        const overflow = Math.max(leftOverflow, rightOverflow);

        if (overflow <= 2) {
          return null;
        }

        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: typeof element.className === "string" ? element.className : "",
          role: element.getAttribute("role"),
          ariaLabel: element.getAttribute("aria-label"),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          visibleLeft: Math.round(visibleLeft),
          visibleRight: Math.round(visibleRight),
          width: Math.round(rect.width),
          overflow: Math.round(overflow),
          position: style.position,
          overflowX: style.overflowX,
          clippingAncestor,
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100)
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .sort((left, right) => right.overflow - left.overflow)
      .slice(0, 20);

    return {
      viewportWidth,
      // When this assertion fails, identify discrepancies between the browser
      // layout viewport and the actually visible document client area.
      layoutViewportWidth: window.innerWidth,
      visualViewportWidth: window.visualViewport?.width ?? null,
      bodyWidth: Math.round(document.body.getBoundingClientRect().width),
      documentOverflow,
      offenders
    };
  });

  expect(report.offenders, JSON.stringify(report, null, 2)).toEqual([]);
}

test.describe("Phase A production public browser smoke", () => {
  test("renders core public routes without browser/runtime failures", async ({ page }) => {
    const diagnostics = attachProductionDiagnostics(page, productionBaseUrl);

    const homeResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(homeResponse?.status()).toBe(200);
    await dismissIntroGateIfPresent(page);
    await expect(page.locator("html")).toHaveAttribute("data-rcat-ssr", "true");
    await expect(page.locator("body")).toContainText("วิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด");
    await expectNoHorizontalOverflow(page);

    const documentsResponse = await page.goto("/documents", { waitUntil: "domcontentloaded" });
    expect(documentsResponse?.status()).toBe(200);
    await dismissIntroGateIfPresent(page);
    await expect(page.getByRole("heading", { name: "เอกสารเผยแพร่", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const probe = "phase-a-field-qa-probe-no-match-8f4b0c";
    const searchResponse = await page.goto(`/search?q=${encodeURIComponent(probe)}`, { waitUntil: "domcontentloaded" });
    expect(searchResponse?.status()).toBe(200);
    await dismissIntroGateIfPresent(page);
    await expect(page.getByRole("heading", { name: "ค้นหา", level: 1 })).toBeVisible();
    await expect(page.getByText("ไม่พบผลการค้นหา")).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "ค้นหาในเว็บไซต์" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    diagnostics.assertClean();
  });

  test("checks real published organization SSR hydration and top-down personnel geometry", async ({ page }) => {
    const diagnostics = attachProductionDiagnostics(page, productionBaseUrl);
    const hydrationErrors: string[] = [];
    const capture = (message: string) => {
      if (
        message.includes("react.dev/errors/418") ||
        message.includes("Minified React error #418") ||
        /hydration (failed|mismatch)|server rendered HTML/i.test(message)
      ) {
        hydrationErrors.push(message);
      }
    };
    page.on("console", (message) => {
      if (message.type() === "error") capture(message.text());
    });
    page.on("pageerror", (error) => capture(error.message));

    const response = await page.goto("/organization/rcat-2569-business", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-rcat-ssr", "true");
    await expect(page.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" })).toBeVisible();
    await expect(page.locator('[data-org-position-flow="top-down"]').first()).toBeVisible();
    await expect(page.locator('main svg[data-testid="AccountTreeOutlinedIcon"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    expect(hydrationErrors, hydrationErrors.join("\n")).toEqual([]);
    diagnostics.assertClean();
  });

  test("keeps unauthenticated CMS boundaries reachable and protected", async ({ page }) => {
    const diagnostics = attachProductionDiagnostics(page, productionBaseUrl);

    const loginResponse = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(loginResponse?.status()).toBe(200);
    await expect(page.getByLabel("อีเมลหรือชื่อผู้ใช้")).toBeVisible();
    await expect(page.getByLabel("รหัสผ่าน")).toBeVisible();

    const adminResponse = await page.goto("/admin", { waitUntil: "domcontentloaded" });
    expect(adminResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
    await expect(page.getByLabel("อีเมลหรือชื่อผู้ใช้")).toBeVisible();

    diagnostics.assertClean();
  });
});
