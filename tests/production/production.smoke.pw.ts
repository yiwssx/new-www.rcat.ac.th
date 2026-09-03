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

    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const leftOverflow = Math.max(0, -rect.left);
        const rightOverflow = Math.max(0, rect.right - viewportWidth);
        const overflow = Math.max(leftOverflow, rightOverflow);

        if (
          overflow <= 2 ||
          rect.width <= 0 ||
          rect.height <= 0 ||
          style.display === "none" ||
          style.visibility === "hidden"
        ) {
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
          width: Math.round(rect.width),
          overflow: Math.round(overflow),
          position: style.position,
          overflowX: style.overflowX,
          transform: style.transform,
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100)
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .sort((left, right) => right.overflow - left.overflow)
      .slice(0, 30);

    return { viewportWidth, documentOverflow, offenders };
  });

  expect(report.documentOverflow, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(2);
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
