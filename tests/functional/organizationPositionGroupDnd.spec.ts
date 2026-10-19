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
  }
];
const positions = [
  {
    id: "pos-a",
    unit_content_id: "work-1",
    title: "หัวหน้างาน",
    group_label: "หัวหน้า",
    group_sort_order: 0,
    sort_order: 0,
    display_style: "default",
    occupant_limit: 1,
    revision: 3
  },
  {
    id: "pos-b",
    unit_content_id: "work-1",
    title: "เจ้าหน้าที่การบัญชี",
    group_label: "เจ้าหน้าที่",
    group_sort_order: 1,
    sort_order: 0,
    display_style: "default",
    occupant_limit: 2,
    revision: 4
  },
  {
    id: "pos-c",
    unit_content_id: "work-1",
    title: "ผู้ช่วยเจ้าหน้าที่",
    group_label: "เจ้าหน้าที่",
    group_sort_order: 1,
    sort_order: 1,
    display_style: "default",
    occupant_limit: 2,
    revision: 5
  }
];

async function installGroupedPositionFixture(page: Page) {
  const writes: unknown[] = [];
  await installAuthenticatedDesignSystemCmsFixture(page);
  await page.route("**/api/admin-proxy*", async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).searchParams.get("path") ?? "";
    const endpoint = new URL(path, "https://example.invalid");
    if (endpoint.pathname === "/api/admin/capabilities") {
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
    if (!endpoint.pathname.startsWith("/api/admin/organization/")) {
      await route.fallback();
      return;
    }
    if (request.method() === "POST" && endpoint.pathname.endsWith("/reorder")) {
      writes.push(request.postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reordered: true, count: positions.length })
      });
      return;
    }
    const collection = endpoint.pathname.split("/").pop();
    const unitId = endpoint.searchParams.get("unitContentId");
    const items =
      collection === "units"
        ? units
        : collection === "positions"
          ? unitId
            ? positions.filter((position) => position.unit_content_id === unitId)
            : positions
          : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items, total: items.length, nextOffset: null, maximumItems: 100, generatedAt: "" })
    });
  });
  await page.goto("/admin/organization/positions");
  await page.getByRole("treeitem", { name: /งานการบัญชี/ }).click();
  await expect(page.getByText("ตำแหน่งใน งานการบัญชี")).toBeVisible();
  return writes;
}

test("a single-position group can be dragged to another group, reviewed and canceled without writes", async ({
  page
}) => {
  const writes = await installGroupedPositionFixture(page);
  const source = page.getByRole("button", { name: "ลากจัดลำดับ หัวหน้างาน", exact: true });
  await expect(source).toBeEnabled();
  const target = page.getByLabel("วางตำแหน่งในกลุ่ม เจ้าหน้าที่");
  await expect(target).toBeVisible();
  await source.dragTo(target, { steps: 16 });
  const dialog = page.getByRole("dialog", { name: "ย้ายตำแหน่งข้ามกลุ่ม" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("หัวหน้างาน")).toBeVisible();
  await dialog.getByRole("button", { name: "ยกเลิก" }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test("explicit cross-group move saves complete source and target layout atomically", async ({ page }) => {
  const writes = await installGroupedPositionFixture(page);
  await page.getByRole("button", { name: "ย้ายตำแหน่งข้ามกลุ่ม", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "ย้ายตำแหน่งข้ามกลุ่ม" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("กลุ่มเดิม: หัวหน้า")).toBeVisible();
  await dialog.getByRole("button", { name: "ยืนยันย้ายตำแหน่ง" }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    collection: "position-layout",
    scopeId: "work-1",
    groups: [
      {
        label: "เจ้าหน้าที่",
        items: [
          { id: "pos-b", revision: 4 },
          { id: "pos-c", revision: 5 },
          { id: "pos-a", revision: 3 }
        ]
      }
    ]
  });
});

test("group order can be changed by keyboard-accessible controls", async ({ page }) => {
  const writes = await installGroupedPositionFixture(page);
  await page.getByRole("button", { name: "เลื่อนกลุ่มลง", exact: true }).first().click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    collection: "position-layout",
    scopeId: "work-1",
    groups: [
      { label: "เจ้าหน้าที่", items: [{ id: "pos-b" }, { id: "pos-c" }] },
      { label: "หัวหน้า", items: [{ id: "pos-a" }] }
    ]
  });
});
