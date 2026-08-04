import { expect, test, type Page } from "@playwright/test";
import { createPublicHomeSnapshot } from "./fixtures/publicHomeCarouselFixture";

const generatedAt = "2026-07-28T00:00:00.000Z";
const contentSlug = "media-performance-content";
const fixedImageBody =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#1f5a2c"/></svg>';

const ids = {
  intro: "media-intro",
  director: "media-director",
  featuredCard: "media-featured-card",
  regularCard: "media-regular-card",
  programCard: "media-program-card",
  featuredContent: "media-featured-content",
  bodyOne: "media-body-one",
  bodyTwo: "media-body-two",
  event: "media-event"
} as const;
const invalidThumbnailId = "invalid$thumbnail";

function driveFile(id: string) {
  return `https://drive.google.com/file/d/${id}/view`;
}

function driveThumbnail(id: string, width: number) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
}

function imageAsset(id: string, name: string) {
  return {
    id,
    name,
    type: "image",
    size: "fixture",
    owner: "Functional fixture",
    fileId: id,
    mimeType: "image/jpeg",
    thumbnailUrl: driveThumbnail(id, 320),
    previewUrl: driveThumbnail(id, 1600),
    driveUrl: driveFile(id),
    updatedAt: generatedAt
  };
}

const media = [
  imageAsset(ids.featuredCard, "Featured card fixture"),
  {
    ...imageAsset(ids.regularCard, "Regular card fixture"),
    thumbnailUrl: driveFile(invalidThumbnailId),
    previewUrl: driveThumbnail(ids.regularCard, 1600)
  },
  imageAsset(ids.programCard, "Program card fixture"),
  imageAsset(ids.featuredContent, "Featured content fixture"),
  imageAsset(ids.bodyOne, "Body image one fixture"),
  imageAsset(ids.bodyTwo, "Body image two fixture"),
  imageAsset(ids.event, "Event image fixture"),
  {
    id: "media-video",
    name: "Content video fixture",
    type: "video",
    size: "fixture",
    owner: "Functional fixture",
    driveUrl: "https://www.youtube.com/watch?v=media-video",
    embedUrl: "https://www.youtube.com/embed/media-video",
    updatedAt: generatedAt
  }
];

const featuredNews = {
  id: "featured-news",
  title: "Featured media news",
  slug: contentSlug,
  type: "news",
  status: "published",
  owner: "Functional fixture",
  summary: "Featured media fixture",
  category: "Media",
  tags: ["media"],
  featured: true,
  template: "feature",
  featuredMediaId: ids.featuredCard,
  updatedAt: generatedAt,
  publishAt: generatedAt
};

const regularNews = {
  id: "regular-news",
  title: "Regular media news",
  slug: "regular-media-news",
  type: "news",
  status: "published",
  owner: "Functional fixture",
  summary: "Regular media fixture",
  category: "Media",
  tags: ["media"],
  featuredMediaId: ids.regularCard,
  updatedAt: generatedAt,
  publishAt: "2026-07-27T00:00:00.000Z"
};

const program = {
  id: "media-program",
  title: "Media program",
  slug: "media-program",
  type: "program",
  status: "published",
  owner: "Functional fixture",
  summary: "Program fixture",
  category: "Media",
  tags: ["media"],
  featuredMediaId: ids.programCard,
  updatedAt: generatedAt,
  publishAt: generatedAt
};

function spacer(id: string, lines: number) {
  return {
    id,
    type: "paragraph",
    text: Array.from({ length: lines }, (_, index) => `Deterministic spacer ${id} line ${index + 1}`).join("\n")
  };
}

const detailBody = `[[RCAT_BLOCKS_V1]]
${JSON.stringify({
  version: 1,
  blocks: [
    spacer("before-image-one", 42),
    { id: "image-one", type: "image", mediaId: ids.bodyOne, caption: "Body image one caption" },
    spacer("before-video", 48),
    { id: "video", type: "video", mediaId: "media-video", caption: "Video fixture caption" },
    spacer("before-facebook", 48),
    {
      id: "facebook",
      type: "facebookPost",
      href: "https://www.facebook.com/rcat.fixture/posts/123456789",
      caption: "Facebook fixture caption",
      showText: true,
      width: 500,
      height: 760
    },
    spacer("before-image-two", 48),
    { id: "image-two", type: "image", mediaId: ids.bodyTwo, caption: "Body image two caption" }
  ]
})}`;

