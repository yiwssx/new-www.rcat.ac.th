import type { Page } from "@playwright/test";

export type CarouselTransition = "slide" | "fade";

export interface PublicHomeFixtureOptions {
  transition?: CarouselTransition;
  autoplayIntervalSeconds?: number;
}

function createSlide(index: number) {
  return {
    id: `fixture-slide-${index}`,
    title: `Fixture slide ${index}`,
    subtitle: "",
    chip: "",
    imageUrl: `/__carousel_fixture__/desktop-${index}.svg`,
    imageAlt: `Fixture slide ${index}`,
    buttonLabel: "",
    href: "",
    imageFit: index === 2 ? "fill" : "fit-blur",
    focalPointX: index === 3 ? 30 : 50,
    focalPointY: index === 3 ? 20 : 50,
    mobileImageUrl: `/__carousel_fixture__/mobile-${index}.svg`,
    backgroundColor: index === 2 ? "#123456" : "",
    openInNewTab: false,
    enabled: true,
    order: index,
    startAt: "",
    endAt: "",
    updatedAt: "2026-07-17T00:00:00.000Z",
    revision: index
  };
}

export function createPublicHomeSnapshot(options: PublicHomeFixtureOptions = {}) {
  return {
    siteSettings: {
      siteName: "RCAT Carousel Fixture",
      eyebrow: "",
      intro: "",
      campus: "",
      phone: "",
      fax: "",
      email: "",
      address: "",
      admissionUrl: "",
      facebookUrl: "",
      youtubeUrl: "",
      tiktokUrl: "",
      heroTitle: "Carousel visual contract",
      heroDescription: "Deterministic functional fixture",
      heroChip: "",
      heroImageUrl: "",
      directorName: "",
      directorTitle: "",
      directorDescription: "",
      directorImageUrl: "",
      mapUrl: "",
      mapEmbedUrl: "",
      footerTitle: "",
      footerDescription: "",
      footerDirectoryGroups: [],
      messengerUrl: "",
      messengerLabel: "",
      messengerEnabled: false,
      mourningModeEnabled: false,
      mourningModeLabel: "",
      mourningModeNotice: ""
    },
    homepageSettings: {
      carousel: {
        autoplayEnabled: true,
        autoplayIntervalSeconds: options.autoplayIntervalSeconds ?? 30,
        showArrows: true,
        showDots: true,
        pauseOnHover: true,
        pauseOnFocus: true,
        transition: options.transition ?? "fade"
      },
      introGate: {
        enabled: false,
        imageUrl: "",
        imageAlt: "",
        primaryButtonLabel: "",
        secondaryButtonLabel: "",
        secondaryButtonUrl: "",
        storageKey: "functional-carousel-intro"
      },
      marquee: {
        enabled: false,
        label: "",
        text: "",
        speedSeconds: 60
      },
      introVideo: {
        enabled: false,
        title: "",
        youtubeEmbedUrl: ""
      }
    },
    displaySettings: {
      dateFormat: "DD/MM/YYYY",
      timeMode: "24h"
    },
    menu: [],
    carouselSlides: [createSlide(1), createSlide(2), createSlide(3)],
    externalServices: [],
    visitorStats: {
      onlineUsers: 1,
      usersToday: 2,
      totalViews: 3,
      updatedAt: "2026-07-17T00:00:00.000Z"
    },
    latestNews: [],
    latestAnnouncements: [],
    procurementItems: [],
    jobOpportunityItems: [],
    achievementItems: [],
    programItems: [],
    documentItems: [],
    eventItems: [],
    media: [],
    generatedAt: "2026-07-17T00:00:00.000Z"
  };
}

function createSvg(fileName: string) {
  const mobile = fileName.startsWith("mobile");
  const index = Number(fileName.match(/(\d+)/)?.[1] ?? "1");
  const colors = ["#1f5a2c", "#d9a400", "#2457a7"];
  const width = mobile ? 720 : 1600;
  const height = mobile ? 1080 : 600;
  const label = `${mobile ? "MOBILE" : "DESKTOP"} ${index}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${colors[(index - 1) % colors.length]}"/>
    <circle cx="${Math.round(width * 0.25)}" cy="${Math.round(height * 0.35)}" r="${Math.round(height * 0.16)}" fill="rgba(255,255,255,0.24)"/>
    <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="${mobile ? 72 : 96}" font-weight="700">${label}</text>
  </svg>`;
}

export async function installPublicHomeFixture(page: Page, options: PublicHomeFixtureOptions = {}) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.route("**/__carousel_fixture__/*.svg", async (route) => {
    const pathName = new URL(route.request().url()).pathname;
    const fileName = pathName.split("/").pop() ?? "desktop-1.svg";

    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: createSvg(fileName)
    });
  });

  await page.route("**/api/public/home", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(createPublicHomeSnapshot(options))
    });
  });

  await page.route("**/api/public/visitor-stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        onlineUsers: 1,
        usersToday: 2,
        totalViews: 3,
        updatedAt: "2026-07-17T00:00:00.000Z"
      })
    });
  });

  for (const path of ["**/api/public/site-view", "**/api/public/presence"]) {
    await page.route(path, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: true
        })
      });
    });
  }
}
