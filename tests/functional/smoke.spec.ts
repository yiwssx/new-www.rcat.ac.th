import { expect, test } from "@playwright/test";

test("public home route renders", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /RCAT/i })).toBeVisible();
});

test("admin route redirects to login for unauthenticated users", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
