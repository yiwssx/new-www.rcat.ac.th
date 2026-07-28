import type { Page } from "@playwright/test";

export interface LayoutShiftSourceSnapshot {
  node: string;
  previousRect: ElementBoxSnapshot;
  currentRect: ElementBoxSnapshot;
}

export interface LayoutShiftEntrySnapshot {
  value: number;
  startTime: number;
  sources: LayoutShiftSourceSnapshot[];
}

export interface ElementBoxSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PublicLayoutSnapshot {
  main: ElementBoxSnapshot | null;
  loading: ElementBoxSnapshot | null;
  footerDirectory: ElementBoxSnapshot | null;
  darkFooter: ElementBoxSnapshot | null;
  messenger: ElementBoxSnapshot | null;
  documentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

declare global {
  interface Window {
    __rcatLayoutShiftEntries?: LayoutShiftEntrySnapshot[];
  }
}

export async function installLayoutShiftObserver(page: Page) {
  await page.addInitScript(() => {
    window.__rcatLayoutShiftEntries = [];
    const serializeRect = (rect: DOMRectReadOnly) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left
    });

    if (typeof PerformanceObserver === "undefined") {
      return;
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
            sources?: Array<{
              node?: Node | null;
              previousRect: DOMRectReadOnly;
              currentRect: DOMRectReadOnly;
            }>;
          };

          if (!layoutShift.hadRecentInput) {
            window.__rcatLayoutShiftEntries?.push({
              value: layoutShift.value ?? 0,
              startTime: layoutShift.startTime,
              sources:
                layoutShift.sources?.map((source) => ({
                  node:
                    source.node instanceof Element
                      ? source.node.getAttribute("data-cls-region") ||
                        source.node.getAttribute("aria-label") ||
                        source.node.tagName
                      : "",
                  previousRect: serializeRect(source.previousRect),
                  currentRect: serializeRect(source.currentRect)
                })) ?? []
            });
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Bounding-box assertions remain available when Layout Instability is unsupported.
    }
  });
}

export async function resetLayoutShiftEntries(page: Page) {
  await page.evaluate(() => {
    window.__rcatLayoutShiftEntries = [];
  });
}

export async function readLayoutShiftEntries(page: Page) {
  return page.evaluate(() => window.__rcatLayoutShiftEntries ?? []);
}

export async function readCumulativeLayoutShift(page: Page) {
  const entries = await readLayoutShiftEntries(page);
  return entries.reduce((total, entry) => total + entry.value, 0);
}

export async function groupLayoutShiftsBySource(page: Page) {
  const entries = await readLayoutShiftEntries(page);
  const groups: Record<string, number> = {};

  for (const entry of entries) {
    const sourceNames = new Set(entry.sources.map((source) => source.node || "unknown"));

    for (const sourceName of sourceNames) {
      groups[sourceName] = (groups[sourceName] ?? 0) + entry.value;
    }
  }

  return groups;
}

async function readBox(page: Page, selector: string): Promise<ElementBoxSnapshot | null> {
  return page
    .$eval(selector, (element) => {
      const rect = element.getBoundingClientRect();

      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      };
    })
    .catch(() => null);
}

export async function readPublicLayoutSnapshot(page: Page): Promise<PublicLayoutSnapshot> {
  const [main, loading, footerDirectory, darkFooter, messenger] = await Promise.all([
    readBox(page, 'main, [data-cls-region="main"]'),
    readBox(page, '[data-cls-region="public-loading"], [role="status"][aria-label="Preparing page"]'),
    readBox(page, '[data-cls-region="footer-directory"], section[aria-label="ไดเรกทอรีลิงก์ส่วนท้ายเว็บไซต์"]'),
    readBox(page, '[data-cls-region="dark-footer"], footer'),
    readBox(page, '[data-cls-region="floating-messenger"], [aria-label*="แชท"]')
  ]);
  const documentMetrics = await page.evaluate(() => ({
    documentHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  }));

  return {
    main,
    loading,
    footerDirectory,
    darkFooter,
    messenger,
    ...documentMetrics
  };
}

export async function waitForLayoutQuietWindow(page: Page, quietWindowMs = 300, timeoutMs = 5_000) {
  await page.waitForFunction(
    (quietWindow) => {
      const entries = window.__rcatLayoutShiftEntries ?? [];
      const lastEntry = entries.at(-1);

      return !lastEntry || performance.now() - lastEntry.startTime >= quietWindow;
    },
    quietWindowMs,
    { timeout: timeoutMs }
  );

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}
