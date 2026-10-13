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

async function installOrganizationFixture(
  page: Page,
  mode: "cards" | "rows" | "tree" = "cards",
  mixed = false,
  extraSiblings = 0,
  twoCardPositions = false
) {
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
            chartMode: mixed ? "cards" : undefined,
            unitKind: "work",
            sortOrder: 0,
            slug: "งานทะเบียน",
            title: "งานทะเบียน",
            summary: "",
            depth: 1
          },
          {
            contentId: "work-2",
            parentContentId: "division-1",
            chartMode: mixed ? "tree" : undefined,
            chartLayout: mixed
              ? {
                  "work2-lead": { level: 1, row: 1, order: 0, parentPositionId: null },
                  "work2-member": { level: 2, row: 1, order: 0, parentPositionId: "work2-lead" }
                }
              : undefined,
            unitKind: "work",
            sortOrder: 1,
            slug: "work-2",
            title: "งานพัฒนาหลักสูตรและการเรียนรู้",
            summary: "หน่วยงานรับผิดชอบงานวางแผนด้านวิชาการ".repeat(4),
            depth: 1
          },
          {
            contentId: "work-3",
            parentContentId: "division-1",
            unitKind: "work",
            sortOrder: 2,
            slug: "work-3",
            title: "งานสื่อสารองค์กร",
            summary: "",
            depth: 1
          },
          {
            contentId: "work-2-child",
            parentContentId: "work-2",
            unitKind: "subunit",
            sortOrder: 0,
            slug: "work-2-child",
            title: "งานย่อยด้านหลักสูตร",
            summary: "",
            depth: 2
          },
          ...Array.from({ length: extraSiblings }, (_, index) => ({
            contentId: "extra-" + index,
            parentContentId: "division-1",
            unitKind: "work",
            sortOrder: 10 + index,
            slug: "extra-" + index,
            title: "หน่วยงานพิเศษ " + index,
            summary: "",
            depth: 1
          }))
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
          ...(mode === "cards" && !twoCardPositions
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
              ]),
          ...(mixed
            ? [
                {
                  id: "work1-role",
                  unitContentId: "work-1",
                  title: "งานประสานทะเบียน",
                  groupLabel: "",
                  groupSortOrder: 0,
                  sortOrder: 0,
                  displayStyle: "default",
                  assignments: [
                    {
                      id: "work1-duty",
                      dutyDetail: "งานทะเบียนควบคู่",
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
                {
                  id: "work2-lead",
                  unitContentId: "work-2",
                  title: "หัวหน้างานหลักสูตร",
                  groupLabel: "",
                  groupSortOrder: 0,
                  sortOrder: 0,
                  displayStyle: "default",
                  assignments: [
                    {
                      id: "work2-duty-1",
                      dutyDetail: "กำกับงานหลักสูตร",
                      sortOrder: 0,
                      person: {
                        id: "person-3",
                        displayName: "บุคลากรหลักสูตร",
                        personnelType: "teacher",
                        employmentPosition: "ครู",
                        photoMediaId: null,
                        publicEmail: "",
                        publicPhone: ""
                      }
                    }
                  ]
                },
                {
                  id: "work2-member",
                  unitContentId: "work-2",
                  title: "ผู้ช่วยงานหลักสูตร",
                  groupLabel: "",
                  groupSortOrder: 1,
                  sortOrder: 0,
                  displayStyle: "default",
                  assignments: []
                }
              ]
            : [])
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
  for (const width of [390, 768, 1280, 1440]) {
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
    for (const width of [390, 768, 1280, 1440]) {
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
          await expect(page.getByRole("region", { name: "ระดับ 1 แถว 1", exact: true })).toBeVisible();
          await expect(page.getByRole("region", { name: "ระดับ 2 แถว 1", exact: true })).toBeVisible();
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

test.describe("Organization V2.2 horizontal inter-unit chart", () => {
  for (const width of [390, 768, 1280, 1440]) {
    test("sibling branches remain horizontal and page-bounded at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installOrganizationFixture(page);
      await page.goto("/organization/" + encodeURIComponent(slug));
      await dismissGateIfVisible(page);

      const region = page.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" });
      await expect(region).toBeVisible();
      await expect(region.getByRole("link", { name: "งานย่อยด้านหลักสูตร" })).toBeAttached();

      const rootLink = region.getByRole("link", { name: "ฝ่ายวิชาการ" });
      const grandchild = region.getByRole("link", { name: "งานย่อยด้านหลักสูตร" });
      const horizontalChain = await Promise.all(
        [rootLink, region.getByRole("link", { name: "งานพัฒนาหลักสูตรและการเรียนรู้" }), grandchild].map((link) =>
          link.boundingBox()
        )
      );
      expect(horizontalChain.every(Boolean)).toBe(true);
      expect(horizontalChain[0]!.x).toBeLessThan(horizontalChain[1]!.x);
      expect(horizontalChain[1]!.x).toBeLessThan(horizontalChain[2]!.x);
      expect(Math.abs(horizontalChain[0]!.y - horizontalChain[1]!.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(horizontalChain[1]!.y - horizontalChain[2]!.y)).toBeLessThanOrEqual(2);
      await expect(region).toHaveAttribute("data-org-direction", "left-to-right");
      const first = region.getByRole("link", { name: "งานทะเบียน" });
      const second = region.getByRole("link", { name: "งานพัฒนาหลักสูตรและการเรียนรู้" });
      const third = region.getByRole("link", { name: "งานสื่อสารองค์กร" });
      const branch = await region.getByRole("link", { name: "ฝ่ายวิชาการ" }).evaluate((link) => {
        const root = link.closest("li");
        return root?.querySelectorAll(":scope > ul > li").length ?? 0;
      });
      expect(branch).toBe(3);

      const locations = await Promise.all([first, second, third].map((link) => link.boundingBox()));
      expect(locations.every(Boolean)).toBe(true);
      expect(locations[0]!.x).toBeLessThan(locations[1]!.x);
      expect(locations[1]!.x).toBeLessThan(locations[2]!.x);
      expect(Math.abs(locations[0]!.y - locations[1]!.y)).toBeLessThanOrEqual(2);
      expect(Math.abs(locations[1]!.y - locations[2]!.y)).toBeLessThanOrEqual(2);

      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
        .toBe(true);
      if (width === 390) {
        expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
        await region.focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      }
    });
  }
});

test.describe("Organization V2.2 Phase 3 mixed position charts", () => {
  for (const width of [390, 768, 1280, 1440]) {
    test(
      "shows rows/tree/cards inside corresponding units without duplicate assignments at " + width + "px",
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await installOrganizationFixture(page, "rows", true);
        await page.goto("/organization/" + encodeURIComponent(slug));
        await dismissGateIfVisible(page);

        const hierarchy = page.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" });
        await expect(hierarchy).toBeVisible();
        await expect(page.getByRole("region", { name: "แถวระดับ 1 แถว 1 เลื่อนแนวนอนได้" })).toBeAttached();
        await expect(page.getByRole("region", { name: /ผังสายบังคับบัญชา/ })).toBeAttached();
        await expect(
          page.getByRole("region", { name: /ผังสายบังคับบัญชา/ }).getByText("หัวหน้างานหลักสูตร")
        ).toBeAttached();
        await expect(
          page.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" }).getByText("งานประสานทะเบียน")
        ).toBeAttached();
        await expect(
          page.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" }).getByText("ยังไม่มีผู้ดำรงตำแหน่ง")
        ).toBeAttached();
        await expect(page.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" }).getByText("บุคลากรทดสอบ")).toHaveCount(
          2
        );
        await expect(
          page.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" }).getByText("งานทะเบียนควบคู่")
        ).toHaveCount(1);
        await expect(page.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" })).toHaveCount(1);
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
          .toBe(true);
      }
    );
  }
});

test.describe("Organization V2.2 Phase 5 final browser regression", () => {
  for (const width of [390, 768, 1280, 1440]) {
    test("mixed A/B/Cards chart, connectors, WCAG and keyboard at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      let detailCalls = 0;
      await installOrganizationFixture(page, "rows", true);
      page.on("request", (request) => {
        if (request.url().includes("/api/public/organization/")) detailCalls += 1;
      });
      await page.goto("/organization/" + encodeURIComponent(slug));
      await dismissGateIfVisible(page);

      const hierarchy = page.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" });
      await expect(hierarchy).toBeVisible();
      await expect(hierarchy.getByRole("link", { name: "งานทะเบียน" })).toHaveAttribute(
        "href",
        "/organization/" + encodeURIComponent("งานทะเบียน")
      );
      await expect(hierarchy.getByRole("link", { name: "งานย่อยด้านหลักสูตร" })).toBeAttached();
      const rows = page.getByRole("region", { name: "แถวระดับ 1 แถว 1 เลื่อนแนวนอนได้" });
      const tree = page.getByRole("region", { name: /ผังสายบังคับบัญชา/ });
      await expect(rows).toBeAttached();
      await expect(tree).toBeAttached();
      await expect(rows).toHaveClass(/rcat-focus-ring/);
      await expect(tree).toHaveClass(/rcat-focus-ring/);
      await expect(
        page.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" }).getByText("งานประสานทะเบียน")
      ).toHaveCount(1);
      await expect(page.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" }).getByText("บุคลากรทดสอบ")).toHaveCount(
        2
      );
      await expect(
        page.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" }).getByText("งานทะเบียนควบคู่")
      ).toHaveCount(1);
      await expect(tree.getByText("หัวหน้างานหลักสูตร")).toBeAttached();
      await expect(tree.getByText("ผู้ช่วยงานหลักสูตร")).toBeAttached();

      const connectors = await hierarchy.getByRole("link", { name: "ฝ่ายวิชาการ" }).evaluate((link) => {
        const children = link.closest("li")?.querySelector(":scope > ul");
        return children
          ? {
              branchCount: children.querySelectorAll(":scope > li").length,
              line: getComputedStyle(children, "::before").borderTopWidth
            }
          : null;
      });
      expect(connectors).toEqual({ branchCount: 3, line: "2px" });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
        .toBe(true);

      await hierarchy.focus();
      await expect(hierarchy).toBeFocused();
      if (width === 390) {
        expect(await hierarchy.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => hierarchy.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      }

      const audit = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) }))
      ).toEqual([]);
      expect(detailCalls).toBeLessThanOrEqual(2);
    });
  }
});

