> Historical record — checkpoint 2026-05-23 at commit `67fa65a82d6df421bc98f5018c08719b0d43b408`. Measurements and runtime statements below are preserved as historical evidence, not current state. Current source of truth: [M20 cleanup runtime ownership](./m20-cleanup-runtime-ownership.md).

# Project Simplification Audit

Date: 2026-05-23

Status: architecture documentation only. This audit does not change production code, runtime behavior, Apps Script behavior, auth, analytics, site-view tracking, public cache behavior, carousel, IntroGate, urgent marquee, or CMS schema.

Related release report: [`docs/releases/stabilization-release-2026-05-23.md`](../releases/stabilization-release-2026-05-23.md).

## Executive Summary

The project is not failing because it uses the wrong stack. It is becoming risky because one repository now owns the public website, CMS admin, Google Apps Script API, spreadsheet storage model, Drive/Docs integration, analytics, site-view tracking, public caches, and styling boundaries.

The right move is not a rewrite. The near-term goal should be stabilization: fix visible UX defects, keep high-frequency public behavior stable, document ownership, and reduce the number of files a future feature must touch. Apps Script and the combined React app can remain in place while responsibilities are made clearer.

## Feature Inventory

| Feature                          | Frontend files                                                                                                                                                            | Backend Apps Script resources/functions                                                                                                          | Sheet/storage used                                                                                            | Cache behavior                                                                                                   | Scope                  | Risk                                                                                                    | Test coverage                                                                                                                                                                                | Class    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Public website shell             | `src/public/components/PublicSiteShell.tsx`, `PublicMainMenu.tsx`, `FloatingMessengerButton.tsx`, `src/public/hooks/usePublicCmsSnapshot.ts`, `src/routes.tsx`            | `GET snapshot`, `GET menu`, `getSnapshot()`, `getMenu()`, `getSiteSettings()`                                                                    | `Menu`, `Settings.siteSettings`, `Settings.homepageSettings`, `Settings.displaySettings`                      | Apps Script `snapshot`/`menu` cache wrappers; frontend public CMS cache                                          | Public                 | High: shell fetch, SEO, menu, intro gate, Messenger, footer, and search all meet here                   | `publicDataDrivenPages.test.tsx`, `homepageSettingsComponents.test.tsx`, `publicCmsCache.test.ts`, `appsScriptCode.test.ts`                                                                  | Core     |
| Homepage                         | `src/public/pages/PublicHomePage.tsx`, `src/public/components/home/*`, `usePublicHomeSnapshot.ts`                                                                         | `GET public-home`, `getPublicHomeSnapshotCached()`, `getPublicHomeSnapshot()`                                                                    | `Content`, `Carousel`, `ExternalServices`, `Media`, `Events`, `Documents`, `Menu`, `Settings`, `VisitorStats` | Apps Script `cms:public:home:v1`; frontend `rcat.cms.public.home`; invalidated by broad public CMS writes        | Public                 | High: broadest public payload and strongest cross-feature coupling                                      | `publicDataDrivenPages.test.tsx`, `homepageSettingsComponents.test.tsx`, `appsScriptCms.test.ts`, `appsScriptDocuments.test.ts`, `appsScriptCache.test.ts`                                   | Core     |
| Carousel                         | `PublicHomeCarousel.tsx`, `src/admin/pages/CarouselPage.tsx`, carousel settings in `SettingsPage.tsx`                                                                     | `POST carousel`, `POST carousel-delete`, `getCarouselSlides()`, `upsertCarouselSlide()`, `deleteCarouselSlide()`                                 | `Carousel`, `Settings.homepageSettings.carousel`                                                              | Public home/snapshot invalidated on carousel writes; client receives carousel through public-home                | Public/Admin           | Medium: visible homepage feature with autoplay/image priority rules                                     | `publicHomeCarouselRegression.test.tsx`, `homepageSettingsComponents.test.tsx`, `carouselPage.test.ts`, `appsScriptCms.test.ts`, `appsScriptCode.test.ts`                                    | Core     |
| IntroGate                        | `PublicIntroGate.tsx`, `PublicSiteShell.tsx`, `SettingsPage.tsx`, `homepageSettings.ts`                                                                                   | `POST homepage-settings`, `getHomepageSettings()`, `updateHomepageSettings()`                                                                    | `Settings.homepageSettings.introGate`; browser `sessionStorage` dismissal                                     | Included in public snapshots/home; homepage settings writes invalidate public cache                              | Public/Admin           | Medium: global overlay can block entry if settings or image handling regress                            | `PublicIntroGateRegression.test.tsx`, `homepageSettingsComponents.test.tsx`, `appsScriptStorage.test.ts`, `appsScriptCode.test.ts`                                                           | Optional |
| Urgent marquee                   | `UrgentMarqueeSection.tsx`, `SettingsPage.tsx`, `homepageSettings.ts`                                                                                                     | `POST homepage-settings`, homepage settings normalization                                                                                        | `Settings.homepageSettings.marquee`                                                                           | Included in public-home and public snapshots; invalidated on homepage settings writes                            | Public/Admin           | Medium: small feature, but highly visible and motion-sensitive                                          | `homepageSettingsComponents.test.tsx`, `homepageSettings.test.ts`, `appsScriptStorage.test.ts`                                                                                               | Optional |
| Public content lists             | `PublicNewsPage.tsx`, `PublicAnnouncementsPage.tsx`, `PublicBlogPage.tsx`, `PublicContentCard.tsx`, `usePublicContentList.ts`                                             | `GET public-content-list`, `getPublicContentListSnapshotCached()`, `getPublicContentListSnapshot()`                                              | `Content`, referenced `Media`, `Settings`, `Menu`                                                             | Apps Script per-kind cache; frontend per-kind local cache; invalidated by content/media/settings/menu writes     | Public                 | High: route-level public API, shared content model, tag filters, and media references                   | `publicDataDrivenPages.test.tsx`, `appsScriptCms.test.ts`, `appsScriptCache.test.ts`, `appsScriptCode.test.ts`, `googleApi.integration.test.ts`                                              | Core     |
| Content detail                   | `PublicContentDetailPage.tsx`, `ContentBlocksRenderer.tsx`, `usePublicContentDetail.ts`, `routeComponents.tsx`                                                            | `GET content-detail`, `POST content-view`, `getPublicContentDetailCached()`, `getContentDetail()`, `incrementContentView()`                      | `Content`, `Media`, Google Docs body storage via `bodyDocId`                                                  | Detail cache is versioned; content-view intentionally does not invalidate public snapshots                       | Public/Admin editor    | High: content rendering, view counting, Docs-backed body storage, and public cache versioning meet here | `publicContentDetailPage.test.tsx`, `publicContentDetailRegression.test.tsx`, `contentBlocksRenderer.test.tsx`, `appsScriptCms.test.ts`, `appsScriptCache.test.ts`, `appsScriptCode.test.ts` | Core     |
| CMS admin                        | `src/admin/layout/CmsShell.tsx`, `src/admin/pages/*`, `src/admin/components/*`, `AdminActionProgress.tsx`                                                                 | `POST snapshot-admin`, admin write resources for content, documents, carousel, external services, media, events, menu, settings, users           | All CMS sheets plus Drive/Docs for media/content body                                                         | Admin writes invalidate public caches where public output can change                                             | Admin                  | High: many features share one shell, one admin snapshot, one API adapter, and broad write permissions   | `router-auth.integration.test.tsx`, `googleApi.integration.test.ts`, `appsScriptCode.test.ts`, page/service-specific unit tests                                                              | Core     |
| Auth/session                     | `AuthContext.tsx`, `authSessionContext.ts`, `LoginPage.tsx`, `ProtectedLayout`, `AdminOnlyPage`, `services/auth.ts`, `services/users.ts`                                  | `POST auth-login`, `Users.gs`, token validation, role checks in `Code.gs`                                                                        | `Users`, `PropertiesService.authTokenSecret`, browser session storage                                         | No public cache invalidation; login rate limiting uses Apps Script cache/service state                           | Admin                  | High: security boundary for all CMS writes                                                              | `appsScriptCode.test.ts`, `appsScriptStorage.test.ts`, `googleApi.integration.test.ts`, `router-auth.integration.test.tsx`                                                                   | Core     |
| Media/Drive integration          | `MediaPage.tsx`, `ContentEditorDialog.tsx`, `ContentBlocksRenderer.tsx`, `googleApi.ts`, `safeUrl.ts`                                                                     | `POST media`, `POST media-delete`, `upsertMedia()`, `deleteMedia()`, `createDriveFile()`, folder helpers, content body Docs helpers              | `Media`, Drive files/folders, Docs folder, `Settings` folder ids                                              | Media writes broadly invalidate public caches because media can appear on many surfaces                          | Admin/Public rendering | High: Drive permissions, upload validation, public URL safety, and content rendering are coupled        | `appsScriptCms.test.ts`, `facebookEmbedRegression.test.tsx`, `contentBlocksRenderer.test.tsx`, `googleApi.integration.test.ts`                                                               | Support  |
| External services                | `ExternalServicesSection.tsx`, `src/admin/pages/ExternalServicesPage.tsx`, `externalServiceTheme.ts`                                                                      | `POST external-service`, `POST external-service-delete`, `getExternalServices()`, `upsertExternalService()`, `deleteExternalService()`           | `ExternalServices`                                                                                            | Public home/snapshot invalidated on writes                                                                       | Public/Admin           | Medium: icon/category styling and admin ordering add UI breadth                                         | `homepageSettingsComponents.test.tsx`, `appsScriptCms.test.ts`, `appsScriptCode.test.ts`                                                                                                     | Support  |
| Site settings                    | `SettingsPage.tsx`, `PublicSiteShell.tsx`, `HomeHeroSection.tsx`, `ContactMapCard.tsx`, `siteSettings.ts`                                                                 | `POST site-settings`, `SiteSettings.gs`, `getSiteSettings()`, `updateSiteSettings()`                                                             | `Settings.siteSettings`                                                                                       | Included in public snapshots/home/list surfaces; writes invalidate public caches                                 | Public/Admin           | High: controls shell, contact, SEO, Messenger, footer, map, and hero data                               | `siteSettings.test.ts`, `appsScriptStarterSeed.test.ts`, `publicDataDrivenPages.test.tsx`, `appsScriptCode.test.ts`                                                                          | Core     |
| Homepage settings                | `SettingsPage.tsx`, `PublicHomePage.tsx`, `PublicIntroGate.tsx`, `UrgentMarqueeSection.tsx`, `HomeIntroVideoSection.tsx`, `PublicHomeCarousel.tsx`, `homepageSettings.ts` | `POST homepage-settings`, `getHomepageSettings()`, `updateHomepageSettings()`                                                                    | `Settings.homepageSettings`                                                                                   | Included in public snapshots/home; writes invalidate public caches                                               | Public/Admin           | High: one settings object controls several first-page modules                                           | `homepageSettings.test.ts`, `homepageSettingsComponents.test.tsx`, `appsScriptStorage.test.ts`, `appsScriptCode.test.ts`                                                                     | Support  |
| Visitor stats/site view tracking | `VisitorStatsCard.tsx`, `PublicSiteViewTracker.tsx`, `siteViewTracking.ts`, `visitorStats.ts`, `SettingsPage.tsx`                                                         | `POST site-view`, `POST visitor-stats`, `incrementSiteView()`, `getVisitorStatsSettings()`, `updateVisitorStatsSettings()`                       | `VisitorStats`, `Settings.visitorStats`, browser `localStorage` visitor id/throttle                           | `site-view` intentionally does not invalidate public cache; admin visitor stats settings invalidate public cache | Public/Admin           | High: high-frequency public event must stay decoupled from snapshot rebuilds                            | `siteViewTracking.test.ts`, `publicSiteViewTracker.test.tsx`, `visitorStats.test.ts`, `homepageSettingsComponents.test.tsx`, `appsScriptStorage.test.ts`, `appsScriptCode.test.ts`           | Support  |
| Public API cache diagnostics     | Docs only in UI; public API supports `debugPerformance=1`                                                                                                                 | `Cache.gs`, `getPublicSnapshotCached()`, `getPublicHomeSnapshotCached()`, public list/detail cache wrappers                                      | Apps Script `CacheService`, `PropertiesService` content-detail cache version                                  | Normal responses hide diagnostics; debug responses expose safe cache hit/miss and payload metadata               | Public API/support     | Medium: helpful but easy to couple to production behavior if expanded carelessly                        | `appsScriptCache.test.ts`, `appsScriptCode.test.ts`, `publicCmsCache.test.ts`                                                                                                                | Support  |
| Analytics/Vercel insights        | `PublicAnalytics.tsx`, `VercelInsights.tsx`, `publicAnalytics.ts`, `routeComponents.tsx`                                                                                  | None in Apps Script                                                                                                                              | Browser scripts, Vercel analytics, optional GA/GTM env config                                                 | No CMS cache behavior; route guard excludes login/admin                                                          | Public/support         | Medium: global side effect in root layout; privacy and route filtering must stay explicit               | `publicAnalytics.test.ts`, route-level tests through root components                                                                                                                         | Support  |
| Public documents                 | `src/admin/pages/DocumentsPage.tsx`, `DocumentListCard.tsx`, `publicDocumentListCache.ts`, `PublicHomePage.tsx`                                                           | `GET public-document-list`, `POST document`, `POST document-delete`, `getDocuments()`, `getPublicDocuments()`, `getPublicDocumentListSnapshot()` | `Documents`, optional linked `Media`; Drive file URLs                                                         | Dedicated Apps Script document-list cache plus frontend local cache; document writes invalidate public caches    | Public/Admin           | Medium: dedicated module exists, but full public `/documents` archive is still deferred                 | `appsScriptDocuments.test.ts`, `publicCardLayoutRegression.test.tsx`, `publicCmsCache.test.ts`, `googleApi.integration.test.ts`, `router-auth.integration.test.tsx`                          | Support  |
| MUI/Tailwind styling system      | `src/theme.ts`, `src/styles.css`, MUI `sx` in public/admin components, `docs/design/mui-tailwind-boundary.md`                                                             | None                                                                                                                                             | CSS variables, MUI theme, Tailwind generated CSS                                                              | No data cache behavior                                                                                           | Cross-cutting          | Medium: two styling systems are acceptable, but boundary drift can create regressions                   | `mui-tailwind-icons-audit-2026-05-23.md`, visual/layout regression tests                                                                                                                     | Support  |

