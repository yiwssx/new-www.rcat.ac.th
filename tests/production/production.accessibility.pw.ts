import { expect, test, type Page } from "@playwright/test";

const routes = [
  { name: "home", path: "/", requireSingleH1: true },
  { name: "documents", path: "/documents", requireSingleH1: true },
  { name: "search", path: "/search?q=phase-c-accessibility-probe-no-match", requireSingleH1: true },
  { name: "login", path: "/login", requireSingleH1: false },
  { name: "admin-auth-boundary", path: "/admin", requireSingleH1: false, redirectsToLogin: true }
] as const;

async function dismissIntroGateIfPresent(page: Page) {
  const dialog = page.getByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" });

  try {
    await dialog.waitFor({ state: "visible", timeout: 1_500 });
    await dialog.getByRole("button").click();
    await expect(dialog).toBeHidden();
  } catch {
    // The gate is optional and can be disabled by current homepage settings.
  }
}

async function auditAccessibility(page: Page, requireSingleH1: boolean) {
  return page.evaluate((singleH1) => {
    const visible = (element: Element) => {
      const node = element as HTMLElement;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const selectorFor = (element: Element) => {
      const id = element.getAttribute("id");
      if (id) return `${element.tagName.toLowerCase()}#${id}`;
      const name = element.getAttribute("name");
      if (name) return `${element.tagName.toLowerCase()}[name="${name}"]`;
      return element.tagName.toLowerCase();
    };

    const hasAccessibleName = (element: Element) => {
      const text = (element.textContent || "").trim();
      return Boolean(
        text ||
        element.getAttribute("aria-label")?.trim() ||
        element.getAttribute("aria-labelledby")?.trim() ||
        element.getAttribute("title")?.trim()
      );
    };

    const hasFormLabel = (element: Element) => {
      const id = element.getAttribute("id");
      const explicitLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const wrappingLabel = element.closest("label");
      return Boolean(
        explicitLabel ||
        wrappingLabel ||
        element.getAttribute("aria-label")?.trim() ||
        element.getAttribute("aria-labelledby")?.trim() ||
        element.getAttribute("title")?.trim()
      );
    };

    const violations: string[] = [];
    const lang = document.documentElement.getAttribute("lang")?.trim();
    if (!lang) violations.push("document: html element is missing lang");
    if (!document.title.trim()) violations.push("document: title is empty");

    const headings = Array.from(document.querySelectorAll("h1")).filter(visible);
    if (singleH1 && headings.length !== 1) {
      violations.push(`document: expected exactly one visible h1, found ${headings.length}`);
    }

    for (const image of Array.from(document.querySelectorAll("img")).filter(visible)) {
      if (!image.hasAttribute("alt")) violations.push(`${selectorFor(image)}: image is missing alt attribute`);
    }

    for (const control of Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea")).filter(
      (element) => visible(element) && !element.closest('[aria-hidden="true"]')
    )) {
      if (!hasFormLabel(control)) violations.push(`${selectorFor(control)}: form control has no accessible label`);
    }

    for (const interactive of Array.from(document.querySelectorAll("button, a[href]")).filter(visible)) {
      if (!hasAccessibleName(interactive))
        violations.push(`${selectorFor(interactive)}: interactive element has no accessible name`);
    }

    const ids = new Map<string, number>();
    for (const element of Array.from(document.querySelectorAll("[id]"))) {
      const id = element.getAttribute("id");
      if (id) ids.set(id, (ids.get(id) || 0) + 1);
    }
    for (const [id, count] of ids) {
      if (count > 1) violations.push(`document: duplicate id "${id}" appears ${count} times`);
    }

    for (const element of Array.from(document.querySelectorAll("[tabindex]"))) {
      const value = Number(element.getAttribute("tabindex"));
      if (Number.isFinite(value) && value > 0)
        violations.push(`${selectorFor(element)}: positive tabindex ${value} changes natural tab order`);
    }

    return violations;
  }, requireSingleH1);
}

test.describe("Phase C1 automated accessibility", () => {
  for (const route of routes) {
    test(`${route.name} keeps the production accessibility baseline`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await dismissIntroGateIfPresent(page);

      if (route.redirectsToLogin) {
        await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
      }

      const violations = await auditAccessibility(page, route.requireSingleH1);
      expect(violations, violations.join("\n")).toEqual([]);
    });
  }
});