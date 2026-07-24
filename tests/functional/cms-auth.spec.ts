import { expect, test, type Page, type Route } from "@playwright/test";

const csrfToken = "A".repeat(43);
const recoveryCodes = Array.from({ length: 10 }, (_, index) => `RECOVERY-${index + 1}`);

type LoginMode = "password" | "totp" | "enrollment";

interface CmsApiState {
  authenticated: boolean;
  loginMode: LoginMode;
  role: "admin" | "viewer";
  sessionHits: number;
  expireAdminOnce: boolean;
  stepUpOnce: boolean;
  mutationAttempts: number;
}

function safeUser(state: CmsApiState) {
  return {
    id: `${state.role}-functional`,
    email: `${state.role}@example.invalid`,
    name: state.role === "admin" ? "Functional Admin" : "Functional Viewer",
    username: state.role,
    role: state.role,
    isRoot: false,
    recentPasswordAuthentication: true,
    recentMfaAuthentication: state.loginMode !== "password"
  };
}

function roleCapabilities(state: CmsApiState) {
  if (state.role === "viewer") {
    return ["dashboard.read", "users.read-self", "auth.change-password-self"];
  }

  return [
    "dashboard.read",
    "content.read",
    "content.publish",
    "users.read-self",
    "users.read-all",
    "auth.change-password-self",
    "auth.reauthenticate-self",
    "auth.mfa.manage-self"
  ];
}

function dashboardSummary() {
  return {
    counts: { content: { total: 1, published: 0, draft: 0, review: 1, scheduled: 0 } },
    publishableCount: 1,
    metrics: [],
    content: [],
    recentContent: [],
    documents: [],
    recentDocuments: [],
    events: [],
    recentEvents: [],
    generatedAt: "2026-07-24T00:00:00.000Z"
  };
}

async function json(route: Route, payload: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  });
}

async function installCmsApi(page: Page, overrides: Partial<CmsApiState> = {}) {
  const state: CmsApiState = {
    authenticated: false,
    loginMode: "password",
    role: "admin",
    sessionHits: 0,
    expireAdminOnce: false,
    stepUpOnce: false,
    mutationAttempts: 0,
    ...overrides
  };

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
    const path = url.pathname;

    if (path === "/api/cms-auth/session") {
      state.sessionHits += 1;
      if (!state.authenticated) {
        await json(route, { error: "CMS session is invalid or expired" }, 401);
        return;
      }
      await json(route, { user: safeUser(state) });
      return;
    }

    if (path === "/api/cms-auth/login") {
      if (state.loginMode === "password") {
        state.authenticated = true;
        await json(route, { ok: true, user: safeUser(state) });
      } else {
        await json(route, {
          mfaRequired: true,
          enrollmentRequired: state.loginMode === "enrollment"
        });
      }
      return;
    }

    if (path === "/api/cms-auth/mfa/verify") {
      state.authenticated = true;
      await json(route, { ok: true, user: safeUser(state) });
      return;
    }

    if (path === "/api/cms-auth/mfa/setup/start") {
      await json(route, {
        manualEntryKey: "JBSWY3DPEHPK3PXP",
        otpAuthUri: "otpauth://totp/RCAT:functional?secret=JBSWY3DPEHPK3PXP&issuer=RCAT",
        expiresAt: "2026-07-24T01:00:00.000Z"
      });
      return;
    }

    if (path === "/api/cms-auth/mfa/setup/confirm") {
      state.authenticated = true;
      await json(route, { recoveryCodes, loginRequired: false });
      return;
    }

    if (path === "/api/cms-auth/reauthenticate") {
      await json(route, {
        ok: true,
        reauthenticated: true,
        recentPasswordAuthentication: true,
        recentMfaAuthentication: false
      });
      return;
    }

    if (path === "/api/cms-auth/logout") {
      state.authenticated = false;
      await route.fulfill({ status: 204 });
      return;
    }

    if (path === "/api/cms-auth/invitation/inspect") {
      await json(route, {
        valid: true,
        user: {
          email: "invitee@example.invalid",
          name: "Invited User",
          role: "viewer",
          username: null
        },
        expiresAt: "2026-07-25T00:00:00.000Z"
      });
      return;
    }

    if (path === "/api/cms-auth/invitation/accept") {
      await json(route, { ok: true, accepted: true });
      return;
    }

    if (path === "/api/cms-auth/password-reset/inspect") {
      await json(route, {
        valid: true,
        user: { emailHint: "f***@example.invalid" },
        expiresAt: "2026-07-25T00:00:00.000Z"
      });
      return;
    }

    if (path === "/api/cms-auth/password-reset/complete") {
      await json(route, { ok: true, passwordReset: true });
      return;
    }

    if (path === "/api/admin-proxy") {
      const adminPath = url.searchParams.get("path");

      if (adminPath === "/api/admin/capabilities") {
        await json(route, { role: state.role, capabilities: roleCapabilities(state) });
        return;
      }

      if (state.expireAdminOnce) {
        state.expireAdminOnce = false;
        state.authenticated = false;
        await json(route, { error: "CMS session is invalid or expired" }, 401);
        return;
      }

      if (adminPath === "/api/admin/dashboard-summary") {
        await json(route, dashboardSummary());
        return;
      }

      if (adminPath === "/api/admin/content/publish-pending") {
        state.mutationAttempts += 1;
        if (state.stepUpOnce && state.mutationAttempts === 1) {
          await json(route, { error: "reauthentication required", assurance: "password" }, 428);
          return;
        }
        await json(route, { publishedCount: 1 });
        return;
      }
    }

    await json(route, { items: [], pagination: { page: 1, pageSize: 25, totalItems: 0 } });
  });

  return state;
}