const detailItem = {
  ...featuredNews,
  id: "media-detail",
  title: "Public media detail fixture",
  slug: contentSlug,
  featuredMediaId: ids.featuredContent,
  mediaIds: [ids.featuredContent, ids.bodyOne, ids.bodyTwo, "media-video"],
  body: detailBody,
  viewCount: 3
};

function createSlides() {
  return Array.from({ length: 5 }, (_, zeroIndex) => {
    const index = zeroIndex + 1;

    return {
      id: `media-slide-${index}`,
      title: `Media slide ${index}`,
      subtitle: "",
      chip: "",
      imageUrl: driveFile(`media-carousel-desktop-${index}`),
      mobileImageUrl: driveFile(`media-carousel-mobile-${index}`),
      imageAlt: `Media slide ${index}`,
      buttonLabel: "",
      href: "",
      imageFit: index === 2 ? "fill" : "fit-blur",
      focalPointX: 50,
      focalPointY: 50,
      backgroundColor: "",
      openInNewTab: false,
      enabled: true,
      order: index,
      startAt: "",
      endAt: "",
      updatedAt: generatedAt,
      revision: index
    };
  });
}

function createSnapshot(introEnabled: boolean) {
  const base = createPublicHomeSnapshot({
    transition: "fade",
    autoplayIntervalSeconds: 120
  });

  return {
    ...base,
    siteSettings: {
      ...base.siteSettings,
      siteName: "Public media performance fixture",
      heroTitle: "Public media performance fixture",
      heroDescription: "Deterministic media requests",
      directorName: "Fixture Director",
      directorTitle: "Director fixture",
      directorDescription: "Deterministic portrait",
      directorImageUrl: driveFile(ids.director)
    },
    homepageSettings: {
      ...base.homepageSettings,
      introGate: {
        enabled: introEnabled,
        imageUrl: driveFile(ids.intro),
        imageAlt: "Intro gate fixture",
        primaryButtonLabel: "เข้าสู่เว็บไซต์",
        secondaryButtonLabel: "",
        secondaryButtonUrl: "",
        storageKey: "media-performance-intro"
      },
      introVideo: {
        enabled: false,
        title: "",
        youtubeEmbedUrl: ""
      }
    },
    carouselSlides: createSlides(),
    latestNews: [featuredNews, regularNews],
    programItems: [program],
    eventItems: [
      {
        id: "media-event",
        title: "Media fixture event",
        date: "2026-08-01T09:00:00.000Z",
        audience: "Public",
        status: "confirmed",
        location: "Fixture campus",
        description: "Fixture event",
        category: "Media",
        visibility: "public",
        mediaIds: [ids.event],
        updatedAt: generatedAt,
        revision: 1
      }
    ],
    media,
    generatedAt
  };
}

interface Ledger {
  driveImages: string[];
  localLogo: string[];
  embeds: string[];
}

function readDriveRequest(url: string) {
  const parsed = new URL(url);
  const filePathMatch = parsed.pathname.match(/^\/file\/d\/([^/]+)/u);
  const id = filePathMatch?.[1] || parsed.searchParams.get("id") || "";
  const widthMatch = parsed.searchParams.get("sz")?.match(/^w(\d+)$/u);

  return {
    id,
    width: widthMatch ? Number(widthMatch[1]) : null
  };
}

function driveRequests(ledger: Ledger) {
  return ledger.driveImages.map(readDriveRequest);
}

function driveRequestsFor(ledger: Ledger, id: string) {
  return driveRequests(ledger).filter((request) => request.id === id);
}

function carouselRequests(ledger: Ledger, variant?: "desktop" | "mobile") {
  const prefix = variant ? `media-carousel-${variant}-` : "media-carousel-";
  return driveRequests(ledger).filter((request) => request.id.startsWith(prefix));
}

function summarizeRequests(ledger: Ledger) {
  const drive = driveRequests(ledger);

  return {
    totalImages: ledger.driveImages.length + ledger.localLogo.length,
    uniqueImages: new Set([...ledger.driveImages, ...ledger.localLogo]).size,
    drive,
    localLogoRequests: ledger.localLogo.length,
    embeds: [...ledger.embeds]
  };
}

