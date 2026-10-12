import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installPublicAuthIsolationFixture } from "./fixtures/publicAuthIsolationFixture";

const slug = "ฝ่ายวิชาการ";
const sampleUnit = {
  contentId: "division-1",
  parentContentId: null,
  unitKind: "division",
  sortOrder: 0,
  slug,
  title: "ฝ่ายวิชาการ",
  summary: "โครงสร้างฝ่ายวิชาการ",
  depth: 0
};

async function installOrganizationFixture(page: Page, mode: "cards" | "rows" | "tree" = "cards") {
  const chartUnit = {
    ...sampleUnit,
    chartMode: mode,
    chartLayout: {
      "position-1": { level: 1, row: 1, order: 0, parentPositionId: null },
      "position-2": { level: 2, row: 1, order: 0, parentPositionId: "position-1" }
    }
  };
  await installPublicAuthIsolationFixture(page);
  await page.route("**/api/public/organization/**", async (route) => {
    const requestedSlug = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop() ?? "");
    if (requestedSlug !== slug) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "not found" })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        unit: chartUnit,
        ancestors: [],
        units: [
          chartUnit,
          {
            contentId: "work-1",
            parentContentId: "division-1",
            unitKind: "work",
            sortOrder: 0,
            slug: "งานทะเบียน",
            title: "งานทะเบียน",
            summary: "",
            depth: 1
          }
        ],
        positions: [
          {
            id: "position-1",
            unitContentId: "division-1",
            title: "หัวหน้าฝ่าย",
            groupLabel: "",
            groupSortOrder: 0,
            sortOrder: 0,
            displayStyle: "default",
            assignments: [
              {
                id: "assignment-1",
                dutyDetail: "กำกับดูแลงาน",
                sortOrder: 0,
                person: {
                  id: "person-1",
                  displayName: "บุคลากรทดสอบ",
                  personnelType: "teacher",
                  employmentPosition: "ครู",
                  photoMediaId: null,
                  publicEmail: "",
                  publicPhone: ""
                }
              }
            ]
          },
          ...(mode === "cards"
            ? []
            : [
                {
                  id: "position-2",
                  unitContentId: "division-1",
                  title: "รองหัวหน้าฝ่าย",
                  groupLabel: "",
                  groupSortOrder: 1,
                  sortOrder: 0,
                  displayStyle: "default",
                  assignments: [
                    {
                      id: "assignment-2",
                      dutyDetail: "ประสานงานแผนก",
                      sortOrder: 0,
                      person: {
                        id: "person-2",
                        displayName: "บุคลากรคนที่สอง",
                        personnelType: "teacher",
                        employmentPosition: "ครู",
                        photoMediaId: null,
                        publicEmail: "",
                        publicPhone: ""
                      }
                    }
                  ]
                }
              ])
        ],
        media: []
      })
    });
  });
}

async function dismissGateIfVisible(page: Page) {
  const dialog = page.getByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" });
  if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button").first().click();
}

test.describe("Organization public accessibility and responsive regression", () => {
  for (const width of [390, 1280]) {
    test(`published Thai organization at ${width}px is accessible and does not overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 840 });
      await installOrganizationFixture(page);
      await page.goto(`/organization/${encodeURIComponent(slug)}`);
      await dismissGateIfVisible(page);
      await expect(page.getByRole("heading", { name: "ฝ่ายวิชาการ", level: 1 })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "ลำดับหน่วยงาน" })).toBeVisible();
      await expect(page.getByRole("link", { name: "งานทะเบียน" })).toHaveAttribute(
        "href",
        `/organization/${encodeURIComponent("งานทะเบียน")}`
      );
      await expect(page.getByText("บุคลากรทดสอบ")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
        .toBe(true);

      const audit = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => node.target)
        }))
      ).toEqual([]);
    });
  }

  for (const mode of ["rows", "tree"] as const) {
    for (const width of [390, 1280]) {
      test(`chart ${mode} at ${width}px keeps text accessible within a scrollable chart region`, async ({ page }) => {
        await page.setViewportSize({ width, height: 840 });
        await installOrganizationFixture(page, mode);
        await page.goto(`/organization/${encodeURIComponent(slug)}`);
        await dismissGateIfVisible(page);
        await expect(page.getByText("บุคลากรทดสอบ")).toBeVisible();
        await expect(page.getByText("บุคลากรคนที่สอง")).toBeVisible();
        if (mode === "tree") {
          await expect(page.getByRole("region", { name: /ผังสายบังคับบัญชา/ })).toBeVisible();
        } else {
          await expect(page.getByRole("region", { name: "ระดับ 1 แถว 1" })).toBeVisible();
          await expect(page.getByRole("region", { name: "ระดับ 2 แถว 1" })).toBeVisible();
        }
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
          .toBe(true);
        const audit = await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        expect(audit.violations.map((violation) => ({ id: violation.id, impact: violation.impact }))).toEqual([]);
      });
    }
  }

  test("an unpublished organization permalink returns a user-safe missing state", async ({ page }) => {
    await installOrganizationFixture(page);
    await page.goto("/organization/unpublished");
    await expect(page.getByRole("heading", { name: "ไม่พบหน้าที่ต้องการ" })).toBeVisible();
    await expect(page.getByRole("link", { name: "กลับหน้าแรก" })).toBeVisible();
  });
});
