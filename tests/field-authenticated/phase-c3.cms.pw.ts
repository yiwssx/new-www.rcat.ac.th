import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

function requireFieldValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Phase C3 field verification.`);
  }
  return value;
}

async function confirmSwal(page: Page, title: string, button: string) {
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: button, exact: true }).last().click();
}

async function findContentRow(page: Page, title: string): Promise<Locator> {
  const search = page.getByPlaceholder("ค้นหาเนื้อหา");
  await search.fill(title);
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toHaveCount(1);
  return row;
}

async function getPublicContent(request: APIRequestContext, slug: string) {
  const response = await request.get(`/api/public/content/${encodeURIComponent(slug)}`, {
    failOnStatusCode: false,
    headers: { "Cache-Control": "no-cache" }
  });

  if (!response.ok()) {
    return { status: response.status(), item: null };
  }

  const payload = (await response.json()) as {
    item?: { slug?: string; title?: string } | null;
  };
  return { status: response.status(), item: payload.item ?? null };
}

test.describe("Phase C3 authenticated disposable CMS field", () => {
  test("isolated editor proves save fallback, publish, public read, delete, and browser-session cleanup", async ({
    page,
    request
  }) => {
    const username = requireFieldValue("PHASE_C3_QA_USERNAME");
    const password = requireFieldValue("PHASE_C3_QA_PASSWORD");
    const slug = requireFieldValue("PHASE_C3_CONTENT_SLUG");
    const title = requireFieldValue("PHASE_C3_CONTENT_TITLE");
    const facebookUrl = requireFieldValue("PHASE_C3_FACEBOOK_URL");

    await page.goto("/login");
    await page.getByLabel("อีเมลหรือชื่อผู้ใช้").fill(username);
    await page.getByLabel("รหัสผ่าน").fill(password);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/admin" || url.pathname.startsWith("/admin/")),
      page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click()
    ]);

    await page.goto("/admin/content");
    await expect(page.getByRole("heading", { name: "เนื้อหา", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "เพิ่มเนื้อหา", exact: true }).click();

    const editor = page.getByRole("dialog");
    await expect(editor.getByRole("heading", { name: /^เพิ่มเนื้อหาใหม่(?:\s|$)/ })).toBeVisible();
    await editor.getByRole("textbox", { name: "ชื่อเรื่อง" }).fill(title);
    await editor.getByRole("textbox", { name: "slug ลิงก์ถาวร" }).fill(slug);
    await editor.getByRole("textbox", { name: "ผู้รับผิดชอบ" }).fill("Phase C3 Disposable QA");
    await editor
      .getByRole("textbox", { name: "สรุปย่อ" })
      .fill("Disposable authenticated field verification; safe to delete.");
    await editor.getByLabel("เทมเพลต").click();
    await page.getByRole("option", { name: "Facebook Embed", exact: true }).click();
    await editor.getByRole("textbox", { name: "URL หลัก" }).fill(facebookUrl);
    await editor.getByRole("button", { name: "ดำเนินการต่อ", exact: true }).click();

    await expect(editor.getByRole("heading", { name: "สร้างเนื้อหา?", exact: true })).toBeVisible();
    await editor.getByRole("button", { name: "สร้าง", exact: true }).click();

    await confirmSwal(page, "บันทึกเนื้อหาสำเร็จ แต่ยังไม่มี Thumbnail", "ตกลง");

    let row = await findContentRow(page, title);
    await row.getByRole("button", { name: "เผยแพร่", exact: true }).click();
    await confirmSwal(page, "เผยแพร่เนื้อหา?", "เผยแพร่");
    await confirmSwal(page, "เผยแพร่เนื้อหาสำเร็จ", "ตกลง");

    await expect
      .poll(async () => getPublicContent(request, slug), {
        message: "published disposable content becomes readable through the public API",
        timeout: 20_000
      })
      .toMatchObject({ status: 200, item: { slug, title } });

    const publicResponse = await page.goto(`/content/${encodeURIComponent(slug)}`);
    expect(publicResponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();

    await page.goto("/admin/content");
    row = await findContentRow(page, title);
    await row.getByRole("button", { name: "ลบ", exact: true }).click();
    await confirmSwal(page, "ลบเนื้อหา?", "ลบ");
    await confirmSwal(page, "ลบเนื้อหาสำเร็จ", "ตกลง");

    await expect
      .poll(async () => (await getPublicContent(request, slug)).status, {
        message: "deleted disposable content is removed from the public API",
        timeout: 20_000
      })
      .toBe(404);

    await page.context().clearCookies();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);

    console.info(`[Phase C3] authenticated disposable CMS flow passed for slug ${slug}`);
  });
});
