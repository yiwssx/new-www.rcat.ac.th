import type { Page, Route } from "@playwright/test";
import { createPublicHomeSnapshot } from "./publicHomeCarouselFixture";

const generatedAt = "2026-07-28T00:00:00.000Z";

export const PUBLIC_SHELL_CLS_CONTENT_SLUG = "layout-stability-detail";
export const PUBLIC_SHELL_CLS_SITE_NAME = "RCAT Layout Stability Fixture";

export interface PublicShellClsFixtureOptions {
  delayed?: boolean;
  errorPath?: string;
  emptyFooterDirectory?: boolean;
  includeNestedMenu?: boolean;
  includeSocialLinks?: boolean;
  staleNewsCache?: boolean;
}

export interface PublicShellClsFixture {
  requests: string[];
  hold: () => void;
  release: () => void;
}

function createFooterDirectoryGroups() {
  const titles = [
    "หน่วยงานส่วนกลาง สอศ.(สำนัก)",
    "หน่วยงานส่วนกลาง (ศูนย์/หน่วย/กลุ่ม)",
    "อาชีวศึกษาจังหวัดร้อยเอ็ด",
    "นโยบายการให้บริการ"
  ];

  return titles.map((title, groupIndex) => ({
    title,
    links: Array.from({ length: 7 }, (_, linkIndex) => ({
      label: `ลิงก์ทดสอบ ${groupIndex + 1}.${linkIndex + 1}`,
      href: `/fixture-directory-${groupIndex + 1}-${linkIndex + 1}`,
      enabled: true
    }))
  }));
}

function createContentItem(index: number, type: "news" | "program" = "news") {
  return {
    id: `layout-${type}-${index}`,
    title: `Fixture ${type} ${index}`,
    slug: `fixture-${type}-${index}`,
    type,
    status: "published",
    owner: "Layout Fixture",
    summary: "Deterministic content used to reserve realistic Public route geometry.",
    body: "Deterministic body paragraph one.\n\nDeterministic body paragraph two.\n\nDeterministic body paragraph three.",
    category: "Layout",
    tags: ["fixture", "layout"],
    updatedAt: generatedAt,
    publishAt: generatedAt
  };
}

const newsItems = Array.from({ length: 13 }, (_, index) => createContentItem(index + 1));
const programItems = Array.from({ length: 10 }, (_, index) => createContentItem(index + 1, "program"));
const detailItem = {
  ...createContentItem(99),
  id: "layout-stability-detail",
  slug: PUBLIC_SHELL_CLS_CONTENT_SLUG,
  title: "Deterministic layout stability content detail",
  template: "standard",
  viewCount: 4
};

export function createPublicShellHomeSnapshot(
  options: { emptyFooterDirectory?: boolean; includeNestedMenu?: boolean; includeSocialLinks?: boolean } = {}
) {
  const snapshot = createPublicHomeSnapshot();

  return {
    ...snapshot,
    siteSettings: {
      ...snapshot.siteSettings,
      siteName: PUBLIC_SHELL_CLS_SITE_NAME,
      eyebrow: "Layout Stability",
      intro: "Deterministic Public Shell fixture",
      campus: "Roi-Et",
      phone: "0000000000",
      email: "fixture@example.test",
      facebookUrl: options.includeSocialLinks ? "https://www.facebook.com/rcat.ac.th" : "",
      youtubeUrl: options.includeSocialLinks ? "https://www.youtube.com/@rcat" : "",
      tiktokUrl: options.includeSocialLinks ? "https://www.tiktok.com/@rcat" : "",
      footerTitle: PUBLIC_SHELL_CLS_SITE_NAME,
      footerDescription: "Deterministic dark footer content",
      footerDirectoryGroups: options.emptyFooterDirectory ? [] : createFooterDirectoryGroups(),
      messengerUrl: "https://m.me/example",
      messengerLabel: "แชทกับเจ้าหน้าที่",
      messengerEnabled: true
    },
    menu: [
      { id: "home", label: "หน้าหลัก", href: "/", enabled: true, order: 1 },
      { id: "news", label: "ข่าว", href: "/news", enabled: true, order: 2 },
      {
        id: "departments",
        label: "หลักสูตร",
        href: "/departments",
        enabled: true,
        order: 3,
        children: options.includeNestedMenu
          ? [
              {
                id: "departments-agriculture",
                label: "หลักสูตรเกษตร",
                href: "/departments",
                enabled: true,
                order: 1
              }
            ]
          : undefined
      },
      { id: "search", label: "ค้นหา", href: "/search?q=fixture", enabled: true, order: 4 }
    ],
    carouselSlides: [],
    latestNews: newsItems.slice(0, 4),
    programItems: programItems.slice(0, 4),
    generatedAt
  };
}

