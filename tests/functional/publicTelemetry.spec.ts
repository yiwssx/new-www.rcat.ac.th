import { expect, test, type Page } from "@playwright/test";
import {
  installPublicAuthIsolationFixture,
  PUBLIC_AUTH_FIXTURE_CONTENT_SLUG,
  PUBLIC_AUTH_FIXTURE_CONTENT_TITLE,
  PUBLIC_AUTH_FIXTURE_GENERATED_AT,
  PUBLIC_AUTH_FIXTURE_NEWS_TITLE,
  PUBLIC_AUTH_FIXTURE_SITE_NAME,
  type PublicAuthIsolationFixture
} from "./fixtures/publicAuthIsolationFixture";

interface TelemetryNetworkLedger {
  googleTagManager: string[];
  googleGtag: string[];
  vercelAnalytics: string[];
  vercelSpeedInsights: string[];
  lazyPublicTelemetry: string[];
}

interface GooglePageView {
  transport: "gtm" | "gtag";
  page_path?: string;
  page_location?: string;
  page_title?: string;
}

function countPublicRequests(fixture: PublicAuthIsolationFixture, pathname: string, method?: string) {
  return fixture.requests.filter(
    (request) => request.pathname === pathname && (method === undefined || request.method === method)
  ).length;
}

async function installTelemetryNetworkMocks(page: Page) {
  const ledger: TelemetryNetworkLedger = {
    googleTagManager: [],
    googleGtag: [],
    vercelAnalytics: [],
    vercelSpeedInsights: [],
    lazyPublicTelemetry: []
  };

  page.on("request", (request) => {
    const url = new URL(request.url());

    if (url.hostname === "www.googletagmanager.com") {
      if (url.pathname === "/gtm.js") {
        ledger.googleTagManager.push(request.url());
      }

      if (url.pathname === "/gtag/js") {
        ledger.googleGtag.push(request.url());
      }
    }

    if (url.hostname === "va.vercel-scripts.com" || url.pathname.startsWith("/_vercel/")) {
      if (url.pathname.includes("/speed-insights/")) {
        ledger.vercelSpeedInsights.push(request.url());
      } else if (url.pathname.includes("/insights/") || url.pathname.includes("/v1/script")) {
        ledger.vercelAnalytics.push(request.url());
      }
    }

    if (url.pathname === "/src/shared/telemetry/PublicTelemetry.tsx") {
      ledger.lazyPublicTelemetry.push(request.url());
    }
  });

  await page.route("https://www.googletagmanager.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: ""
    });
  });
  await page.route("https://va.vercel-scripts.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: ""
    });
  });
  await page.route("**/_vercel/**", async (route) => {
    await route.fulfill({
      status: 204,
      body: ""
    });
  });

  return ledger;
}

async function getGooglePageViews(page: Page) {
  return (await page.evaluate(() => {
    const analyticsWindow = window as Window & {
      dataLayer?: unknown[];
    };
    const pageViews: Array<Record<string, unknown>> = [];

    for (const entry of analyticsWindow.dataLayer ?? []) {
      if (Array.isArray(entry) && entry[0] === "event" && entry[1] === "page_view") {
        const fields = entry[2] !== null && typeof entry[2] === "object" && !Array.isArray(entry[2]) ? entry[2] : {};
        pageViews.push({
          transport: "gtag",
          ...fields
        });
      } else if (
        entry !== null &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        "event" in entry &&
        entry.event === "page_view"
      ) {
        pageViews.push({
          transport: "gtm",
          ...entry
        });
      }
    }

    return pageViews;
  })) as GooglePageView[];
}

async function installDeterministicVisibility(page: Page) {
  await page.addInitScript(() => {
    const visibilityWindow = window as Window & {
      __rcatFunctionalVisibility?: DocumentVisibilityState;
    };

    visibilityWindow.__rcatFunctionalVisibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityWindow.__rcatFunctionalVisibility
    });
  });
}

async function dispatchVisibilityAndFocus(page: Page, visibilityState: DocumentVisibilityState, includeFocus = true) {
  await page.evaluate(
    ({ state, focus }) => {
      const visibilityWindow = window as Window & {
        __rcatFunctionalVisibility?: DocumentVisibilityState;
      };

      visibilityWindow.__rcatFunctionalVisibility = state;
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("visibilitychange"));

      if (focus) {
        window.dispatchEvent(new Event("focus"));
      }
    },
    {
      state: visibilityState,
      focus: includeFocus
    }
  );
}

