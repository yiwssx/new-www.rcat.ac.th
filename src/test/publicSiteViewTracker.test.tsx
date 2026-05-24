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
import { recordSiteView, type SiteViewInput } from "../services/googleApi";
import { resetSiteViewTrackingForTests } from "../features/site-view";

vi.mock("../services/googleApi", () => ({
  recordSiteView: vi.fn(() => true)
}));

const recordSiteViewMock = vi.mocked(recordSiteView);

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
  recordSiteViewMock.mockReset();
  recordSiteViewMock.mockReturnValue(true);
  resetSiteViewTrackingForTests();
});

afterEach(() => {
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
  });

  it("does not track admin routes", async () => {
    const { router } = renderTrackedRouter("/admin");

    expect(await screen.findByTestId("admin")).toBeInTheDocument();
    await act(async () => {
      await router.navigate({ to: "/admin/content" });
    });
    expect(await screen.findByTestId("admin-content")).toBeInTheDocument();
    expect(recordSiteViewMock).not.toHaveBeenCalled();
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