test.describe("Organization V2.2 Phase 5 high-cardinality browser regression", () => {
  for (const width of [390, 1440]) {
    test(
      "more than 100 siblings remain in the diagram rather than expanding the document at " + width + "px",
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await installOrganizationFixture(page, "cards", false, 128);
        await page.goto("/organization/" + encodeURIComponent(slug));
        await dismissGateIfVisible(page);
        const region = page.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" });
        await expect(region).toBeVisible();
        await expect(region.getByRole("link")).toHaveCount(133);
        await expect(region.getByRole("link", { name: "หน่วยงานพิเศษ 127" })).toBeAttached();
        const count = await region
          .getByRole("link", { name: "ฝ่ายวิชาการ" })
          .evaluate((link) => link.closest("li")?.querySelectorAll(":scope > ul > li").length ?? 0);
        expect(count).toBe(131);
        expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
          .toBe(true);
        await region.focus();
        await expect(region).toBeFocused();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      }
    );
  }
});

test.describe("Organization field regression: Cards positions should not be a vertical list", () => {
  for (const width of [390, 1440]) {
    test("shows two Cards-mode positions beside each other at " + width + "px", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installOrganizationFixture(page, "cards", false, 0, true);
      await page.goto("/organization/" + encodeURIComponent(slug));
      await dismissGateIfVisible(page);

      const rail = page.getByRole("region", { name: "ตำแหน่งของฝ่ายวิชาการ เลื่อนแนวนอนได้" });
      const left = await rail.getByRole("heading", { name: "หัวหน้าฝ่าย", exact: true }).boundingBox();
      const right = await rail.getByText("รองหัวหน้าฝ่าย").boundingBox();
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
      expect(right!.x).toBeGreaterThan(left!.x);
      expect(Math.abs(right!.y - left!.y)).toBeLessThanOrEqual(2);
      await expect(rail).toHaveClass(/rcat-focus-ring/);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
        .toBe(true);
    });
  }
});

