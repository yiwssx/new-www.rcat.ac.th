import { Suspense, lazy, type ReactElement } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate, Outlet, useParams } from "@tanstack/react-router";
import AdminActionProgress from "./admin/components/AdminActionProgress";
import { VercelInsights } from "./shared/components/VercelInsights";
import { useAuth } from "./context/authSessionContext";

export const CalendarPage = lazy(() => import("./admin/pages/CalendarPage"));
export const CarouselPage = lazy(() => import("./admin/pages/CarouselPage"));
export const CmsShell = lazy(() => import("./admin/layout/CmsShell"));
export const ContentPage = lazy(() => import("./admin/pages/ContentPage"));
export const DashboardPage = lazy(() => import("./admin/pages/DashboardPage"));
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
      className="min-h-[62vh] grid place-items-center"
    >
      <CircularProgress />
    </Box>
  );
}

export function RootRouteLayout() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
      <AdminActionProgress />
      <VercelInsights />
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
