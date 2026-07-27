import type { Page } from "@playwright/test";
import { createPublicHomeSnapshot } from "./publicHomeCarouselFixture";

const generatedAt = "2026-07-27T00:00:00.000Z";

export const PUBLIC_AUTH_FIXTURE_SITE_NAME = "RCAT Public Auth Isolation Fixture";
export const PUBLIC_AUTH_FIXTURE_NEWS_TITLE = "Deterministic public news";
export const PUBLIC_AUTH_FIXTURE_CONTENT_SLUG = "functional-public-content";
export const PUBLIC_AUTH_FIXTURE_CONTENT_TITLE = "Deterministic public content detail";
export const PUBLIC_AUTH_FIXTURE_GENERATED_AT = generatedAt;

export interface PublicFixtureRequest {
  method: string;
  pathname: string;
  search: string;
  body: unknown;
}

export interface PublicAuthIsolationFixture {
  requests: PublicFixtureRequest[];
}

const newsItem = {
  id: "functional-public-news",
  title: PUBLIC_AUTH_FIXTURE_NEWS_TITLE,
  slug: "functional-public-news",
  type: "news",
  status: "published",
  owner: "Functional Fixture",
  summary: "A deterministic news item for the Public route contract.",
  body: "The Public news fixture rendered successfully.",
  category: "Functional",
  tags: ["public"],
  updatedAt: generatedAt,
  publishAt: generatedAt
};

const contentItem = {
  id: "functional-public-content",
  title: PUBLIC_AUTH_FIXTURE_CONTENT_TITLE,
  slug: PUBLIC_AUTH_FIXTURE_CONTENT_SLUG,
  type: "news",
  status: "published",
  owner: "Functional Fixture",
  summary: "A deterministic content detail for the Public route contract.",
  body: "The Public content detail fixture rendered successfully.",
  category: "Functional",
  tags: ["public"],
  template: "standard",
  viewCount: 7,
  updatedAt: generatedAt,
  publishAt: generatedAt
};

function createHomeSnapshot() {
  const snapshot = createPublicHomeSnapshot();

  return {
    ...snapshot,
    siteSettings: {
      ...snapshot.siteSettings,
      siteName: PUBLIC_AUTH_FIXTURE_SITE_NAME
    },
    carouselSlides: [],
    latestNews: [newsItem, contentItem],
    visitorStats: {
      enabled: true,
      usersToday: 2,
      usersYesterday: 1,
      usersThisMonth: 10,
      usersThisYear: 20,
      totalUsers: 15,
      totalViews: 30,
      onlineUsers: 1,
      updatedAt: generatedAt
    },
    generatedAt
  };
}

export async function installPublicAuthIsolationFixture(page: Page): Promise<PublicAuthIsolationFixture> {
  const requests: PublicFixtureRequest[] = [];

  await page.addInitScript(() => {
    const resetMarker = "rcat.functional.public-fixture.storage-reset";

    if (window.sessionStorage.getItem(resetMarker) !== "1") {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.sessionStorage.setItem(resetMarker, "1");
    }
  });

  await page.route("**/api/public/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const homeSnapshot = createHomeSnapshot();
    let payload: unknown;
    let body: unknown;

    try {
      body = request.postData() ? request.postDataJSON() : null;
    } catch {
      body = request.postData();
    }

    requests.push({
      method: request.method(),
      pathname: url.pathname,
      search: url.search,
      body
    });

    if (url.pathname === "/api/public/home") {
      payload = homeSnapshot;
    } else if (url.pathname === "/api/public/content" && url.searchParams.get("kind") === "news") {
      payload = {
        kind: "news",
        items: [newsItem],
        pageItems: [],
        media: [],
        siteSettings: homeSnapshot.siteSettings,
        homepageSettings: homeSnapshot.homepageSettings,
        displaySettings: homeSnapshot.displaySettings,
        menu: homeSnapshot.menu,
        generatedAt
      };
    } else if (url.pathname === `/api/public/content/${PUBLIC_AUTH_FIXTURE_CONTENT_SLUG}`) {
      payload = { item: contentItem, generatedAt };
    } else if (url.pathname === "/api/public/content-view") {
      payload = {
        id: contentItem.id,
        slug: contentItem.slug,
        viewCount: 8,
        lastViewedAt: generatedAt
      };
    } else if (url.pathname === "/api/public/visitor-stats") {
      payload = homeSnapshot.visitorStats;
    } else if (url.pathname === "/api/public/site-view" || url.pathname === "/api/public/presence") {
      payload = { accepted: true };
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "public fixture route not found" })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload)
    });
  });

  return {
    requests
  };
}