test.describe("Organization field regression: no phantom header or narrow vertical personnel", () => {
  for (const width of [390, 630, 1440]) {
    for (const mode of ["rows", "tree"] as const) {
      test(`renders ${mode} root-to-deputy positions horizontally at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await installOrganizationFixture(page, mode);
        await page.goto("/organization/" + encodeURIComponent(slug));
        await dismissGateIfVisible(page);

        const personnel = page.getByRole("region", { name: "ผังบุคลากรตามหน่วยงาน" });
        const diagram = page.getByRole("region", { name: "ผังลำดับชั้นหน่วยงาน เลื่อนแนวนอนได้" });
        await expect(personnel).toBeVisible();
        await expect(diagram).toBeVisible();
        await expect(diagram.getByText("บุคลากรทดสอบ")).toHaveCount(0);
        const first = await personnel.getByText("หัวหน้าฝ่าย", { exact: true }).boundingBox();
        const second = await personnel.getByText("รองหัวหน้าฝ่าย", { exact: true }).boundingBox();
        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(second!.x).toBeGreaterThan(first!.x);
        expect(Math.abs(second!.y - first!.y)).toBeLessThanOrEqual(3);
        await expect(page.locator('main [aria-hidden="true"].MuiSkeleton-root')).toHaveCount(0);
        await expect(page.locator('main svg[data-testid="AccountTreeOutlinedIcon"]')).toHaveCount(0);
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
          .toBe(true);
      });
    }
  }
});