## God-Project Risks

### Root Layout Does Too Much

`src/routeComponents.tsx` is not just route composition. The root layout renders route content, admin action progress, public analytics, public site-view tracking, and Vercel insights. Those are valid features, but their shared location means changes to analytics, route guards, admin progress, or public tracking can affect every route.

Preferred direction: keep global effects small, explicitly route-guarded, and documented. Avoid adding new global side effects to the root without a short justification.

### Apps Script Routing Does Too Much

`apps-script/Code.gs` is a central string router for public GETs, public POSTs, authenticated admin reads, authenticated admin writes, role checks, lock acquisition, and debug cache options. Adding a feature currently requires editing resource constants, auth classification, switch branches, and tests in the same central file.

Preferred direction: keep `Code.gs` as the thin HTTP boundary over time, and move feature ownership into clearly named functions/files where practical.

### Storage.gs Does Too Much

`apps-script/Storage.gs` owns spreadsheet setup access, settings reads/writes, display/homepage/visitor settings, visitor stats counting, site-view throttling, generic row helpers, Drive folder lookup, and dashboard metrics. This makes storage changes hard to review because unrelated responsibilities live together.

Preferred direction: do not rewrite it now, but treat storage responsibilities as separate conceptual modules: settings storage, visitor stats storage, generic sheet helpers, Drive/folder helpers, and metrics.

