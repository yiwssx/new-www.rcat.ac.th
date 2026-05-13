import { afterEach, describe, expect, it } from "vitest";
import {
  isPublicAnalyticsPath,
  resetPublicAnalyticsForTests,
  trackPublicPageView
} from "../shared/utils/publicAnalytics";

const googleTagManagerScriptId = "rcat-google-tag-manager";
const googleAnalyticsScriptId = "rcat-google-analytics";

type GtagCommand = [command: string, ...parameters: unknown[]];

type TestAnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: GtagCommand) => void;
};

function getTestAnalyticsWindow() {
  return window as TestAnalyticsWindow;
}

function resetAnalyticsDom() {
  document.getElementById(googleTagManagerScriptId)?.remove();
  document.getElementById(googleAnalyticsScriptId)?.remove();

  const analyticsWindow = getTestAnalyticsWindow();
  delete analyticsWindow.dataLayer;
  delete analyticsWindow.gtag;

  document.title = "RCAT test page";
  window.history.replaceState({}, "", "/");
  resetPublicAnalyticsForTests();
}

function getDataLayer() {
  return getTestAnalyticsWindow().dataLayer ?? [];
}

function isGtagCommand(value: unknown): value is GtagCommand {
  return Array.isArray(value) && typeof value[0] === "string";
}

function getPageViewEvents() {
  return getDataLayer().filter(
    (entry): entry is ["event", "page_view", Record<string, unknown>] =>
      isGtagCommand(entry) && entry[0] === "event" && entry[1] === "page_view"
  );
}

function getConfigEvents() {
  return getDataLayer().filter(
    (entry): entry is ["config", string, Record<string, unknown>] => isGtagCommand(entry) && entry[0] === "config"
  );
}

afterEach(() => {
  resetAnalyticsDom();
});

describe("public analytics route guard", () => {
  it("blocks login and admin routes", () => {
    expect(isPublicAnalyticsPath("/login")).toBe(false);
    expect(isPublicAnalyticsPath("/login/")).toBe(false);
    expect(isPublicAnalyticsPath("/admin")).toBe(false);
    expect(isPublicAnalyticsPath("/admin/")).toBe(false);
    expect(isPublicAnalyticsPath("/admin/content")).toBe(false);
    expect(isPublicAnalyticsPath("/admin/settings?tab=site")).toBe(false);
  });

  it("allows public routes", () => {
    expect(isPublicAnalyticsPath("/")).toBe(true);
    expect(isPublicAnalyticsPath("/administrator")).toBe(true);
    expect(isPublicAnalyticsPath("/news")).toBe(true);
    expect(isPublicAnalyticsPath("/search?q=admission")).toBe(true);
    expect(isPublicAnalyticsPath("/content/news-1")).toBe(true);
  });
});

describe("public analytics tracking", () => {
  it("does not inject scripts on first load at an admin route", () => {
    window.history.replaceState({}, "", "/admin/content");

    trackPublicPageView("/admin/content");

    expect(document.getElementById(googleTagManagerScriptId)).toBeNull();
    expect(document.getElementById(googleAnalyticsScriptId)).toBeNull();
    expect(getTestAnalyticsWindow().dataLayer).toBeUndefined();
  });

  it("injects public analytics and sends an explicit public page view", () => {
    document.title = "News";
    window.history.replaceState({}, "", "/news");

    trackPublicPageView("/news");

    expect(document.getElementById(googleTagManagerScriptId)).not.toBeNull();
    expect(document.getElementById(googleAnalyticsScriptId)).not.toBeNull();
    expect(getConfigEvents()).toEqual([
      [
        "config",
        "G-6L3DV71C2J",
        {
          send_page_view: false
        }
      ]
    ]);
    expect(getPageViewEvents()).toEqual([
      [
        "event",
        "page_view",
        expect.objectContaining({
          page_path: "/news",
          page_location: "http://localhost:3000/news",
          page_title: "News"
        })
      ]
    ]);
  });

  it("does not duplicate scripts or page views for the same public route", () => {
    window.history.replaceState({}, "", "/news");

    trackPublicPageView("/news");
    trackPublicPageView("/news");

    expect(document.querySelectorAll(`#${googleTagManagerScriptId}`)).toHaveLength(1);
    expect(document.querySelectorAll(`#${googleAnalyticsScriptId}`)).toHaveLength(1);
    expect(getPageViewEvents()).toHaveLength(1);
  });

  it("does not send private route page views after analytics has loaded", () => {
    window.history.replaceState({}, "", "/news");
    trackPublicPageView("/news");

    window.history.replaceState({}, "", "/admin");
    trackPublicPageView("/admin");

    expect(getPageViewEvents()).toHaveLength(1);
    expect(JSON.stringify(getDataLayer())).not.toContain("/admin");
  });

  it("loads analytics from private to public navigation and tracks only the public page", () => {
    window.history.replaceState({}, "", "/login");
    trackPublicPageView("/login");

    window.history.replaceState({}, "", "/news");
    trackPublicPageView("/news");

    expect(document.getElementById(googleTagManagerScriptId)).not.toBeNull();
    expect(document.getElementById(googleAnalyticsScriptId)).not.toBeNull();
    expect(getPageViewEvents()).toHaveLength(1);
    expect(getPageViewEvents()[0][2]).toEqual(
      expect.objectContaining({
        page_path: "/news"
      })
    );
  });
});
