import { expect, test } from "@playwright/test";
import projectSettings from "../../src/config/project-settings.json" with { type: "json" };

test("public home route renders", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: projectSettings.site.name })).toBeVisible();
});

test("admin route redirects to login for unauthenticated users", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("button", { name: /เข้าสู่ระบบ/ })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
