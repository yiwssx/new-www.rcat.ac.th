import { Suspense, lazy } from "react";
import { Outlet, useParams } from "@tanstack/react-router";
import { PublicAnalytics } from "./shared/components/PublicAnalytics";
import { RouteFallback } from "./shared/components/RouteFallback";
import { PublicSiteViewTracker } from "./features/site-view";
import { VercelInsights } from "./shared/components/VercelInsights";

export const AccountSecurityPage = lazy(() => import("./admin/pages/AccountSecurityPage"));
export const ActivateAccountPage = lazy(() => import("./admin/pages/ActivateAccountPage"));
export const CalendarPage = lazy(() => import("./admin/pages/CalendarPage"));
export const BackupPage = lazy(() => import("./admin/pages/BackupPage"));
export const CarouselPage = lazy(() => import("./admin/pages/CarouselPage"));
export const ContentPage = lazy(() => import("./admin/pages/ContentPage"));
export const DashboardPage = lazy(() => import("./admin/pages/DashboardPage"));
export const DocumentsPage = lazy(() => import("./admin/pages/DocumentsPage"));
export const ExternalServicesPage = lazy(() => import("./admin/pages/ExternalServicesPage"));
export const IntegrationsPage = lazy(() => import("./admin/pages/IntegrationsPage"));
export const LoginPage = lazy(() => import("./admin/pages/LoginPage"));
export const MediaPage = lazy(() => import("./admin/pages/MediaPage"));
export const MenuPage = lazy(() => import("./admin/pages/MenuPage"));
export const NotFoundPage = lazy(() => import("./shared/pages/NotFoundPage"));
export const PublicAchievementsPage = lazy(() => import("./public/pages/PublicAchievementsPage"));
export const PublicAnnouncementsPage = lazy(() => import("./public/pages/PublicAnnouncementsPage"));
export const PublicBlogPage = lazy(() => import("./public/pages/PublicBlogPage"));
export const PublicCalendarPage = lazy(() => import("./public/pages/PublicCalendarPage"));
export const PublicContactPage = lazy(() => import("./public/pages/PublicContactPage"));
export const PublicContentDetailPage = lazy(() => import("./public/pages/PublicContentDetailPage"));
export const PublicDepartmentsPage = lazy(() => import("./public/pages/PublicDepartmentsPage"));
export const PublicDocumentsPage = lazy(() => import("./public/pages/PublicDocumentsPage"));
export const PublicHomePage = lazy(() => import("./public/pages/PublicHomePage"));
export const PublicNewsPage = lazy(() => import("./public/pages/PublicNewsPage"));
export const PublicSearchPage = lazy(() => import("./public/pages/PublicSearchPage"));
export const ResetPasswordPage = lazy(() => import("./admin/pages/ResetPasswordPage"));
export const SettingsPage = lazy(() => import("./admin/pages/SettingsPage"));
export const UsersPage = lazy(() => import("./admin/pages/UsersPage"));
export const CmsAuthRouteLayout = lazy(() =>
  import("./cmsAuthRouteComponents").then((module) => ({ default: module.CmsAuthRouteLayout }))
);
export const ProtectedLayout = lazy(() =>
  import("./cmsAuthRouteComponents").then((module) => ({ default: module.ProtectedLayout }))
);
export const CapabilityGuard = lazy(() =>
  import("./cmsAuthRouteComponents").then((module) => ({ default: module.CapabilityGuard }))
);

export function RootRouteLayout() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
      <VercelInsights />
    </>
  );
}

export function PublicRouteLayout() {
  return (
    <>
      <Outlet />
      <PublicAnalytics />
      <PublicSiteViewTracker />
    </>
  );
}

export function PublicContentDetailRoute() {
  const { slug } = useParams({ strict: false }) as { slug: string };

  return <PublicContentDetailPage slug={slug} />;
}
