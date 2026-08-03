import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import {
  AccountSecurityPage,
  ActivateAccountPage,
  BackupPage,
  CalendarPage,
  CapabilityGuard,
  CarouselPage,
  CmsAuthRouteLayout,
  ContentPage,
  DashboardPage,
  DocumentsPage,
  ExternalServicesPage,
  IntegrationsPage,
  LoginPage,
  MediaPage,
  MenuPage,
  NotFoundPage,
  ProtectedLayout,
  PublicAchievementsPage,
  PublicAnnouncementsPage,
  PublicBlogPage,
  PublicCalendarPage,
  PublicContactPage,
  PublicContentDetailRoute,
  PublicDepartmentsPage,
  PublicDocumentsPage,
  PublicHomePage,
  PublicNewsPage,
  PublicRouteLayout,
  PublicSearchPage,
  RootRouteLayout,
  ResetPasswordPage,
  SettingsPage,
  UsersPage
} from "./routeComponents";
import {
  validatePublicAnnouncementsSearch,
  validatePublicFilteredPaginatedSearch,
  validatePublicPaginatedSearch,
  validatePublicSearchRouteSearch
} from "./public/routing/searchParams";

const rootRoute = createRootRoute({
  component: RootRouteLayout,
  notFoundComponent: NotFoundPage
});

const publicLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "public-layout",
  component: PublicRouteLayout
});

const publicHomeRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/",
  component: PublicHomePage
});

const publicDepartmentsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "departments",
  validateSearch: validatePublicPaginatedSearch,
  component: PublicDepartmentsPage
});

const publicNewsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "news",
  validateSearch: validatePublicFilteredPaginatedSearch,
  component: PublicNewsPage
});

const publicAnnouncementsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "announcements",
  validateSearch: validatePublicAnnouncementsSearch,
  component: PublicAnnouncementsPage
});

const publicAchievementsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "achievements",
  validateSearch: validatePublicPaginatedSearch,
  component: PublicAchievementsPage
});

const publicBlogRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "blog",
  validateSearch: validatePublicPaginatedSearch,
  component: PublicBlogPage
});

const publicDocumentsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "documents",
  validateSearch: validatePublicPaginatedSearch,
  component: PublicDocumentsPage
});

const publicCalendarRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "calendar",
  validateSearch: validatePublicPaginatedSearch,
  component: PublicCalendarPage
});

const publicContactRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "contact",
  component: PublicContactPage
});

const publicSearchRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "search",
  validateSearch: validatePublicSearchRouteSearch,
  component: PublicSearchPage
});

const publicContentDetailRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "content/$slug",
  component: PublicContentDetailRoute
});

const publicPermalinkRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "$slug",
  component: PublicContentDetailRoute
});

const cmsAuthLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "cms-auth-layout",
  component: CmsAuthRouteLayout
});

const loginRoute = createRoute({
  getParentRoute: () => cmsAuthLayoutRoute,
  path: "login",
  component: LoginPage
});

const activateAccountRoute = createRoute({
  getParentRoute: () => cmsAuthLayoutRoute,
  path: "activate-account",
  component: ActivateAccountPage
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => cmsAuthLayoutRoute,
  path: "reset-password",
  component: ResetPasswordPage
});

const adminRoute = createRoute({
  getParentRoute: () => cmsAuthLayoutRoute,
  path: "admin",
  component: ProtectedLayout
});

const adminDashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: () => (
    <CapabilityGuard capability="dashboard.read">
      <DashboardPage />
    </CapabilityGuard>
  )
});

const adminContentRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "content",
  component: () => (
    <CapabilityGuard capability="content.read">
      <ContentPage />
    </CapabilityGuard>
  )
});

const adminDocumentsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "documents",
  component: () => (
    <CapabilityGuard capability="documents.read">
      <DocumentsPage />
    </CapabilityGuard>
  )
});

const adminCarouselRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "carousel",
  component: () => (
    <CapabilityGuard capability="carousel.read">
      <CarouselPage />
    </CapabilityGuard>
  )
});

const adminExternalServicesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "external-services",
  component: () => (
    <CapabilityGuard capability="external-services.read">
      <ExternalServicesPage />
    </CapabilityGuard>
  )
});

const adminMediaRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "media",
  component: () => (
    <CapabilityGuard capability="media.read">
      <MediaPage />
    </CapabilityGuard>
  )
});

const adminCalendarRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "calendar",
  component: () => (
    <CapabilityGuard capability="events.read">
      <CalendarPage />
    </CapabilityGuard>
  )
});

const adminMenuRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "menus",
  component: () => (
    <CapabilityGuard capability="menu.read">
      <MenuPage />
    </CapabilityGuard>
  )
});

const adminIntegrationsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "integrations",
  component: () => (
    <CapabilityGuard capability="media.read">
      <IntegrationsPage />
    </CapabilityGuard>
  )
});

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "settings",
  component: () => (
    <CapabilityGuard capability="settings.read">
      <SettingsPage />
    </CapabilityGuard>
  )
});

const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "users",
  component: () => (
    <CapabilityGuard capability="users.read-all">
      <UsersPage />
    </CapabilityGuard>
  )
});

const adminBackupRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "backup",
  component: () => (
    <CapabilityGuard anyOf={["backup.counts", "backup.download"]}>
      <BackupPage />
    </CapabilityGuard>
  )
});

const adminAccountSecurityRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "account/security",
  component: () => (
    <CapabilityGuard
      anyOf={["users.read-self", "auth.change-password-self", "auth.reauthenticate-self", "auth.mfa.manage-self"]}
    >
      <AccountSecurityPage />
    </CapabilityGuard>
  )
});

const routeTree = rootRoute.addChildren([
  publicLayoutRoute.addChildren([
    publicHomeRoute,
    publicDepartmentsRoute,
    publicNewsRoute,
    publicAnnouncementsRoute,
    publicAchievementsRoute,
    publicBlogRoute,
    publicDocumentsRoute,
    publicCalendarRoute,
    publicContactRoute,
    publicSearchRoute,
    publicContentDetailRoute,
    publicPermalinkRoute
  ]),
  cmsAuthLayoutRoute.addChildren([
    loginRoute,
    activateAccountRoute,
    resetPasswordRoute,
    adminRoute.addChildren([
      adminDashboardRoute,
      adminContentRoute,
      adminDocumentsRoute,
      adminCarouselRoute,
      adminExternalServicesRoute,
      adminMediaRoute,
      adminCalendarRoute,
      adminMenuRoute,
      adminIntegrationsRoute,
      adminSettingsRoute,
      adminUsersRoute,
      adminBackupRoute,
      adminAccountSecurityRoute
    ])
  ])
]);

export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent"
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
