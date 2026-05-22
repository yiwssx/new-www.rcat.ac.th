import { Suspense, lazy, type ReactElement } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { PublicAnalytics } from "./shared/components/PublicAnalytics";
import { PublicSiteViewTracker } from "./shared/components/PublicSiteViewTracker";
import { VercelInsights } from "./shared/components/VercelInsights";
import { useAuth } from "./context/authSessionContext";

const AdminActionProgress = lazy(() => import("./admin/components/AdminActionProgress"));
export const CalendarPage = lazy(() => import("./admin/pages/CalendarPage"));
export const CarouselPage = lazy(() => import("./admin/pages/CarouselPage"));
export const CmsShell = lazy(() => import("./admin/layout/CmsShell"));
export const ContentPage = lazy(() => import("./admin/pages/ContentPage"));
export const DashboardPage = lazy(() => import("./admin/pages/DashboardPage"));
export const DocumentsPage = lazy(() => import("./admin/pages/DocumentsPage"));
export const ExternalServicesPage = lazy(() => import("./admin/pages/ExternalServicesPage"));
export const IntegrationsPage = lazy(() => import("./admin/pages/IntegrationsPage"));
export const LoginPage = lazy(() => import("./admin/pages/LoginPage"));
export const MediaPage = lazy(() => import("./admin/pages/MediaPage"));
export const MenuPage = lazy(() => import("./admin/pages/MenuPage"));
export const NotFoundPage = lazy(() => import("./shared/pages/NotFoundPage"));
export const PublicAnnouncementsPage = lazy(() => import("./public/pages/PublicAnnouncementsPage"));
export const PublicBlogPage = lazy(() => import("./public/pages/PublicBlogPage"));
export const PublicContactPage = lazy(() => import("./public/pages/PublicContactPage"));
export const PublicContentDetailPage = lazy(() => import("./public/pages/PublicContentDetailPage"));
export const PublicDepartmentsPage = lazy(() => import("./public/pages/PublicDepartmentsPage"));
export const PublicHomePage = lazy(() => import("./public/pages/PublicHomePage"));
export const PublicNewsPage = lazy(() => import("./public/pages/PublicNewsPage"));
export const PublicSearchPage = lazy(() => import("./public/pages/PublicSearchPage"));
export const SettingsPage = lazy(() => import("./admin/pages/SettingsPage"));

export function RouteFallback() {
  return (
    <Box
      sx={{
        minHeight: "62vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default"
      }}
      className="rcat-section-tight grid min-h-[62vh] place-items-center"
    >
      <CircularProgress />
    </Box>
  );
}

export function RootRouteLayout() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
      <AdminActionProgressBoundary />
      <PublicAnalytics />
      <PublicSiteViewTracker />
      <VercelInsights />
    </Suspense>
  );
}

function AdminActionProgressBoundary() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/login" && !pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <AdminActionProgress />
    </Suspense>
  );
}

export function ProtectedLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <CmsShell />;
}

export function AdminOnlyPage({ children }: { children: ReactElement }) {
  const { session } = useAuth();

  if (session?.user.role !== "admin") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export function PublicContentDetailRoute() {
  const { slug } = useParams({ strict: false }) as { slug: string };

  return <PublicContentDetailPage slug={slug} />;
}
