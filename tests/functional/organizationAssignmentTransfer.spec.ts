import { expect, test, type Page, type Route } from "@playwright/test";
import { installAuthenticatedDesignSystemCmsFixture } from "./fixtures/designSystemCmsFixture";

const units = [
  {
    content_id: "division-1",
    parent_content_id: null,
    unit_kind: "division",
    sort_order: 0,
    slug: "division-1",
    title: "ฝ่ายบริหาร",
    summary: "",
    status: "published",
    publish_at: "",
    unpublish_at: "",
    content_revision: 0,
    unit_revision: 0
  },
  {
    content_id: "work-1",
    parent_content_id: "division-1",
    unit_kind: "work",
    sort_order: 0,
    slug: "work-1",
    title: "งานการบัญชี",
    summary: "",
    status: "published",
    publish_at: "",
    unpublish_at: "",
    content_revision: 0,
    unit_revision: 0
  },
  {
    content_id: "work-2",
    parent_content_id: "division-1",
    unit_kind: "work",
    sort_order: 1,
    slug: "work-2",
    title: "งานการเงิน",
    summary: "",
    status: "published",
    publish_at: "",
    unpublish_at: "",
    content_revision: 0,
    unit_revision: 0
  }
];
const positions = [
  {
    id: "position-1",
    unit_content_id: "work-1",
    title: "เจ้าหน้าที่ประจำงาน",
    group_label: "",
    group_sort_order: 0,
    sort_order: 0,
    display_style: "default",
    occupant_limit: 1,
    revision: 5
  },
  {
    id: "position-2",
    unit_content_id: "work-2",
    title: "เจ้าหน้าที่งานการเงิน",
    group_label: "",
    group_sort_order: 0,
    sort_order: 0,
    display_style: "default",
    occupant_limit: 2,
    revision: 3
  }
];
const assignment = {
  id: "assignment-1",
  personnel_id: "person-1",
  position_id: "position-1",
  duty_detail: "",
  sort_order: 0,
  enabled: 1,
  revision: 7
};
const person = { id: "person-1", display_name: "บุคลากรหนึ่งคน", active: 1, revision: 3 };

async function installTransferFixture(page: Page) {
  const requests: Array<{ path: string; body: unknown; method: string; revision: string | undefined }> = [];
  await installAuthenticatedDesignSystemCmsFixture(page);
  await page.route("**/api/admin-proxy*", async (route: Route) => {
    const request = route.request();
    const externalUrl = new URL(request.url());
    const proxyPath = externalUrl.searchParams.get("path") ?? "";
    const target = new URL(proxyPath, "https://example.invalid");
    if (target.pathname === "/api/admin/capabilities") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          role: "admin",
          capabilities: ["dashboard.read", "organization.read", "organization.manage", "users.read-self"]
        })
      });
      return;
    }
    if (!target.pathname.startsWith("/api/admin/organization/")) {
      await route.fallback();
      return;
    }
    const method = request.method();
    if (method === "PATCH") {
      requests.push({
        path: target.pathname,
        method,
        body: request.postDataJSON(),
        revision: request.headers()["x-rcat-expected-revision"]
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ item: { ...assignment, position_id: "position-2", revision: 8 } })
      });
      return;
    }
    const collection = target.pathname.split("/").pop() ?? "";
    const unitId = target.searchParams.get("unitContentId");
    const items =
      collection === "units"
        ? units
        : collection === "positions"
          ? unitId
            ? positions.filter((item) => item.unit_content_id === unitId)
            : positions
          : collection === "assignments"
            ? unitId === "work-1"
              ? [assignment]
              : []
            : collection === "personnel"
              ? unitId === "work-1"
                ? [person]
                : []
              : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items,
        total: items.length,
        nextOffset: null,
        maximumItems: 100,
        generatedAt: "2026-10-18T00:00:00.000Z"
      })
    });
  });
  await page.goto("/admin/organization/assignments");
  await page.getByRole("heading", { name: "มอบหมายหน้าที่" }).first().waitFor();
  await page.getByRole("treeitem", { name: /งานการบัญชี/ }).click();
  await expect(page.getByText("บุคลากรหนึ่งคน")).toBeVisible();
  return requests;
}

test("single-occupant drag opens transfer dialog and cancel does not write", async ({ page }) => {
  const requests = await installTransferFixture(page);
  const handle = page.getByRole("button", { name: "ลากจัดลำดับ บุคลากรหนึ่งคน", exact: true });
  const destination = page.getByLabel("วางบุคลากรเพื่อย้ายข้ามตำแหน่งหรือหน่วยงาน");
  await expect(handle).toBeVisible();
  await expect(handle).toBeEnabled();
  await expect(destination).toBeVisible();
  await handle.dragTo(destination, { steps: 15 });
  await expect(page.getByRole("dialog", { name: "ย้ายบุคลากรข้ามตำแหน่งหรือหน่วยงาน" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "ยกเลิก" }).click();
  await expect(page.getByRole("dialog", { name: "ย้ายบุคลากรข้ามตำแหน่งหรือหน่วยงาน" })).toHaveCount(0);
  expect(requests).toHaveLength(0);
});

test("assignment transfer chooser selects another work unit, requires confirmation and keeps revision", async ({
  page
}) => {
  const requests = await installTransferFixture(page);
  await test.step("open cross-unit destination dialog", async () => {
    await page.getByRole("button", { name: "ย้ายตำแหน่งหรือหน่วยงาน", exact: true }).click({ timeout: 8000 });
    await expect(page.getByRole("dialog", { name: "ย้ายบุคลากรข้ามตำแหน่งหรือหน่วยงาน" })).toBeVisible();
  });
  const dialog = page.getByRole("dialog", { name: "ย้ายบุคลากรข้ามตำแหน่งหรือหน่วยงาน" });
  await test.step("choose different organizational unit", async () => {
    await dialog.getByRole("combobox", { name: "หน่วยงานปลายทาง" }).click({ timeout: 8000 });
    await page.getByRole("option", { name: "งานการเงิน" }).click({ timeout: 8000 });
    await expect(dialog.getByRole("combobox", { name: "หน่วยงานปลายทาง" })).toContainText("งานการเงิน");
  });
  await test.step("choose an existing destination position", async () => {
    await expect(dialog.getByRole("combobox", { name: "ตำแหน่งปลายทาง" })).toBeEnabled();
    await dialog.getByRole("combobox", { name: "ตำแหน่งปลายทาง" }).click({ timeout: 8000 });
    await page.getByRole("option", { name: "เจ้าหน้าที่งานการเงิน" }).click({ timeout: 8000 });
    await expect(dialog.getByText(/ปลายทาง: งานการเงิน/)).toBeVisible();
    expect(requests).toHaveLength(0);
  });
  await test.step("open second confirmation without writing", async () => {
    await dialog.getByRole("button", { name: "ตรวจสอบและยืนยันการย้าย" }).click({ timeout: 8000 });
    await expect(page.getByText("ยืนยันย้ายการมอบหมาย?")).toBeVisible({ timeout: 8000 });
    expect(requests).toHaveLength(0);
  });
  await test.step("confirm and send exactly one revision-guarded transfer", async () => {
    await page.getByRole("button", { name: "ยืนยันย้าย", exact: true }).click({ timeout: 8000 });
    await expect.poll(() => requests.length, { timeout: 8000 }).toBe(1);
    expect(requests[0]).toMatchObject({
      method: "PATCH",
      path: "/api/admin/organization/assignments/assignment-1",
      revision: "7",
      body: { positionId: "position-2", autoSortOrder: true }
    });
  });
});
