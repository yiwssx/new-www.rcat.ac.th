import { Suspense, lazy } from "react";
import { HeadContent, Outlet, Scripts, useParams, useRouter } from "@tanstack/react-router";
import { projectSettings } from "./config/projectSettings";
import { RouteFallback } from "./shared/components/RouteFallback";
import {
  SSR_CLIENT_ENTRY_MARKER_ATTRIBUTE,
  SSR_CLIENT_STYLESHEET_MARKER_ATTRIBUTE,
  SSR_DOCUMENT_MARKER_ATTRIBUTE,
  SSR_DOCUMENT_MARKER_VALUE,
  resolveSsrClientAssets
} from "./ssrAssets";

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
export const PublicComplaintPage = lazy(() => import("./public/pages/PublicComplaintPage"));
export const PublicContactPage = lazy(() => import("./public/pages/PublicContactPage"));
export const PublicContentDetailPage = lazy(() => import("./public/pages/PublicContentDetailPage"));
export const PublicDepartmentsPage = lazy(() => import("./public/pages/PublicDepartmentsPage"));
export const PublicDocumentsPage = lazy(() => import("./public/pages/PublicDocumentsPage"));
export const PublicHomePage = lazy(() => import("./public/pages/PublicHomePage"));
export const PublicIta2569Page = lazy(() => import("./public/pages/PublicIta2569Page"));
export const PublicNewsPage = lazy(() => import("./public/pages/PublicNewsPage"));
export const PublicSearchPage = lazy(() => import("./public/pages/PublicSearchPage"));
export const ResetPasswordPage = lazy(() => import("./admin/pages/ResetPasswordPage"));
export const SettingsPage = lazy(() => import("./admin/pages/SettingsPage"));
export const UsersPage = lazy(() => import("./admin/pages/UsersPage"));
export const PublicRouteLayout = lazy(() => import("./public/components/PublicShellRouteLayout"));
export const CmsAuthRouteLayout = lazy(() =>
  import("./cmsAuthRouteComponents").then((module) => ({ default: module.CmsAuthRouteLayout }))
);
export const ProtectedLayout = lazy(() =>
  import("./cmsAuthRouteComponents").then((module) => ({ default: module.ProtectedLayout }))
);
export const CapabilityGuard = lazy(() =>
  import("./cmsAuthRouteComponents").then((module) => ({ default: module.CapabilityGuard }))
);

function RouteOutlet() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

function ProductionSsrDocument() {
  const { entryPath, stylesheetPaths } = resolveSsrClientAssets();

  return (
    <html lang={projectSettings.site.language} {...{ [SSR_DOCUMENT_MARKER_ATTRIBUTE]: SSR_DOCUMENT_MARKER_VALUE }}>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#2c7a3f" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href="/rcat-logo-128.png" />
        {stylesheetPaths.map((stylesheetPath) => (
          <link
            key={stylesheetPath}
            rel="stylesheet"
            href={stylesheetPath}
            {...{ [SSR_CLIENT_STYLESHEET_MARKER_ATTRIBUTE]: "true" }}
          />
        ))}
        <HeadContent />
      </head>
      <body>
        <div id="root">
          <RouteOutlet />
        </div>
        <Scripts />
        <script type="module" src={entryPath} {...{ [SSR_CLIENT_ENTRY_MARKER_ATTRIBUTE]: "true" }} />
      </body>
    </html>
  );
}

export function RootRouteLayout() {
  const router = useRouter();

  if (router.options.context.documentMode) {
    return <ProductionSsrDocument />;
  }

  return (
    <>
      <HeadContent />
      <RouteOutlet />
    </>
  );
}

export function PublicContentDetailRoute() {
  const { slug } = useParams({ strict: false }) as { slug: string };

  return <PublicContentDetailPage slug={slug} />;
}
