import type { Page, Route } from "@playwright/test";

const csrfToken = "D".repeat(43);
const generatedAt = "2026-07-28T00:00:00.000Z";
const contentItems = [
  {
    id: "content-table-readability",
    title: "ประกาศวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ดเรื่องกำหนดการรับสมัครนักเรียนและนักศึกษาประจำปีการศึกษาใหม่",
    slug: "content-table-readability",
    type: "news",
    status: "draft",
    owner: "งานประชาสัมพันธ์และสื่อสารองค์กร",
    summary: "รายละเอียดกำหนดการรับสมัคร เอกสารประกอบ และขั้นตอนการยืนยันสิทธิ์สำหรับนักเรียน นักศึกษา และผู้ปกครอง",
    category: "ข่าวประชาสัมพันธ์",
    template: "standard",
    canonicalUrl: "",
    featured: false,
    featuredMediaId: "",
    viewCount: 0,
    lastViewedAt: "",
    updatedAt: generatedAt,
    publishAt: "",
    revision: 1
  }
];

const capabilities = [
  "dashboard.read",
  "content.read",
  "content.create",
  "content.update",
  "content.delete",
  "content.publish",
  "documents.read",
  "documents.create",
  "documents.update",
  "documents.delete",
  "documents.publish",
  "media.read",
  "media.manage",
  "events.read",
  "events.manage",
  "carousel.read",
  "carousel.manage",
  "external-services.read",
  "external-services.manage",
  "menu.read",
  "menu.manage",
  "settings.read",
  "settings.manage",
  "home-sections.read",
  "home-sections.manage",
  "visitor-stats.read",
  "visitor-stats.manage",
  "users.read-self",
  "users.read-all",
  "users.create",
  "users.update-self",
  "users.update-any",
  "users.delete",
  "users.invite",
  "users.reset-password",
  "users.revoke-sessions",
  "users.mfa.require",
  "users.mfa.reset",
  "backup.counts",
  "backup.download",
  "auth.change-password-self",
  "auth.reauthenticate-self",
  "auth.mfa.manage-self",
  "public-contracts.read"
];

async function fulfillJson(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  });
}

function paginatedEmpty(pageSize = 25) {
  return {
    items: [],
    pagination: {
      page: 1,
      pageSize,
      totalItems: 0,
      totalPages: 0
    }
  };
}

export async function installUnauthenticatedCmsFixture(page: Page) {
  const publicRequests: string[] = [];

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/public/")) {
      publicRequests.push(url.pathname);
    }

    if (url.pathname === "/api/cms-auth/session") {
      await fulfillJson(route, { error: "CMS session is invalid or expired" }, 401);
      return;
    }

    await fulfillJson(route, { error: "Not available in unauthenticated design fixture" }, 401);
  });

  return { publicRequests };
}

export async function installAuthenticatedDesignSystemCmsFixture(page: Page) {
  const requests: string[] = [];

  await page.addInitScript((token) => {
    Object.defineProperty(Document.prototype, "cookie", {
      configurable: true,
      get: () => `__Host-rcat_cms_csrf=${token}`,
      set: () => undefined
    });
  }, csrfToken);

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}${url.search}`);

    if (url.pathname === "/api/cms-auth/session") {
      await fulfillJson(route, {
        user: {
          id: "design-system-admin",
          email: "design-system@example.invalid",
          name: "Design System Admin",
          username: "design-system",
          role: "admin",
          isRoot: false,
          recentPasswordAuthentication: true,
          recentMfaAuthentication: true
        }
      });
      return;
    }

    if (url.pathname === "/api/admin-proxy") {
      const adminPath = url.searchParams.get("path") ?? "";

      if (adminPath === "/api/admin/capabilities") {
        await fulfillJson(route, { role: "admin", capabilities });
        return;
      }

      if (adminPath === "/api/admin/dashboard-summary") {
        await fulfillJson(route, {
          counts: {
            content: { total: 4, published: 2, draft: 1, review: 1, scheduled: 0 },
            documents: { total: 2, published: 2, draft: 0 },
            events: { total: 2, upcoming: 1, ongoing: 1, ended: 0 }
          },
          publishableCount: 2,
          metrics: [],
          content: [],
          recentContent: [],
          documents: [],
          recentDocuments: [],
          events: [],
          recentEvents: [],
          generatedAt
        });
        return;
      }

      if (adminPath === "/api/admin/visitor-stats/summary") {
        await fulfillJson(route, {
          total: 100,
          uniqueVisitors: 50,
          onlineUsers: 2,
          generatedAt
        });
        return;
      }

      if (adminPath.startsWith("/api/admin/media")) {
        await fulfillJson(route, paginatedEmpty(24));
        return;
      }

      if (adminPath.startsWith("/api/admin/content")) {
        await fulfillJson(route, {
          items: contentItems,
          pagination: {
            page: 1,
            pageSize: 25,
            totalItems: contentItems.length,
            totalPages: 1
          }
        });
        return;
      }

      if (
        adminPath.startsWith("/api/admin/users") ||
        adminPath.startsWith("/api/admin/documents") ||
        adminPath.startsWith("/api/admin/events")
      ) {
        await fulfillJson(route, paginatedEmpty());
        return;
      }

      await fulfillJson(route, paginatedEmpty());
      return;
    }

    if (url.pathname === "/api/apps-script-proxy") {
      await fulfillJson(route, {
        mode: "server-proxy",
        appsScriptBridge: "connected",
        driveStorage: "connected"
      });
      return;
    }

    await fulfillJson(route, { items: [] });
  });

  return { requests };
}
