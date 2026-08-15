import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
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
  PublicComplaintPage,
  PublicContactPage,
  PublicContentDetailRoute,
  PublicDepartmentsPage,
  PublicDocumentsPage,
  PublicHomePage,
  PublicIta2569Page,
  PublicNewsPage,
  PublicRouteLayout,
  PublicSearchPage,
  RootRouteLayout,
  ResetPasswordPage,
  SettingsPage,
  UsersPage
} from "./routeComponents";
import {
  buildPublicRouteHead,
  getCmsRouteHead,
  getPublicContentRouteHead,
  getPublicLayoutRouteHead,
  getRootRouteHead,
  getStaticPublicRouteHead
} from "./public/routing/publicRouteHead";
import {
  getAnnouncementPagesLoaderInput,
  getContentArchiveLoaderInput,
  loadPublicCmsSnapshotData,
  loadPublicContentDetailData,
  loadPublicContentListData,
  loadPublicContentPermalinkData,
  loadPublicDocumentListData,
  loadPublicEventListData,
  loadPublicHomeData,
  loadPublicProgramListData,
  loadPublicSearchIndexData,
  loadPublicSearchResultsData,
  loadPublicShellData
} from "./public/routing/publicRouteLoaders";
import {
  validatePublicAnnouncementsSearch,
  validatePublicFilteredPaginatedSearch,
  validatePublicPaginatedSearch,
  validatePublicSearchRouteSearch
} from "./public/routing/searchParams";
import { dehydrateAppQueryClient, hydrateAppQueryClient } from "./queryHydration";

export interface AppRouterContext {
  queryClient: QueryClient;
  documentMode: boolean;
}

export interface CreateAppRouterInput {
  queryClient: QueryClient;
  documentMode?: boolean;
}

const rootRoute = createRootRouteWithContext<AppRouterContext>()({
  head: getRootRouteHead,
  component: RootRouteLayout,
  notFoundComponent: NotFoundPage
});

const publicLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "public-layout",
  loader: ({ context }) => loadPublicShellData(context),
  head: ({ loaderData }) => getPublicLayoutRouteHead(loaderData),
  component: PublicRouteLayout
});

const publicHomeRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "/",
  loader: ({ context }) => loadPublicHomeData(context),
  head: ({ loaderData, matches }) => getStaticPublicRouteHead("/", undefined, { loaderData, matches }),
  component: PublicHomePage
});

const publicDepartmentsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "departments",
  validateSearch: validatePublicPaginatedSearch,
  loader: ({ context }) => loadPublicProgramListData(context),
  head: ({ match }) => getStaticPublicRouteHead("/departments", match.search),
  component: PublicDepartmentsPage
});

const publicNewsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "news",
  validateSearch: validatePublicFilteredPaginatedSearch,
  loaderDeps: ({ search }) => getContentArchiveLoaderInput(search),
  loader: ({ context, deps }) => loadPublicContentListData(context, "news", undefined, deps),
  head: ({ match }) => getStaticPublicRouteHead("/news", match.search),
  component: PublicNewsPage
});

const publicAnnouncementsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "announcements",
  validateSearch: validatePublicAnnouncementsSearch,
  loaderDeps: ({ search }) => getAnnouncementPagesLoaderInput(search),
  loader: ({ context, deps }) => loadPublicContentListData(context, "announcements", deps),
  head: ({ match }) => getStaticPublicRouteHead("/announcements", match.search),
  component: PublicAnnouncementsPage
});

const publicAchievementsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "achievements",
  validateSearch: validatePublicPaginatedSearch,
  loader: ({ context }) => loadPublicSearchIndexData(context),
  head: ({ match }) => getStaticPublicRouteHead("/achievements", match.search),
  component: PublicAchievementsPage
});

const publicBlogRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "blog",
  validateSearch: validatePublicFilteredPaginatedSearch,
  loaderDeps: ({ search }) => getContentArchiveLoaderInput(search),
  loader: ({ context, deps }) => loadPublicContentListData(context, "blog", undefined, deps),
  head: ({ match }) => getStaticPublicRouteHead("/blog", match.search),
  component: PublicBlogPage
});

const publicDocumentsRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "documents",
  validateSearch: validatePublicPaginatedSearch,
  loader: ({ context }) => loadPublicDocumentListData(context),
  head: ({ match }) => getStaticPublicRouteHead("/documents", match.search),
  component: PublicDocumentsPage
});

const publicCalendarRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "calendar",
  validateSearch: validatePublicPaginatedSearch,
  loader: ({ context }) => loadPublicEventListData(context),
  head: ({ match }) => getStaticPublicRouteHead("/calendar", match.search),
  component: PublicCalendarPage
});

const publicContactRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "contact",
  loader: ({ context }) => loadPublicCmsSnapshotData(context),
  head: () => getStaticPublicRouteHead("/contact"),
  component: PublicContactPage
});

const publicComplaintRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "complaint",
  head: () =>
    buildPublicRouteHead({
      title: "แบบฟอร์มแจ้งเรื่องร้องเรียน",
      description: "กรอกข้อมูลให้ครบถ้วน ระบบจะส่งเรื่องให้ผู้ดูแลทันที",
      canonicalPath: "/complaint",
      robots: "noindex,follow"
    }),
  component: PublicComplaintPage
});

const publicIta2569Route = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "ita2569",
  head: () =>
    buildPublicRouteHead({
      title: "ITA ประจำปีงบประมาณ พ.ศ. 2569",
      description:
        "การเปิดเผยข้อมูลสาธารณะ (OIT) เพื่อการประเมินคุณธรรมและความโปร่งใสในการดำเนินงานของวิทยาลัยเกษตรและเทคโนโลยีร้อยเอ็ด ประจำปีงบประมาณ พ.ศ. 2569",
      canonicalPath: "/ita2569"
    }),
  component: PublicIta2569Page
});

const publicSearchRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "search",
  validateSearch: validatePublicSearchRouteSearch,
  loaderDeps: ({ search }) => ({ query: search.q, page: search.page }),
  loader: ({ context, deps }) => loadPublicSearchResultsData(context, deps),
  head: ({ match, loaderData, matches }) => getStaticPublicRouteHead("/search", match.search, { loaderData, matches }),
  component: PublicSearchPage
});

const publicContentDetailRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "content/$slug",
  loader: ({ context, params }) => loadPublicContentDetailData(context, params.slug),
  head: ({ params, loaderData, matches }) => getPublicContentRouteHead(params.slug, loaderData, { matches }),
  component: PublicContentDetailRoute
});

const publicPermalinkRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "$slug",
  loader: ({ context, params }) => loadPublicContentPermalinkData(context, params.slug),
  head: ({ params, loaderData, matches }) => getPublicContentRouteHead(params.slug, loaderData, { matches }),
  component: PublicContentDetailRoute
});

const cmsAuthLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "cms-auth-layout",
  head: getCmsRouteHead,
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
  component: DashboardPage
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

const adminMediaRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "media",
  component: () => (
    <CapabilityGuard capability="media.read">
      <MediaPage />
    </CapabilityGuard>
  )
});

const adminMenuRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "menu",
  component: () => (
    <CapabilityGuard capability="menu.read">
      <MenuPage />
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

const adminCalendarRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "calendar",
  component: () => (
    <CapabilityGuard capability="calendar.read">
      <CalendarPage />
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

const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "users",
  component: () => (
    <CapabilityGuard capability="users.read">
      <UsersPage />
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

const adminIntegrationsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "integrations",
  component: () => (
    <CapabilityGuard capability="integrations.read">
      <IntegrationsPage />
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

const adminBackupRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "backup",
  component: () => (
    <CapabilityGuard capability="backup.read">
      <BackupPage />
    </CapabilityGuard>
  )
});

const adminAccountSecurityRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "account-security",
  component: AccountSecurityPage
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
    publicComplaintRoute,
    publicIta2569Route,
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
      adminMediaRoute,
      adminMenuRoute,
      adminCarouselRoute,
      adminCalendarRoute,
      adminDocumentsRoute,
      adminUsersRoute,
      adminSettingsRoute,
      adminIntegrationsRoute,
      adminExternalServicesRoute,
      adminBackupRoute,
      adminAccountSecurityRoute
    ])
  ])
]);

export function createAppRouter(input: CreateAppRouterInput) {
  const router = createRouter({
    routeTree,
    context: {
      queryClient: input.queryClient,
      documentMode: input.documentMode ?? false
    },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultPendingMs: 150,
    defaultPendingMinMs: 250,
    defaultNotFoundComponent: NotFoundPage
  });

  return router;
}

export function hydrateAppRouterQueryClient(queryClient: QueryClient, dehydratedState: unknown) {
  hydrateAppQueryClient(queryClient, dehydratedState);
}

export function dehydrateAppRouterQueryClient(queryClient: QueryClient) {
  return dehydrateAppQueryClient(queryClient);
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