function createShellSnapshotFields(homeSnapshot: ReturnType<typeof createPublicShellHomeSnapshot>) {
  return {
    siteSettings: homeSnapshot.siteSettings,
    homepageSettings: homeSnapshot.homepageSettings,
    displaySettings: homeSnapshot.displaySettings,
    menu: homeSnapshot.menu,
    generatedAt
  };
}

export function createPublicShellNewsSnapshot(options: { emptyFooterDirectory?: boolean } = {}) {
  const homeSnapshot = createPublicShellHomeSnapshot(options);

  return {
    kind: "news",
    items: newsItems,
    pageItems: [],
    media: [],
    ...createShellSnapshotFields(homeSnapshot)
  };
}

async function fulfillJson(route: Route, status: number, payload: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload)
  });
}

export async function installPublicShellClsFixture(
  page: Page,
  options: PublicShellClsFixtureOptions = {}
): Promise<PublicShellClsFixture> {
  const requests: string[] = [];
  let delayActive = options.delayed !== false;
  const delayWaiters = new Set<() => void>();

  await page.addInitScript(
    ({ staleNewsCache, newsSnapshot }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();

      if (staleNewsCache) {
        const now = Date.now();
        window.localStorage.setItem(
          "rcat.cms.public.content-list.v2.news",
          JSON.stringify({
            data: newsSnapshot,
            savedAt: now - 20 * 60 * 1000,
            expiresAt: now + 20 * 60 * 1000
          })
        );
      }
    },
    {
      staleNewsCache: options.staleNewsCache ?? false,
      newsSnapshot: createPublicShellNewsSnapshot({
        emptyFooterDirectory: options.emptyFooterDirectory
      })
    }
  );

  await page.route("**/api/public/**", async (route) => {
    const url = new URL(route.request().url());
    const pathWithSearch = `${url.pathname}${url.search}`;
    const homeSnapshot = createPublicShellHomeSnapshot({
      emptyFooterDirectory: options.emptyFooterDirectory,
      includeNestedMenu: options.includeNestedMenu,
      includeSocialLinks: options.includeSocialLinks
    });
    const shellFields = createShellSnapshotFields(homeSnapshot);
    requests.push(pathWithSearch);

    if (
      url.pathname === "/api/public/site-view" ||
      url.pathname === "/api/public/presence" ||
      url.pathname === "/api/public/content-view"
    ) {
      await fulfillJson(route, 200, { accepted: true, viewCount: 5, lastViewedAt: generatedAt });
      return;
    }

    if (url.pathname === "/api/public/visitor-stats") {
      await fulfillJson(route, 200, homeSnapshot.visitorStats);
      return;
    }

    if (delayActive) {
      await new Promise<void>((resolve) => {
        delayWaiters.add(resolve);
      });
    }

    if (options.errorPath && pathWithSearch.startsWith(options.errorPath)) {
      await fulfillJson(route, 503, { error: "Deterministic layout fixture failure" });
      return;
    }

    if (url.pathname === "/api/public/home") {
      await fulfillJson(route, 200, homeSnapshot);
      return;
    }

    if (url.pathname === "/api/public/content" && url.searchParams.get("kind") === "news") {
      await fulfillJson(
        route,
        200,
        createPublicShellNewsSnapshot({
          emptyFooterDirectory: options.emptyFooterDirectory
        })
      );
      return;
    }

    if (url.pathname === "/api/public/search") {
      await fulfillJson(route, 200, {
        items: [...newsItems, ...programItems],
        ...shellFields
      });
      return;
    }

    if (url.pathname === "/api/public/programs") {
      await fulfillJson(route, 200, {
        items: programItems,
        media: [],
        ...shellFields
      });
      return;
    }

    if (url.pathname === `/api/public/content/${PUBLIC_SHELL_CLS_CONTENT_SLUG}`) {
      await fulfillJson(route, 200, { item: detailItem, generatedAt });
      return;
    }

    await fulfillJson(route, 404, { error: `Unhandled deterministic fixture path: ${pathWithSearch}` });
  });

  return {
    requests,
    hold: () => {
      delayActive = true;
    },
    release: () => {
      delayActive = false;
      const waiters = [...delayWaiters];
      delayWaiters.clear();
      waiters.forEach((resolve) => resolve());
    }
  };
}