async function domSummary(page: Page) {
  return page.evaluate(() => {
    const images = [...document.querySelectorAll("img")];
    const frames = [...document.querySelectorAll("iframe")];

    return {
      imageCount: images.length,
      imageSrcCount: images.filter((image) => image.getAttribute("src")).length,
      eagerCount: images.filter((image) => image.getAttribute("loading") === "eager").length,
      highCount: images.filter((image) => image.getAttribute("fetchpriority") === "high").length,
      iframeCount: frames.length,
      iframeSrcCount: frames.filter((frame) => frame.getAttribute("src")).length
    };
  });
}

async function installFixture(page: Page, introEnabled: boolean): Promise<Ledger> {
  const ledger: Ledger = {
    driveImages: [],
    localLogo: [],
    embeds: []
  };

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  page.on("request", (request) => {
    const url = new URL(request.url());

    if (url.hostname === "drive.google.com") {
      ledger.driveImages.push(request.url());
    }

    if (url.pathname === "/rcat-logo-128.png") {
      ledger.localLogo.push(request.url());
    }

    if (url.hostname === "www.youtube.com" || url.hostname === "www.facebook.com") {
      ledger.embeds.push(request.url());
    }
  });

  await page.route("https://drive.google.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      headers: {
        "cache-control": "public, max-age=3600"
      },
      body: fixedImageBody
    });
  });
  await page.route("https://www.youtube.com/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>fixture video</title>" });
  });
  await page.route("https://www.facebook.com/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>fixture post</title>" });
  });

  await page.route("**/api/public/**", async (route) => {
    const url = new URL(route.request().url());
    const snapshot = createSnapshot(introEnabled);
    let payload: unknown;

    if (url.pathname === "/api/public/home") {
      payload = snapshot;
    } else if (url.pathname === "/api/public/shell") {
      payload = {
        siteSettings: snapshot.siteSettings,
        homepageSettings: snapshot.homepageSettings,
        displaySettings: snapshot.displaySettings,
        menu: snapshot.menu,
        generatedAt
      };
    } else if (url.pathname === "/api/public/content" && url.searchParams.get("kind") === "news") {
      payload = {
        kind: "news",
        items: [featuredNews, regularNews],
        pageItems: [],
        media,
        siteSettings: snapshot.siteSettings,
        homepageSettings: snapshot.homepageSettings,
        displaySettings: snapshot.displaySettings,
        menu: [],
        generatedAt
      };
    } else if (url.pathname === `/api/public/content/${contentSlug}`) {
      payload = { item: detailItem, media, generatedAt };
    } else if (url.pathname === "/api/public/content-view") {
      payload = { id: detailItem.id, slug: detailItem.slug, viewCount: 4, lastViewedAt: generatedAt };
    } else if (url.pathname === "/api/public/visitor-stats") {
      payload = snapshot.visitorStats;
    } else if (url.pathname === "/api/public/site-view" || url.pathname === "/api/public/presence") {
      payload = { accepted: true };
    } else {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "not found" })
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  return ledger;
}

async function expectRequestCount(getCount: () => number, expected: number) {
  await expect.poll(getCount).toBe(expected);
}