async function submitPasswordLogin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("อีเมลหรือชื่อผู้ใช้").fill("functional-admin");
  await page.getByLabel(/^รหัสผ่าน/).fill("synthetic-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
}

test.describe("CMS auth intercepted functional flows", () => {
  test("CMS auth unauthenticated /admin redirects after bootstrap", async ({ page }) => {
    await installCmsApi(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "เข้าสู่ระบบ" })).toBeVisible();
  });

  test("CMS auth password-only Login reaches Dashboard", async ({ page }) => {
    await installCmsApi(page);
    await submitPasswordLogin(page);
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();
  });

  test("CMS auth password plus TOTP reaches Dashboard", async ({ page }) => {
    await installCmsApi(page, { loginMode: "totp" });
    await submitPasswordLogin(page);
    await page.getByLabel("รหัส 6 หลัก").fill("123456");
    await page.getByRole("button", { name: "ยืนยันและเข้าสู่ระบบ" }).click();
    await expect(page).toHaveURL(/\/admin\/?$/);
  });

  test("CMS auth mandatory enrollment reaches Recovery Code screen", async ({ page }) => {
    await installCmsApi(page, { loginMode: "enrollment" });
    await submitPasswordLogin(page);
    await expect(page.getByLabel(/คีย์สำหรับกรอกด้วยตนเอง/)).toHaveValue("JBSWY3DPEHPK3PXP");
    await page.getByLabel(/รหัสจากแอป 6 หลัก/).fill("123456");
    await page.getByRole("button", { name: "ยืนยันการตั้งค่า" }).click();
    await expect(page.getByText("RECOVERY-10")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("CMS auth Recovery Code acknowledgement enters Dashboard", async ({ page }) => {
    await installCmsApi(page, { loginMode: "enrollment" });
    await submitPasswordLogin(page);
    await page.getByLabel(/รหัสจากแอป 6 หลัก/).fill("123456");
    await page.getByRole("button", { name: "ยืนยันการตั้งค่า" }).click();
    await page.getByLabel(/ฉันได้เก็บรหัสกู้คืนไว้แล้ว/).check();
    await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
    await expect(page).toHaveURL(/\/admin\/?$/);
  });

  test("CMS auth refresh restores Session from the server", async ({ page }) => {
    const state = await installCmsApi(page, { authenticated: true });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();
    expect(state.sessionHits).toBeGreaterThanOrEqual(2);
  });

  test("CMS auth expired Session returns to Login", async ({ page }) => {
    await installCmsApi(page, { authenticated: true, expireAdminOnce: true });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/เซสชัน CMS หมดอายุ/)).toBeVisible();
  });

  test("CMS auth 428 opens reauthentication and retries the mutation once", async ({ page }) => {
    const state = await installCmsApi(page, { authenticated: true, stepUpOnce: true });
    await page.goto("/admin");
    await page.getByRole("button", { name: "เผยแพร่คิว" }).click();
    await page.getByRole("button", { name: "เผยแพร่", exact: true }).click();
    await page.getByLabel("รหัสผ่านปัจจุบัน").fill("synthetic-password");
    await page.getByRole("button", { name: "ยืนยัน" }).click();
    await expect.poll(() => state.mutationAttempts).toBe(2);
  });

  test("CMS auth Logout clears protected UI", async ({ page }) => {
    await installCmsApi(page, { authenticated: true });
    await page.goto("/admin");
    await page.getByRole("button", { name: "ออกจากระบบ" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).not.toBeVisible();
  });

  test("CMS auth activation never adds its token to the browser URL", async ({ page }) => {
    await installCmsApi(page);
    await page.goto("/activate-account");
    await page.getByLabel("โทเค็นเชิญ").fill("INVITATION-TOKEN-FIXTURE");
    await page.getByRole("button", { name: "ตรวจสอบโทเค็น" }).click();
    await expect(page.getByText("Invited User")).toBeVisible();
    await expect(page).toHaveURL("http://127.0.0.1:5173/activate-account");
    expect(page.url()).not.toContain("INVITATION-TOKEN-FIXTURE");
  });

  test("CMS auth password reset never adds its token to the browser URL", async ({ page }) => {
    await installCmsApi(page);
    await page.goto("/reset-password");
    await page.getByLabel("โทเค็นตั้งรหัสผ่านใหม่").fill("RESET-TOKEN-FIXTURE");
    await page.getByRole("button", { name: "ตรวจสอบโทเค็น" }).click();
    await expect(page.getByText(/f\*\*\*@example\.invalid/)).toBeVisible();
    await expect(page).toHaveURL("http://127.0.0.1:5173/reset-password");
    expect(page.url()).not.toContain("RESET-TOKEN-FIXTURE");
  });

  test("CMS auth Viewer navigation hides all-users management", async ({ page }) => {
    await installCmsApi(page, { authenticated: true, role: "viewer" });
    await page.goto("/admin");
    await expect(page.getByText("ผู้ใช้และสิทธิ์การเข้าถึง")).not.toBeVisible();
  });

  test("CMS auth direct unauthorized route shows access denied", async ({ page }) => {
    await installCmsApi(page, { authenticated: true, role: "viewer" });
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "ไม่มีสิทธิ์เข้าถึง" })).toBeVisible();
  });
});
