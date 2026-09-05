import { expect, test } from "@playwright/test";

const PERFORMANCE_BUDGET_MS = Object.freeze({
  timeToFirstByte: 5_000,
  firstContentfulPaint: 7_000,
  domContentLoaded: 10_000,
  load: 12_000
});

test.describe("Phase C2 synthetic performance regression", () => {
  test("home route stays within bounded release-oriented performance budgets", async ({ page }, testInfo) => {
    const response = await page.goto("/", { waitUntil: "load" });
    expect(response?.status()).toBe(200);

    await page.waitForTimeout(500);

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const firstContentfulPaint = performance.getEntriesByName("first-contentful-paint")[0];

      if (!navigation) {
        throw new Error("Navigation timing entry is unavailable.");
      }

      if (!firstContentfulPaint) {
        throw new Error("First Contentful Paint timing entry is unavailable.");
      }

      return {
        timeToFirstByte: navigation.responseStart,
        firstContentfulPaint: firstContentfulPaint.startTime,
        domContentLoaded: navigation.domContentLoadedEventEnd,
        load: navigation.loadEventEnd
      };
    });

    console.info(
      `[Phase C2][${testInfo.project.name}] ${JSON.stringify({ route: "/", metrics, budgetMs: PERFORMANCE_BUDGET_MS })}`
    );

    for (const [metric, limit] of Object.entries(PERFORMANCE_BUDGET_MS)) {
      const actual = metrics[metric as keyof typeof metrics];
      expect(Number.isFinite(actual), `${metric} must be a finite browser timing`).toBe(true);
      expect(actual, `${metric} ${Math.round(actual)}ms exceeded ${limit}ms release guardrail`).toBeLessThanOrEqual(
        limit
      );
    }
  });
});