test.describe("Public media request budgets", () => {
  test("mobile Intro Gate owns critical priority and gates all page media until dismissal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const ledger = await installFixture(page, true);
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" })).toBeVisible();
    await expectRequestCount(() => driveRequestsFor(ledger, ids.intro).length, 1);

    const before = {
      requests: summarizeRequests(ledger),
      dom: await domSummary(page)
    };

    expect(carouselRequests(ledger)).toHaveLength(0);
    expect(driveRequestsFor(ledger, ids.director)).toHaveLength(0);
    expect(driveRequestsFor(ledger, ids.featuredCard)).toHaveLength(0);
    expect(driveRequestsFor(ledger, ids.regularCard)).toHaveLength(0);
    expect(ledger.embeds).toHaveLength(0);
    expect(before.dom.highCount).toBe(1);

    await page.getByRole("button", { name: "เข้าสู่เว็บไซต์" }).click();
    await expect(page.getByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" })).toHaveCount(0);
    await expect.poll(() => carouselRequests(ledger, "mobile").length).toBeGreaterThanOrEqual(1);

    const after = {
      requests: summarizeRequests(ledger),
      dom: await domSummary(page)
    };
    const requestedCarouselIds = new Set(carouselRequests(ledger).map((request) => request.id));

    expect(requestedCarouselIds.size).toBeLessThanOrEqual(2);
    expect(requestedCarouselIds).toContain("media-carousel-mobile-1");
    expect(requestedCarouselIds).not.toContain("media-carousel-mobile-3");
    expect(requestedCarouselIds).not.toContain("media-carousel-mobile-4");
    expect(requestedCarouselIds).not.toContain("media-carousel-mobile-5");
    expect(carouselRequests(ledger, "desktop")).toHaveLength(0);
    expect(driveRequestsFor(ledger, ids.intro)).toHaveLength(1);
    expect(after.dom.highCount).toBe(1);

    await page.reload();
    await expect(page.getByRole("dialog", { name: "หน้าแนะนำก่อนเข้าสู่เว็บไซต์" })).toHaveCount(0);
    expect(driveRequestsFor(ledger, ids.intro)).toHaveLength(1);

    console.log(`MEDIA_CORRECTED_INTRO=${JSON.stringify({ before, after })}`);
  });

  test("desktop Carousel keeps a bounded loading window through next and distant navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const ledger = await installFixture(page, false);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Public media performance fixture" }).first()).toBeVisible();
    await expect.poll(() => carouselRequests(ledger, "desktop").length).toBeGreaterThanOrEqual(1);
    await expect.poll(() => new Set(carouselRequests(ledger).map((request) => request.id)).size).toBe(2);

    const initial = {
      requests: summarizeRequests(ledger),
      dom: await domSummary(page)
    };
    const initialCarouselIds = new Set(carouselRequests(ledger).map((request) => request.id));

    expect(driveRequestsFor(ledger, ids.intro)).toHaveLength(0);
    expect(initialCarouselIds.size).toBeLessThanOrEqual(2);
    expect(initialCarouselIds).toContain("media-carousel-desktop-1");
    expect(initialCarouselIds).not.toContain("media-carousel-desktop-3");
    expect(initialCarouselIds).not.toContain("media-carousel-desktop-4");
    expect(initialCarouselIds).not.toContain("media-carousel-desktop-5");
    expect(carouselRequests(ledger, "mobile")).toHaveLength(0);
    expect(initial.dom.highCount).toBe(1);

    const beforeNextIds = new Set(carouselRequests(ledger).map((request) => request.id));
    await page.getByRole("button", { name: "สไลด์ถัดไป" }).click();
    await page.waitForTimeout(250);
    const afterNext = summarizeRequests(ledger);
    const afterNextIds = new Set(carouselRequests(ledger).map((request) => request.id));

    expect(afterNextIds.size - beforeNextIds.size).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "ไปยังสไลด์ 5" }).click();
    await expect.poll(() => driveRequestsFor(ledger, "media-carousel-desktop-5").length).toBe(1);
    const afterDistant = summarizeRequests(ledger);

    expect(new Set(carouselRequests(ledger).map((request) => request.id))).toContain("media-carousel-desktop-5");

    console.log(`MEDIA_CORRECTED_CAROUSEL=${JSON.stringify({ initial, afterNext, afterDistant })}`);
  });

  test("mobile Home selects mobile Carousel sources and leaves far slides source-free", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const ledger = await installFixture(page, false);
    await page.goto("/");
    await expect.poll(() => carouselRequests(ledger, "mobile").length).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(250);

    const requestedIds = new Set(carouselRequests(ledger).map((request) => request.id));

    expect(carouselRequests(ledger, "desktop")).toHaveLength(0);
    expect(requestedIds.size).toBeLessThanOrEqual(2);
    expect(requestedIds).toContain("media-carousel-mobile-1");
    expect(requestedIds).not.toContain("media-carousel-mobile-5");
    expect(carouselRequests(ledger).every((request) => request.width === 480)).toBe(true);
  });

  test("news cards use thumbnail precedence and small bounded Drive candidates", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const ledger = await installFixture(page, false);
    await page.goto("/news");
    await expect(page.getByRole("heading", { name: "ข่าว", exact: true })).toBeVisible();
    await expectRequestCount(() => driveRequestsFor(ledger, ids.featuredCard).length, 1);
    await expectRequestCount(() => driveRequestsFor(ledger, ids.regularCard).length, 1);

    const featuredRequest = driveRequestsFor(ledger, ids.featuredCard)[0];
    const regularRequest = driveRequestsFor(ledger, ids.regularCard)[0];

    expect(featuredRequest.width).toBe(320);
    expect(regularRequest.width).toBe(160);
    expect(featuredRequest.width).toBeLessThan(1600);
    expect(regularRequest.width).toBeLessThan(640);
    expect(driveRequestsFor(ledger, invalidThumbnailId)).toHaveLength(0);

    const featuredCard = page.getByRole("link", { name: /Featured media news/ });
    const regularCard = page.getByRole("link", { name: /Regular media news/ });
    const featuredSlot = featuredCard.locator('[data-public-content-card-media-slot="featured"]');
    const regularSlot = regularCard.locator('[data-public-content-card-media-slot="regular"]');
    const featuredImage = featuredCard.getByRole("img", { name: "Featured card fixture" });
    const regularImage = regularCard.getByRole("img", { name: "Regular card fixture" });

    await expect(featuredCard).toBeVisible();
    await expect(regularCard).toBeVisible();
    await expect(featuredImage).toBeVisible();
    await expect(regularImage).toBeVisible();
    await expect(regularImage).toHaveAttribute("src", new RegExp(`id=${ids.regularCard}&`));

    const featuredSlotBox = await featuredSlot.boundingBox();
    const regularSlotBox = await regularSlot.boundingBox();
    const featuredImageBox = await featuredImage.boundingBox();
    const regularImageBox = await regularImage.boundingBox();

    expect(featuredSlotBox).not.toBeNull();
    expect(regularSlotBox).not.toBeNull();
    expect(featuredImageBox).not.toBeNull();
    expect(regularImageBox).not.toBeNull();
    expect(regularSlotBox!.width).toBeGreaterThanOrEqual(68);
    expect(regularSlotBox!.width).toBeLessThanOrEqual(72);
    expect(regularSlotBox!.height).toBeGreaterThanOrEqual(68);
    expect(regularSlotBox!.height).toBeLessThanOrEqual(72);
    expect(regularImageBox!.width).toBeGreaterThan(0);
    expect(regularImageBox!.height).toBeGreaterThan(0);
    expect(regularImageBox!.width).toBeLessThanOrEqual(regularSlotBox!.width + 1);
    expect(regularImageBox!.height).toBeLessThanOrEqual(regularSlotBox!.height + 1);
    expect(featuredSlotBox!.width).toBeGreaterThanOrEqual(170);
    expect(featuredSlotBox!.width).toBeLessThanOrEqual(190);
    expect(featuredSlotBox!.height).toBeGreaterThanOrEqual(145);
    expect(featuredSlotBox!.height).toBeLessThanOrEqual(155);
    expect(featuredImageBox!.width).toBeGreaterThan(0);
    expect(featuredImageBox!.height).toBeGreaterThan(0);
    expect(featuredImageBox!.width).toBeLessThanOrEqual(featuredSlotBox!.width + 1);
    expect(featuredImageBox!.height).toBeLessThanOrEqual(featuredSlotBox!.height + 1);

    console.log(
      `MEDIA_CORRECTED_NEWS=${JSON.stringify({
        requests: summarizeRequests(ledger),
        dom: await domSummary(page),
        geometry: {
          featuredSlot: featuredSlotBox,
          featuredImage: featuredImageBox,
          regularSlot: regularSlotBox,
          regularImage: regularImageBox
        },
        fallback: {
          rejectedThumbnailId: invalidThumbnailId,
          selectedPreviewId: regularRequest.id
        }
      })}`
    );
  });

  test("content detail emits lazy body images first-pass while deferring video and Facebook embeds", async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const ledger = await installFixture(page, false);
    await page.goto(`/content/${contentSlug}`);
    await expect(page.getByRole("heading", { name: "Public media detail fixture", exact: true })).toBeVisible();
    await expectRequestCount(() => driveRequestsFor(ledger, ids.featuredContent).length, 1);

    const before = {
      requests: summarizeRequests(ledger),
      dom: await domSummary(page)
    };

    const bodySlots = page.locator('[data-public-image-intent="content-body"]');
    await expect(bodySlots).toHaveCount(2);
    await expect(bodySlots.nth(0).locator("img")).toHaveAttribute("loading", "lazy");
    await expect(bodySlots.nth(1).locator("img")).toHaveAttribute("loading", "lazy");
    expect(driveRequestsFor(ledger, ids.bodyOne).length).toBeLessThanOrEqual(1);
    expect(driveRequestsFor(ledger, ids.bodyTwo).length).toBeLessThanOrEqual(1);
    expect(ledger.embeds).toHaveLength(0);
    expect(before.dom.highCount).toBe(1);

    await bodySlots.nth(0).scrollIntoViewIfNeeded();
    await expectRequestCount(() => driveRequestsFor(ledger, ids.bodyOne).length, 1);
    const afterFirstImage = summarizeRequests(ledger);

    const embedSlots = page.locator('[data-public-deferred-embed="true"]');
    await embedSlots.nth(0).scrollIntoViewIfNeeded();
    await expect.poll(() => ledger.embeds.filter((url) => new URL(url).hostname === "www.youtube.com").length).toBe(1);
    const afterVideo = summarizeRequests(ledger);

    await embedSlots.nth(1).scrollIntoViewIfNeeded();
    await expect.poll(() => ledger.embeds.filter((url) => new URL(url).hostname === "www.facebook.com").length).toBe(1);

    await bodySlots.nth(1).scrollIntoViewIfNeeded();
    await expectRequestCount(() => driveRequestsFor(ledger, ids.bodyTwo).length, 1);

    const beforeHashNavigation = ledger.driveImages.length + ledger.embeds.length;
    await page.goto(`/content/${contentSlug}#body-two`);
    await page.waitForTimeout(150);
    expect(ledger.driveImages.length + ledger.embeds.length).toBe(beforeHashNavigation);

    const afterAll = {
      requests: summarizeRequests(ledger),
      dom: await domSummary(page)
    };

    console.log(`MEDIA_CORRECTED_DETAIL=${JSON.stringify({ before, afterFirstImage, afterVideo, afterAll })}`);
  });

  test("event attachments remain absent until dialog open and do not duplicate on reopen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const ledger = await installFixture(page, false);
    await page.goto("/");
    const eventButton = page.getByRole("button", { name: "ดูรายละเอียด Media fixture event" });
    await eventButton.scrollIntoViewIfNeeded();

    const beforeDialog = summarizeRequests(ledger);
    expect(driveRequestsFor(ledger, ids.event)).toHaveLength(0);

    await eventButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectRequestCount(() => driveRequestsFor(ledger, ids.event).length, 1);
    const afterDialog = summarizeRequests(ledger);
    expect(driveRequestsFor(ledger, ids.event)[0].width).toBe(480);

    await page.getByRole("button", { name: "ปิด" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await eventButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(150);
    expect(driveRequestsFor(ledger, ids.event).length).toBeLessThanOrEqual(2);
    expect(new Set(driveRequestsFor(ledger, ids.event).map((request) => request.width))).toEqual(new Set([480]));

    console.log(`MEDIA_CORRECTED_EVENT=${JSON.stringify({ beforeDialog, afterDialog })}`);
  });

  test("Auth and Admin routes send no Public fixture media or embed requests", async ({ page }) => {
    const ledger = await installFixture(page, true);
    const authCounts: Record<string, number> = {};

    for (const path of ["/login", "/activate-account", "/reset-password", "/admin"]) {
      const beforeCount = ledger.driveImages.length + ledger.embeds.length;
      await page.goto(path);
      await page.waitForTimeout(150);
      authCounts[path] = ledger.driveImages.length + ledger.embeds.length - beforeCount;
    }

    expect(authCounts).toEqual({
      "/login": 0,
      "/activate-account": 0,
      "/reset-password": 0,
      "/admin": 0
    });

    console.log(`MEDIA_CORRECTED_AUTH=${JSON.stringify({ authCounts })}`);
  });
});