### Shared Types Are Becoming Too Broad

`src/types.ts` is a single cross-feature contract for admin users, CMS content, documents, carousel, services, media, events, menus, settings, public snapshots, visitor stats, display settings, and dashboard metrics. This makes every new feature feel like it belongs in the same global type namespace.

Preferred direction: keep public API contracts stable, but consider feature-local type files later. Start by documenting ownership before moving types.

### Public-Home Snapshot Is Too Broad

`PublicHomeSnapshot` contains shell settings, homepage settings, display settings, menu, carousel slides, external services, visitor stats, multiple content categories, programs, documents, events, media, and generation metadata. It is efficient for one request, but it couples many unrelated invalidation paths to the homepage.

Preferred direction: keep current cache behavior stable now. Later, split only if measurements show payload size, invalidation, or ownership pain.

### CMS Admin Is Becoming Too Broad

The admin app now covers content, documents, carousel, external services, media, calendar/events, menus, integrations, site settings, homepage settings, visitor stats settings, users, and dashboard metrics. That is operationally useful, but it increases the blast radius of admin navigation, auth, and snapshot changes.

Preferred direction: keep one CMS, but document per-module ownership and avoid routing every future feature through a larger shared admin snapshot if a smaller resource is enough.

### Global Styling Drift

The MUI/Tailwind combination is workable and documented, but drift can happen when components add hardcoded greens/yellows, duplicate card surfaces, or use Tailwind classes to fight MUI internals.

