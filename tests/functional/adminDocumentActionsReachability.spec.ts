import { expect, test, type Page } from "@playwright/test";
import { installAuthenticatedDesignSystemCmsFixture } from "./fixtures/designSystemCmsFixture";

const documentTitle = "คู่มือนักศึกษา";

async function openDocumentAdmin(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await installAuthenticatedDesignSystemCmsFixture(page);

  // Override only Document list responses; preserve the authenticated fixture's other endpoints.
  await page.route("**/api/admin-proxy?**", async (route) => {
    const url = new URL(route.request().url());
    const adminPath = url.searchParams.get("path") ?? "";
    if (!adminPath.startsWith("/api/admin/documents")) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "responsive-document",
            title: documentTitle,
            description: "เอกสารทดสอบการเข้าถึง",
            category: "คู่มือ",
            fileName: "guide.pdf",
            fileUrl: "https://files.example.invalid/guide.pdf",
            mediaId: "",
            publishedAt: "2026-08-01T00:00:00.000Z",
            status: "published",
            pinned: false,
            order: 1,
            revision: 1,
            updatedAt: "2026-08-01T00:00:00.000Z"
          }
        ],
        pagination: {
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          hasPreviousPage: false,
          hasNextPage: false
        }
      })
    });
  });

  await page.goto("/admin/documents");
  await page.getByText(documentTitle).first().waitFor();
}

for (const viewport of [
  { name: "narrow-mobile", width: 320, height: 640 },
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 }
] as const) {
  test(`${viewport.name} Admin Document actions remain reachable at default zoom`, async ({ page }) => {
    await openDocumentAdmin(page, viewport);

    const tableScroll = page.locator(".table-scroll");
    const fileLink = page.getByRole("link", { name: `เปิดไฟล์ ${documentTitle}` });
    const editAction = page.getByRole("button", { name: "แก้ไข" }).first();
    const deleteAction = page.getByRole("button", { name: "ลบ" }).first();

    await fileLink.scrollIntoViewIfNeeded();
    await expect(fileLink).toBeInViewport();
    await editAction.scrollIntoViewIfNeeded();
    await expect(editAction).toBeInViewport();
    await deleteAction.scrollIntoViewIfNeeded();
    await expect(deleteAction).toBeInViewport();
    await editAction.focus();
    await expect(editAction).toBeFocused();

    const bounds = await tableScroll.boundingBox();
    const actionBounds = await deleteAction.boundingBox();
    expect(bounds).not.toBeNull();
    expect(actionBounds).not.toBeNull();
    expect(actionBounds!.x).toBeGreaterThanOrEqual(bounds!.x - 1);
    expect(actionBounds!.x + actionBounds!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    ).toBeLessThanOrEqual(1);
  });
}
