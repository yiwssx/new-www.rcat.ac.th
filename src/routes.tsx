import { Suspense, lazy, type ReactElement } from "react";
import { Box, CircularProgress } from "@mui/material";
import {
  Navigate,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter
} from "@tanstack/react-router";
import AdminActionProgress from "./admin/components/AdminActionProgress";
import { VercelInsights } from "./shared/components/VercelInsights";
import { useAuth } from "./context/AuthContext";

const CalendarPage = lazy(() => import("./admin/pages/CalendarPage"));
const CmsShell = lazy(() => import("./admin/layout/CmsShell"));
const ContentPage = lazy(() => import("./admin/pages/ContentPage"));
const DashboardPage = lazy(() => import("./admin/pages/DashboardPage"));
const IntegrationsPage = lazy(() => import("./admin/pages/IntegrationsPage"));
const LoginPage = lazy(() => import("./admin/pages/LoginPage"));
const MediaPage = lazy(() => import("./admin/pages/MediaPage"));
const MenuPage = lazy(() => import("./admin/pages/MenuPage"));
const NotFoundPage = lazy(() => import("./shared/pages/NotFoundPage"));
const PublicAnnouncementsPage = lazy(() => import("./public/pages/PublicAnnouncementsPage"));
const PublicBlogPage = lazy(() => import("./public/pages/PublicBlogPage"));
const PublicContactPage = lazy(() => import("./public/pages/PublicContactPage"));
const PublicContentDetailPage = lazy(() => import("./public/pages/PublicContentDetailPage"));
const PublicDepartmentsPage = lazy(() => import("./public/pages/PublicDepartmentsPage"));
const PublicHomePage = lazy(() => import("./public/pages/PublicHomePage"));
const PublicNewsPage = lazy(() => import("./public/pages/PublicNewsPage"));
const SettingsPage = lazy(() => import("./admin/pages/SettingsPage"));

function RouteFallback() {
  return (
    <Box
      sx={{
        minHeight: "62vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default"
      }}
      className="min-h-[62vh] grid place-items-center"
    >
      <CircularProgress />
    </Box>
  );
}

function RootRouteLayout() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
      <AdminActionProgress />
      <VercelInsights />
    </Suspense>
  );
}

function ProtectedLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <CmsShell />;
}

function AdminOnlyPage({ children }: { children: ReactElement }) {
  const { session } = useAuth();

  if (session?.user.role !== "admin") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function PublicContentDetailRoute() {
  const { slug } = publicContentDetailRoute.useParams();
  return <PublicContentDetailPage slug={slug} />;
}

function PublicPermalinkRoute() {
  const { slug } = publicPermalinkRoute.useParams();
  return <PublicContentDetailPage slug={slug} />;
}

const rootRoute = createRootRoute({
  component: RootRouteLayout,
  notFoundComponent: NotFoundPage
});

const publicLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "public-layout",
  component: () => <Outlet />
});

const publicHomeRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/",
  component: PublicHomePage
});

const publicDepartmentsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "departments",
  component: PublicDepartmentsPage
});

const publicNewsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "news",
  component: PublicNewsPage
});

const publicAnnouncementsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "announcements",
  component: PublicAnnouncementsPage
});

const publicBlogRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "blog",
  component: PublicBlogPage
});

const publicContactRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "contact",
  component: PublicContactPage
});

const publicContentDetailRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "content/$slug",
  component: PublicContentDetailRoute
});

const publicPermalinkRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "$slug",
  component: PublicPermalinkRoute
});

const loginRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "login",
  component: LoginPage
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin",
  component: ProtectedLayout
});

const adminDashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: DashboardPage
});

const adminContentRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "content",
  component: ContentPage
});

const adminMediaRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "media",
  component: MediaPage
});

const adminCalendarRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "calendar",
  component: CalendarPage
});

const adminMenuRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "menus",
  component: () => (
    <AdminOnlyPage>
      <MenuPage />
    </AdminOnlyPage>
  )
});

const adminIntegrationsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "integrations",
  component: () => (
    <AdminOnlyPage>
      <IntegrationsPage />
    </AdminOnlyPage>
  )
});

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "settings",
  component: () => (
    <AdminOnlyPage>
      <SettingsPage />
    </AdminOnlyPage>
  )
});

const routeTree = rootRoute.addChildren([
  publicLayoutRoute.addChildren([
    publicHomeRoute,
    publicDepartmentsRoute,
    publicNewsRoute,
    publicAnnouncementsRoute,
    publicBlogRoute,
    publicContactRoute,
    publicContentDetailRoute,
    publicPermalinkRoute,
    loginRoute
  ]),
  adminRoute.addChildren([
    adminDashboardRoute,
    adminContentRoute,
    adminMediaRoute,
    adminCalendarRoute,
    adminMenuRoute,
    adminIntegrationsRoute,
    adminSettingsRoute
  ])
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent"
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
