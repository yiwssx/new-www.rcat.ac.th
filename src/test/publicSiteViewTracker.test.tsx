import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter
} from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicSiteViewTracker } from "../features/site-view";
import { recordPresence, recordSiteView, type SiteViewInput } from "../features/site-view/api";
import { resetSiteViewTrackingForTests, trackPublicPresence, trackPublicSiteView } from "../features/site-view";

vi.mock("../features/site-view/api", () => ({
  recordSiteView: vi.fn(() => true),
  recordPresence: vi.fn(() => true)
}));

const recordSiteViewMock = vi.mocked(recordSiteView);
const recordPresenceMock = vi.mocked(recordPresence);
const TEST_NOW = new Date("2026-07-27T00:00:00.000Z").getTime();

function TestRoot() {
  return (
    <>
      <PublicSiteViewTracker />
      <Outlet />
    </>
  );
}

function createTrackedRouter(initialEntry: string) {
  const rootRoute = createRootRoute({
    component: TestRoot
  });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <main data-testid="home">Home</main>
  });
  const newsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "news",
    component: () => <main data-testid="news">News</main>
  });
  const announcementsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "announcements",
    component: () => <main data-testid="announcements">Announcements</main>
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "login",
    component: () => <main data-testid="login">Login</main>
  });
  const activateAccountRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "activate-account",
    component: () => <main data-testid="activate-account">Activate account</main>
  });
  const resetPasswordRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "reset-password",
    component: () => <main data-testid="reset-password">Reset password</main>
  });
  const administratorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "administrator",
    component: () => <main data-testid="administrator">Administrator public page</main>
  });
  const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "admin",
    component: () => <Outlet />
  });
  const adminIndexRoute = createRoute({
    getParentRoute: () => adminRoute,
    path: "/",
    component: () => <main data-testid="admin">Admin</main>
  });
  const adminContentRoute = createRoute({
    getParentRoute: () => adminRoute,
    path: "content",
    component: () => <main data-testid="admin-content">Admin content</main>
  });
  const routeTree = rootRoute.addChildren([
    homeRoute,
    newsRoute,
    announcementsRoute,
    loginRoute,
    activateAccountRoute,
    resetPasswordRoute,
    administratorRoute,
    adminRoute.addChildren([adminIndexRoute, adminContentRoute])
  ]);

  return createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialEntry]
    })
  });
}

function renderTrackedRouter(initialEntry: string) {
  const router = createTrackedRouter(initialEntry);
  const view = render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );

  return {
    router,
    ...view
  };
}

function setDocumentReferrer(value: string) {
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.title = "RCAT";
  setDocumentReferrer("");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  recordSiteViewMock.mockReset();
  recordSiteViewMock.mockReturnValue(true);
  recordPresenceMock.mockReset();
  recordPresenceMock.mockReturnValue(true);
  resetSiteViewTrackingForTests();
});

afterEach(() => {
  vi.useRealTimers();
  resetSiteViewTrackingForTests();
  vi.restoreAllMocks();
});