async function expectHomePage(page: Page) {
  const publicPageTimeoutMs = 20_000;

  await expect(page.locator(".rcat-page")).toBeVisible({ timeout: publicPageTimeoutMs });
  await expect(page.getByRole("heading", { name: PUBLIC_AUTH_FIXTURE_SITE_NAME }).first()).toBeVisible({
    timeout: publicPageTimeoutMs
  });
  await expect(page.getByRole("alert")).toHaveCount(0, { timeout: publicPageTimeoutMs });
}

test.describe("Public telemetry request governance", () => {
  test("bounds Public navigation telemetry and strips query, hash, and token data", async ({ page }) => {
    await page.clock.install({
      time: new Date(PUBLIC_AUTH_FIXTURE_GENERATED_AT)
    });
    await installDeterministicVisibility(page);
    const network = await installTelemetryNetworkMocks(page);
    const publicFixture = await installPublicAuthIsolationFixture(page);

    await page.goto("/?token=SYNTHETIC-PRIVATE#private-fragment");
    await expectHomePage(page);
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/site-view", "POST")).toBe(1);
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(1);
    await expect.poll(() => network.lazyPublicTelemetry.length).toBe(1);
    await page.clock.runFor(1);
    await expect.poll(async () => (await getGooglePageViews(page)).length).toBe(1);

    expect(countPublicRequests(publicFixture, "/api/public/visitor-stats", "GET")).toBe(0);
    expect(network.googleTagManager).toHaveLength(1);
    expect(network.googleGtag).toHaveLength(0);
    expect(network.vercelAnalytics).toHaveLength(1);
    expect(network.vercelSpeedInsights).toHaveLength(1);

    const initialSiteView = publicFixture.requests.find((request) => request.pathname === "/api/public/site-view");
    expect(initialSiteView?.body).toMatchObject({
      path: "/"
    });
    expect(JSON.stringify(initialSiteView?.body)).not.toMatch(/SYNTHETIC-PRIVATE|token|private-fragment/u);

    const [initialPageView] = await getGooglePageViews(page);
    expect(initialPageView).toMatchObject({
      transport: "gtm",
      page_path: "/",
      page_location: "http://127.0.0.1:5173/"
    });
    expect(JSON.stringify(initialPageView)).not.toMatch(/SYNTHETIC-PRIVATE|token|private-fragment|[?#]/u);

    await dispatchVisibilityAndFocus(page, "visible");
    expect(countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(1);

    await page.evaluate(() => {
      window.history.pushState({}, "", "/news");
    });
    await expect(page).toHaveURL(/\/news$/u);
    await expect(page.getByRole("heading", { name: "ข่าว", exact: true })).toBeVisible();
    await expect(page.getByText(PUBLIC_AUTH_FIXTURE_NEWS_TITLE, { exact: true })).toBeVisible();
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/site-view", "POST")).toBe(2);
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(2);
    await page.clock.runFor(1);
    await expect.poll(async () => (await getGooglePageViews(page)).length).toBe(2);

    await page.evaluate(() => {
      window.history.pushState({}, "", "/news?token=SYNTHETIC-PRIVATE#private-fragment");
    });
    await expect(page).toHaveURL(/\/news\?token=SYNTHETIC-PRIVATE#private-fragment$/u);
    await expect(page.getByRole("heading", { name: "ข่าว", exact: true })).toBeVisible();
    await page.clock.runFor(1);
    expect(countPublicRequests(publicFixture, "/api/public/site-view", "POST")).toBe(2);
    expect(countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(2);
    expect(await getGooglePageViews(page)).toHaveLength(2);

    await page.evaluate((contentSlug) => {
      window.history.pushState({}, "", `/content/${contentSlug}`);
    }, PUBLIC_AUTH_FIXTURE_CONTENT_SLUG);
    await expect(page).toHaveURL(new RegExp(`/content/${PUBLIC_AUTH_FIXTURE_CONTENT_SLUG}$`, "u"));
    await expect(
      page.getByRole("heading", {
        name: PUBLIC_AUTH_FIXTURE_CONTENT_TITLE,
        exact: true,
        level: 1
      })
    ).toBeVisible();
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/site-view", "POST")).toBe(3);
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(3);
    await page.clock.runFor(1);
    await expect.poll(async () => (await getGooglePageViews(page)).length).toBe(3);

    expect(countPublicRequests(publicFixture, "/api/public/visitor-stats", "GET")).toBe(0);
    expect(network.googleTagManager).toHaveLength(1);
    expect(network.googleGtag).toHaveLength(0);
    expect(network.vercelAnalytics).toHaveLength(1);
    expect(network.vercelSpeedInsights).toHaveLength(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("coalesces visibility bursts and enforces five-minute Presence with visible polling budgets", async ({ page }) => {
    await page.clock.install({
      time: new Date(PUBLIC_AUTH_FIXTURE_GENERATED_AT)
    });
    await installDeterministicVisibility(page);
    await installTelemetryNetworkMocks(page);
    const publicFixture = await installPublicAuthIsolationFixture(page);

    await page.goto("/news");
    await expect(page.getByRole("heading", { name: "ข่าว", exact: true })).toBeVisible();
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(1);
    expect(countPublicRequests(publicFixture, "/api/public/visitor-stats", "GET")).toBe(0);

    await page.evaluate(async (modulePath) => {
      await import(/* @vite-ignore */ modulePath);
    }, "/src/public/pages/PublicHomePage.tsx");

    publicFixture.requests.length = 0;
    await page.evaluate(() => {
      window.history.pushState({}, "", "/");
    });
    await expectHomePage(page);
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(1);
    expect(countPublicRequests(publicFixture, "/api/public/visitor-stats", "GET")).toBe(0);

    const pausedAt = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(pausedAt + 1_000);

    await dispatchVisibilityAndFocus(page, "visible");
    expect(countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(1);

    // Visitor stats may refresh after 60 seconds, but Presence stays throttled
    // until the five-minute path budget expires.
    await page.clock.pauseAt(pausedAt + 61_001);
    expect(countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(1);
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/visitor-stats", "GET")).toBe(1);

    // The exact 299,999/300,000 millisecond Presence boundary is covered by the
    // deterministic unit test. Advance past five minutes and wait for the
    // persistent tracker interval to settle.
    await page.clock.pauseAt(pausedAt + 301_001);
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(2);

    await dispatchVisibilityAndFocus(page, "visible");
    await page.clock.runFor(1);
    expect(countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(2);
    const statsBeforeHidden = countPublicRequests(publicFixture, "/api/public/visitor-stats", "GET");
    expect(statsBeforeHidden).toBeGreaterThanOrEqual(1);

    await dispatchVisibilityAndFocus(page, "hidden", false);
    // Publish the hidden state so React Query cancels visible polling, then
    // remain hidden for another full Presence budget.
    await page.clock.runFor(1);
    await page.clock.pauseAt(pausedAt + 601_001);
    expect(countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(2);
    expect(countPublicRequests(publicFixture, "/api/public/visitor-stats", "GET")).toBe(statsBeforeHidden);

    await dispatchVisibilityAndFocus(page, "visible");
    // React Query schedules its focus notification through the browser task
    // queue. Advance one millisecond so the mocked clock flushes that task
    // deterministically even under parallel test load.
    await page.clock.runFor(1);
    await expect.poll(() => countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(3);
    await expect
      .poll(() => countPublicRequests(publicFixture, "/api/public/visitor-stats", "GET"))
      .toBe(statsBeforeHidden + 1);

    // Stay below the next visitor-stats refresh and well below the next
    // five-minute Presence path budget after visibility resumed.
    await page.clock.runFor(59_998);
    expect(countPublicRequests(publicFixture, "/api/public/presence", "POST")).toBe(3);
    expect(countPublicRequests(publicFixture, "/api/public/visitor-stats", "GET")).toBe(statsBeforeHidden + 1);
  });

  test("keeps Public rendering available when the optional telemetry module fails", async ({ page }) => {
    const network = await installTelemetryNetworkMocks(page);
    await page.addInitScript(() => {
      window.__RCAT_FUNCTIONAL_FAIL_PUBLIC_TELEMETRY_IMPORT__ = true;
    });
    await installPublicAuthIsolationFixture(page);

    await page.goto("/");
    await expectHomePage(page);
    await expect
      .poll(() => page.evaluate(() => window.__RCAT_FUNCTIONAL_PUBLIC_TELEMETRY_FAILURE_TRIGGERED__))
      .toBe(true);
    expect(network.lazyPublicTelemetry).toHaveLength(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText(/telemetry|analytics/i)).toHaveCount(0);
  });
});
