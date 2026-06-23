import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import {
  CalendarPage,
  CarouselPage,
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
  PublicAnnouncementsPage,
  PublicBlogPage,
  PublicContactPage,
  PublicContentDetailRoute,
  PublicDepartmentsPage,
  PublicHomePage,
  PublicNewsPage,
  PublicSearchPage,
  RootRouteLayout,
  SettingsPage,
  UsersPage
} from "./routeComponents";

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

const publicSearchRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: "search",
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

const adminDocumentsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "documents",
  component: DocumentsPage
});

const adminCarouselRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "carousel",
  component: CarouselPage
});

const adminExternalServicesRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "external-services",
  component: ExternalServicesPage
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
  component: MenuPage
});

const adminIntegrationsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "integrations",
  component: IntegrationsPage
});

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "settings",
  component: SettingsPage
});

const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "users",
  component: UsersPage
});

const routeTree = rootRoute.addChildren([
  publicLayoutRoute.addChildren([
    publicHomeRoute,
    publicDepartmentsRoute,
    publicNewsRoute,
    publicAnnouncementsRoute,
    publicBlogRoute,
    publicContactRoute,
    publicSearchRoute,
    publicContentDetailRoute,
    publicPermalinkRoute,
    loginRoute
  ]),
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
    adminUsersRoute
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