Preferred direction: follow `docs/design/mui-tailwind-boundary.md`; use MUI theme/`sx` inside MUI components and RCAT/Tailwind classes for broad page structure.

### Cache Invalidation Coupling

`invalidatePublicSnapshotCache()` clears many public cache keys at once and bumps the content-detail cache version. This is safe and simple, but broad. High-frequency public events such as `site-view` and `content-view` intentionally do not invalidate public snapshots, and that boundary is essential.

Preferred direction: keep broad invalidation for editorial writes. Never add cache invalidation to high-frequency public events.

### Feature Additions Touch Too Many Files

A new public/admin feature often needs changes in `src/types.ts`, `project-settings.json`, `googleApi.ts`, route files, admin navigation, Apps Script `Code.gs`, `Config.gs`, `Cms.gs` or `Storage.gs`, cache tests, API integration tests, and docs. That is the clearest "god project" signal.

Preferred direction: require a short feature RFC for new modules that add sheets, routes, global settings, dependencies, or public cache behavior.

## Simplification Roadmap

### P0 - Stabilize Now

- Fix visible UX bugs only until the current public homepage feels stable on mobile and desktop.
- Close or verify the urgent marquee animation fix in normal browser settings.
- Close or verify the `VisitorStatsCard` mobile layout fix and Messenger safe spacing.
- Freeze heavy new feature work temporarily, especially public documents expansion beyond the current homepage/admin support.
- Keep site-view and public cache behavior stable; do not invalidate snapshots from public view tracking.
- Use `docs/deployment/apps-script-deployment-checklist.md` for every backend-affecting release and confirm the production web app deployment version after deploys.

