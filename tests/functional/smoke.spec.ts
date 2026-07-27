import { expect, test } from "@playwright/test";
import { installPublicHomeFixture, PUBLIC_HOME_FIXTURE_SITE_NAME } from "./fixtures/publicHomeCarouselFixture";

test("public home route renders", async ({ page }) => {
  await installPublicHomeFixture(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: PUBLIC_HOME_FIXTURE_SITE_NAME
    })
  ).toBeVisible();
  await expect(page.locator('[data-public-home-carousel="true"]')).toBeVisible();
});

test("admin route redirects to login for unauthenticated users", async ({ page }) => {
  await page.route("**/api/cms-auth/session", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "CMS session is invalid or expired" })
    });
  });
  await page.route("**/api/admin-proxy?*", async (route) => {
    const adminPath = new URL(route.request().url()).searchParams.get("path");

    if (adminPath === "/api/admin/capabilities") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ role: "viewer", capabilities: [] })
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Not found" })
    });
  });

  await page.goto("/admin");

  await expect(
    page.getByRole("button", {
      name: /เข้าสู่ระบบ/
    })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