describe("PublicSiteViewTracker", () => {
  it("tracks a public route once when mounted in StrictMode", async () => {
    setDocumentReferrer("https://example.edu/full/path?secret=value");
    document.title = "News";

    renderTrackedRouter("/news");

    expect(await screen.findByTestId("news")).toBeInTheDocument();
    await waitFor(() => expect(recordSiteViewMock).toHaveBeenCalledTimes(1));
    expect(recordSiteViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        visitorId: expect.stringMatching(/^rcat_[A-Za-z0-9_-]{16,}$/),
        path: "/news",
        pageTitle: "News",
        referrerOrigin: "https://example.edu"
      })
    );
    expect(JSON.stringify(recordSiteViewMock.mock.calls[0][0])).not.toContain("secret=value");
    expect(window.localStorage.getItem("rcat.site.visitor.id")).toMatch(/^rcat_[A-Za-z0-9_-]{16,}$/);
  });

  it("does not track the login route", async () => {
    renderTrackedRouter("/login");

    expect(await screen.findByTestId("login")).toBeInTheDocument();
    expect(recordSiteViewMock).not.toHaveBeenCalled();
    expect(recordPresenceMock).not.toHaveBeenCalled();
  });

  it("does not track activation, reset, or admin routes", async () => {
    const activation = renderTrackedRouter("/activate-account");

    expect(await screen.findByTestId("activate-account")).toBeInTheDocument();
    expect(recordSiteViewMock).not.toHaveBeenCalled();
    expect(recordPresenceMock).not.toHaveBeenCalled();
    activation.unmount();

    const reset = renderTrackedRouter("/reset-password");

    expect(await screen.findByTestId("reset-password")).toBeInTheDocument();
    expect(recordSiteViewMock).not.toHaveBeenCalled();
    expect(recordPresenceMock).not.toHaveBeenCalled();
    reset.unmount();

    const { router } = renderTrackedRouter("/admin");

    expect(await screen.findByTestId("admin")).toBeInTheDocument();
    await act(async () => {
      await router.navigate({ to: "/admin/content" });
    });
    expect(await screen.findByTestId("admin-content")).toBeInTheDocument();
    expect(recordSiteViewMock).not.toHaveBeenCalled();
    expect(recordPresenceMock).not.toHaveBeenCalled();
  });

  it("keeps near-matching public paths eligible for first-party telemetry", async () => {
    renderTrackedRouter("/administrator");

    expect(await screen.findByTestId("administrator")).toBeInTheDocument();
    await waitFor(() => {
      expect(recordSiteViewMock).toHaveBeenCalledTimes(1);
      expect(recordPresenceMock).toHaveBeenCalledTimes(1);
    });
  });

  it("does not track the same path twice within the throttle window", async () => {
    const firstRender = renderTrackedRouter("/news");

    expect(await screen.findByTestId("news")).toBeInTheDocument();
    await waitFor(() => expect(recordSiteViewMock).toHaveBeenCalledTimes(1));
    firstRender.unmount();

    renderTrackedRouter("/news");

    expect(await screen.findByTestId("news")).toBeInTheDocument();
    expect(recordSiteViewMock).toHaveBeenCalledTimes(1);
  });

  it("tracks a different public path after navigation", async () => {
    const { router } = renderTrackedRouter("/news");

    expect(await screen.findByTestId("news")).toBeInTheDocument();
    await waitFor(() => expect(recordSiteViewMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await router.navigate({ to: "/announcements" });
    });

    expect(await screen.findByTestId("announcements")).toBeInTheDocument();
    await waitFor(() => expect(recordSiteViewMock).toHaveBeenCalledTimes(2));
    expect(recordSiteViewMock.mock.calls.map((call: [SiteViewInput]) => call[0].path)).toEqual([
      "/news",
      "/announcements"
    ]);
    expect(recordPresenceMock.mock.calls.map(([input]) => input.path)).toEqual(["/news", "/announcements"]);
  });

  it("does not resend a recently recorded Presence path after visiting another path", () => {
    expect(trackPublicPresence("/news", { now: () => TEST_NOW })).toBe(true);
    expect(trackPublicPresence("/announcements", { now: () => TEST_NOW + 1_000 })).toBe(true);
    expect(trackPublicPresence("/news", { now: () => TEST_NOW + 2_000 })).toBe(false);

    expect(recordPresenceMock.mock.calls.map(([input]) => input.path)).toEqual(["/news", "/announcements"]);
  });

  it("normalizes query, hash, and trailing-slash variations into one throttled Site View path", () => {
    expect(trackPublicSiteView("/news/?token=secret#private", { now: () => TEST_NOW })).toBe(true);
    expect(trackPublicSiteView("/news?different=value", { now: () => TEST_NOW + 1_000 })).toBe(false);
    expect(recordSiteViewMock).toHaveBeenCalledTimes(1);
    expect(recordSiteViewMock).toHaveBeenCalledWith(expect.objectContaining({ path: "/news" }));
    expect(JSON.stringify(recordSiteViewMock.mock.calls[0][0])).not.toContain("secret");
  });

  it("omits a query-derived search title from the first-party Site View payload", () => {
    document.title = "ค้นหา: RESET-TOKEN-FIXTURE admin@example.invalid private";

    expect(trackPublicSiteView("/search?token=RESET-TOKEN-FIXTURE#private", { now: () => TEST_NOW })).toBe(true);

    expect(recordSiteViewMock).toHaveBeenCalledWith({
      visitorId: expect.stringMatching(/^rcat_/u),
      path: "/search",
      timestamp: new Date(TEST_NOW).toISOString()
    });
    expect(JSON.stringify(recordSiteViewMock.mock.calls[0][0])).not.toMatch(
      /RESET-TOKEN-FIXTURE|admin@example\.invalid|private/u
    );
  });

  it("allows the same Site View path again at the exact 30-minute boundary", () => {
    expect(trackPublicSiteView("/news", { now: () => TEST_NOW })).toBe(true);
    expect(trackPublicSiteView("/news", { now: () => TEST_NOW + 30 * 60 * 1000 - 1 })).toBe(false);
    expect(trackPublicSiteView("/news", { now: () => TEST_NOW + 30 * 60 * 1000 })).toBe(true);
    expect(recordSiteViewMock).toHaveBeenCalledTimes(2);
  });

  it("recovers from corrupt Site View throttle storage without breaking rendering", async () => {
    window.localStorage.setItem("rcat.site.view.throttle.v1", "{not-json");

    renderTrackedRouter("/news");

    expect(await screen.findByTestId("news")).toBeInTheDocument();
    await waitFor(() => expect(recordSiteViewMock).toHaveBeenCalledTimes(1));
    expect(() => JSON.parse(window.localStorage.getItem("rcat.site.view.throttle.v1") || "")).not.toThrow();
  });

  it("coalesces the StrictMode mount and sends one visible Presence heartbeat per five minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    const view = renderTrackedRouter("/news");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(recordPresenceMock).toHaveBeenCalledTimes(1);
    expect(recordPresenceMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "/news", visitorId: expect.stringMatching(/^rcat_/) })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
    });
    expect(recordPresenceMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(recordPresenceMock).toHaveBeenCalledTimes(2);

    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    expect(recordPresenceMock).toHaveBeenCalledTimes(2);
  });

  it("coalesces a focus and visibility burst after a hidden heartbeat window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    renderTrackedRouter("/news");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(recordPresenceMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(recordPresenceMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(recordPresenceMock).toHaveBeenCalledTimes(2);
  });

  it("does not send Presence while hidden and sends once when returning visible after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    renderTrackedRouter("/news");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    expect(recordPresenceMock).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(recordPresenceMock).toHaveBeenCalledTimes(1);
  });

  it("keeps rendering when site view recording fails", async () => {
    recordSiteViewMock.mockImplementation(() => {
      throw new Error("network unavailable");
    });

    renderTrackedRouter("/news");

    expect(await screen.findByTestId("news")).toBeInTheDocument();
    await waitFor(() => expect(recordSiteViewMock).toHaveBeenCalledTimes(1));
  });
});
