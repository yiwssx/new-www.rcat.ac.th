/* global document, window */

import { chromium } from "@playwright/test";

const BASE_URL = "https://www.rcat.ac.th";
const EXPECTED_MARKER = process.env.P6B_CSP_EXPECTED_MARKER || "p6b-candidate-v1";
const PATHS = [
  "/",
  "/search?q=rcat",
  "/complaint",
  "/content/facebook-1609435494524655-1623514416450096",
  "/login",
  "/admin",
  "/admin/media"
];

async function waitForDeployment() {
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/`, {
        headers: { "Cache-Control": "no-cache" }
      });
      if (response.headers.get("x-rcat-security-baseline") === EXPECTED_MARKER) return;
    } catch {
      // Keep polling while the deployment is converging.
    }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  throw new Error(`production did not expose security marker ${EXPECTED_MARKER} within 10 minutes`);
}

await waitForDeployment();
const browser = await chromium.launch();

try {
  const context = await browser.newContext();

  for (const path of PATHS) {
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__rcatCspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        window.__rcatCspViolations.push({
          blockedURI: event.blockedURI,
          effectiveDirective: event.effectiveDirective,
          disposition: event.disposition,
          sourceFile: event.sourceFile
        });
      });
    });

    const response = await page.goto(`${BASE_URL}${path}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
    await page.waitForTimeout(2500);

    const violations = await page.evaluate(() => window.__rcatCspViolations || []);
    const relevant = violations.filter(
      (item) => item.disposition === "report" || item.disposition === "enforce"
    );

    if (!response || response.status() >= 500) {
      throw new Error(`${path} returned ${response?.status() ?? "no response"}`);
    }

    if (relevant.length) {
      const summary = relevant
        .slice(0, 8)
        .map((item) => `${item.effectiveDirective}:${item.blockedURI || "inline"}`)
        .join(", ");
      throw new Error(`${path} produced CSP violation(s): ${summary}`);
    }

    console.log(`P6B CSP production smoke: ${path} clean.`);
    await page.close();
  }
} finally {
  await browser.close();
}
