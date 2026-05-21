import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/projectSettings", () => ({
  getGoogleAppsScriptUrl: () => "https://script.google.com/macros/s/test/exec",
  projectSettings: {
    api: {
      googleAppsScriptUrl: "https://script.google.com/macros/s/test/exec",
      googleAppsScriptUrlEnv: "VITE_GOOGLE_APPS_SCRIPT_URL",
      resources: {
        siteView: "site-view"
      }
    },
    storageKeys: {
      session: "rcat.cms.session",
      displaySettings: "rcat.cms.display.settings"
    }
  }
}));

import { recordSiteView, type SiteViewInput } from "../services/googleApi";
import { isPublicSiteViewPath, resetSiteViewTrackingForTests, trackPublicSiteView } from "../services/siteViewTracking";

function setSendBeacon(sendBeacon: ((url: string | URL, data?: BodyInit | null) => boolean) | undefined) {
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value: sendBeacon
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-21T03:00:00.000Z"));
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  document.title = "RCAT";
  resetSiteViewTrackingForTests();
});

afterEach(() => {
  resetSiteViewTrackingForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("site view route guard", () => {
  it("tracks only public routes", () => {
    expect(isPublicSiteViewPath("/")).toBe(true);
    expect(isPublicSiteViewPath("/news")).toBe(true);
    expect(isPublicSiteViewPath("/content/announcement-1")).toBe(true);
    expect(isPublicSiteViewPath("/login")).toBe(false);
    expect(isPublicSiteViewPath("/login/")).toBe(false);
    expect(isPublicSiteViewPath("/admin")).toBe(false);
    expect(isPublicSiteViewPath("/admin/settings")).toBe(false);
  });
});

describe("trackPublicSiteView", () => {
  it("records a public route once with an anonymous browser visitor id", () => {
    const record = vi.fn((input: SiteViewInput) => Boolean(input));

    trackPublicSiteView("/news", { record });

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        visitorId: expect.stringMatching(/^rcat_[A-Za-z0-9_-]{16,}$/),
        path: "/news",
        timestamp: "2026-05-21T03:00:00.000Z",
        pageTitle: "RCAT"
      })
    );
    expect(window.localStorage.getItem("rcat.site.visitor.id")).toMatch(/^rcat_[A-Za-z0-9_-]{16,}$/);
  });

  it("does not track login or admin routes", () => {
    const record = vi.fn((input: SiteViewInput) => Boolean(input));

    trackPublicSiteView("/login", { record });
    trackPublicSiteView("/admin", { record });
    trackPublicSiteView("/admin/content", { record });

    expect(record).not.toHaveBeenCalled();
  });

  it("throttles duplicate same-path views within thirty minutes", () => {
    const record = vi.fn((input: SiteViewInput) => Boolean(input));

    trackPublicSiteView("/news", { record });
    trackPublicSiteView("/news", { record });
    vi.setSystemTime(new Date("2026-05-21T03:29:00.000Z"));
    trackPublicSiteView("/news", { record });
    trackPublicSiteView("/announcements", { record });

    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls.map((call) => call[0].path)).toEqual(["/news", "/announcements"]);
  });

  it("does not surface tracking failures to the UI", () => {
    const record = vi.fn((input: SiteViewInput) => {
      Boolean(input);
      throw new Error("network unavailable");
    });

    expect(() => trackPublicSiteView("/news", { record })).not.toThrow();
  });
});

describe("recordSiteView", () => {
  it("uses navigator.sendBeacon with a text payload when available", () => {
    const sendBeacon = vi.fn(() => true);
    setSendBeacon(sendBeacon);

    expect(
      recordSiteView({
        visitorId: "rcat_1234567890abcdef",
        path: "/news",
        timestamp: "2026-05-21T03:00:00.000Z"
      })
    ).toBe(true);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [requestUrl, payload] = sendBeacon.mock.calls[0] as unknown as [string | URL, BodyInit];
    const url = new URL(String(requestUrl));
    expect(url.searchParams.get("resource")).toBe("site-view");
    expect(payload).toBeInstanceOf(Blob);
    expect((payload as Blob).type).toBe("text/plain;charset=utf-8");
  });

  it("falls back to fetch keepalive when sendBeacon is unavailable", () => {
    setSendBeacon(undefined);
    const fetch = vi.fn().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetch);

    expect(
      recordSiteView({
        visitorId: "rcat_1234567890abcdef",
        path: "/news",
        timestamp: "2026-05-21T03:00:00.000Z"
      })
    ).toBe(true);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetch.mock.calls[0] as [string | URL, RequestInit];
    const url = new URL(String(requestUrl));
    expect(url.searchParams.get("resource")).toBe("site-view");
    expect(init).toMatchObject({
      method: "POST",
      keepalive: true,
      cache: "no-store",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        visitorId: "rcat_1234567890abcdef",
        path: "/news",
        timestamp: "2026-05-21T03:00:00.000Z"
      })
    });
  });
});