### P1 - Modularize Without Rewriting

- Split architecture docs by feature ownership: public shell, homepage, content, documents, admin CMS, settings, auth, cache, analytics, and visitor stats.
- Introduce a lightweight module ownership table so future changes start in the right files.
- Reduce cross-feature imports where possible; avoid public components depending on admin helpers and avoid admin pages depending on public rendering details.
- Treat public API resources as separate conceptual products: shell snapshot, public-home, content list, content detail, document list, program list, search index, and tracking events.
- Isolate Apps Script responsibilities conceptually before moving code: content/document CMS, settings, visitor stats, cache, users/auth, menu, and Drive/Docs.
- Add a per-feature change checklist covering frontend files, backend route, sheet/storage, cache invalidation, tests, and docs.

### P2 - Reduce Technical Debt

- Trim unused dependencies through audit-backed removals only.
- Consider unused import tooling later, after UX stabilization, because it can create broad cleanup churn.
- Simplify public-home payload strategy only if measured payload size, cache miss behavior, or ownership pain justifies it.
- Reduce duplicated card styling by reusing RCAT utility classes and MUI theme patterns where they already exist.
- Continue standardizing MUI/Tailwind boundaries and avoid adding a third styling system.

### P3 - Future Architecture

- Consider a real backend/database only if Apps Script limits become measurable blockers: quota pressure, slow writes, concurrency limits, schema evolution pain, or hard-to-debug deployments.
- Consider separating public site and CMS admin only if team workflow or deployment risk demands it. Do not split repos just because the repo feels large.
- Consider moving analytics or visitor stats to a dedicated service only if scale, privacy requirements, or reporting needs exceed the current lightweight model.

## Future Feature Guardrails

- No new sheet without a short feature RFC that names owner, schema, migration/setup step, admin surface, public surface, and cache invalidation behavior.
- No new global provider, route-level side effect, or root layout behavior without explicit justification.
- No cache invalidation from high-frequency public events such as page views, content views, pings, or analytics callbacks.
- No new dependency without an audit of current alternatives, bundle/runtime risk, and removal plan if unused.
- No new styling system. Use MUI and RCAT/Tailwind within the documented boundary.
- Tests are required for public UI changes, admin workflow changes, Apps Script route changes, cache behavior, and storage/schema changes.
- Every new public API resource should state whether it is public/admin, GET/POST, cached/uncached, authenticated/unauthenticated, and cache-invalidating/non-invalidating.
- Every new settings key should define defaults, normalization, admin ownership, public visibility, and deployment/backfill behavior.

## Do Not Do

- Do not rewrite the app.
- Do not remove MUI.
- Do not remove Tailwind.
- Do not split repositories yet.
- Do not move off Apps Script immediately.
- Do not add more tooling before stabilizing visible UX bugs.
- Do not redesign the homepage while fixing targeted layout or animation defects.
- Do not change tracking, analytics, auth, public cache, or CMS schema as part of simplification documentation.

## Recommended Next 5 Tasks

1. Verify the urgent marquee animation fix in a normal browser and with reduced-motion enabled.
2. Verify the `VisitorStatsCard` mobile layout fix with the floating Messenger button enabled.
3. Use the Apps Script deployment checklist for every backend-affecting release: `docs/deployment/apps-script-deployment-checklist.md`.
4. Review this feature inventory with the project owner and mark each feature as core, support, optional, or deferred.
5. Continue the public documents module only after stabilization, starting with an explicit decision on whether a public `/documents` archive is needed.

## Stabilization Definition

The project is stable enough for new feature work when:

- Public homepage visible defects are closed on mobile, tablet, and desktop.
- Apps Script deployment steps are repeatable and documented.
- Public cache behavior is understood and not being changed incidentally.
- New feature requests can be mapped to an owner, sheet/storage, API resource, cache behavior, and test file before implementation starts.
- Styling changes follow the MUI/Tailwind boundary without introducing new global patterns.
