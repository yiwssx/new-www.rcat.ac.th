import { expect, test } from "@playwright/test";
import { installPublicAuthIsolationFixture } from "./fixtures/publicAuthIsolationFixture";

test.describe("Public cookie consent", () => {
  test("blocks all optional telemetry by default and after rejection, then respects acceptance and withdrawal", async ({
    page
  }) => {
    const seenThirdPartyRequests: string[] = [];
    page.on("request", (request) => {
      if (/googletagmanager\.com|vercel-scripts\.com|\/_vercel\//.test(request.url())) {
        seenThirdPartyRequests.push(request.url());
      }
    });

    await page.route("https://www.googletagmanager.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
    );
    await page.route("https://va.vercel-scripts.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "application/javascript", body: "" })
    );
    await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204, body: "" }));

    const fixture = await installPublicAuthIsolationFixture(page, { consent: "unset" });
    const countTelemetry = () =>
      fixture.requests.filter(
        (request) =>
          request.method === "POST" &&
          (request.pathname === "/api/public/site-view" || request.pathname === "/api/public/presence")
      ).length;

    await page.goto("/news");
    await expect(page.getByRole("region", { name: "แจ้งการใช้คุกกี้" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ข่าว", exact: true })).toBeVisible();
    expect(countTelemetry()).toBe(0);
    expect(seenThirdPartyRequests).toHaveLength(0);
    expect(await page.evaluate(() => window.localStorage.getItem("rcat.site.visitor.id"))).toBeNull();

    await page.getByRole("button", { name: "ปฏิเสธคุกกี้ที่ไม่จำเป็น" }).click();
    await expect(page.getByRole("region", { name: "แจ้งการใช้คุกกี้" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "ข่าว", exact: true })).toBeVisible();
    expect(countTelemetry()).toBe(0);
    expect(seenThirdPartyRequests).toHaveLength(0);

    await page.getByRole("button", { name: "ตั้งค่าคุกกี้" }).click();
    const dialog = page.getByRole("dialog", { name: "ตั้งค่าความเป็นส่วนตัวและคุกกี้" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "ยอมรับทั้งหมด" }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(countTelemetry).toBeGreaterThan(0);
    await expect.poll(() => seenThirdPartyRequests.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "ตั้งค่าคุกกี้" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "ปฏิเสธ", exact: true }).click();
    await expect(page.getByRole("heading", { name: "ข่าว", exact: true })).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(window.localStorage.getItem("rcat.cookie.consent.v1") || "{}"));
    expect(stored).toMatchObject({ version: 1, analytics: false });
    expect(await page.evaluate(() => window.localStorage.getItem("rcat.site.visitor.id"))).toBeNull();

    const previousCount = countTelemetry();
    const previousExternalCount = seenThirdPartyRequests.length;
    await page.goto("/announcements");
    await expect(page.getByRole("heading", { name: "ประกาศ", exact: true })).toBeVisible();
    expect(countTelemetry()).toBe(previousCount);
    expect(seenThirdPartyRequests).toHaveLength(previousExternalCount);
  });

  test("keeps cookie-policy and privacy-policy pages accessible without consenting", async ({ page }) => {
    await installPublicAuthIsolationFixture(page, { consent: "unset" });
    for (const [path, heading] of [
      ["/privacy-policy", /ประกาศเกี่ยวกับความเป็นส่วนตัว/],
      ["/cookie-policy", /นโยบายการใช้คุกกี้/]
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      await expect(page.getByRole("region", { name: "แจ้งการใช้คุกกี้" })).toBeVisible();
    }
  });

  test("keeps the cookie notice and its controls inside narrow mobile viewports", async ({ page }) => {
    await installPublicAuthIsolationFixture(page, { consent: "unset" });
    await page.goto("/news");

    const notice = page.getByRole("region", { name: "แจ้งการใช้คุกกี้" });

    for (const width of [320, 360, 412, 430]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(notice).toBeVisible();

      const geometry = await notice.evaluate((element) => {
        const paper = element.querySelector(".MuiPaper-root");
        if (!paper) throw new Error("Cookie notice panel is missing");

        const viewport = document.documentElement.clientWidth;
        const noticeRect = element.getBoundingClientRect();
        const paperRect = paper.getBoundingClientRect();

        return {
          viewport,
          documentWidth: document.documentElement.scrollWidth,
          noticeRight: noticeRect.right,
          paperLeft: paperRect.left,
          paperRight: paperRect.right
        };
      });

      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport + 1);
      expect(geometry.noticeRight).toBeLessThanOrEqual(geometry.viewport + 1);
      expect(geometry.paperLeft).toBeGreaterThanOrEqual(-1);
      expect(geometry.paperRight).toBeLessThanOrEqual(geometry.viewport + 1);
    }
  });

  test("renders formal legal notices as one readable document on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await installPublicAuthIsolationFixture(page, { consent: "rejected" });

    for (const [path, title] of [
      ["/privacy-policy", "ประกาศเกี่ยวกับความเป็นส่วนตัวในการใช้เว็บไซต์"],
      ["/cookie-policy", "นโยบายการใช้คุกกี้"]
    ] as const) {
      await page.goto(path);

      const article = page.locator('article[aria-labelledby="legal-notice-title"]');
      await expect(article).toBeVisible();
      await expect(article.getByRole("heading", { level: 1, name: title, exact: true })).toHaveCount(1);
      await expect(article.getByRole("navigation", { name: "สารบัญประกาศ" })).toBeVisible();
      await expect(article.getByRole("heading", { level: 2 })).toHaveCount(5);
      await expect(article.locator(".MuiCard-root")).toHaveCount(0);

      await article
        .getByRole("link", { name: /การติดต่อและการเปลี่ยนแปลงนโยบาย|สิทธิของเจ้าของข้อมูลและช่องทางติดต่อ/ })
        .click();
      await expect(article.getByRole("heading", { level: 2 }).last()).toBeInViewport();

      const noDocumentOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      );
      expect(noDocumentOverflow, "policy document must fit mobile viewport").toBe(true);
    }

    await expect(page.getByRole("table", { name: "ประเภทคุกกี้และการให้ความยินยอม" })).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "ติดต่อวิทยาลัย" })).toHaveAttribute("href", "/contact");
  });
});
