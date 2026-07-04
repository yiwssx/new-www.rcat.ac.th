# Structural Refactor Plan - 2026-05-23

> Historical note, 2026-07-04: This plan describes a previous Apps Script-centered migration state and is not the current runtime source of truth. Current runtime ownership has advanced: structured public/admin data uses Cloudflare Worker + D1, Apps Script is retained only for the Vercel-proxied Google Drive media/file bridge, cleanup is completed, preview field verification is in progress, and M20 production cutover remains gated.

This is a documentation-only plan for reducing structural risk in the RCAT public website, CMS admin, and Apps Script backend. It does not propose a rewrite, framework migration, schema change, API response change, cache behavior change, or UI redesign.

## Goals

- Identify oversized files and mixed responsibilities.
- Define safe target modules for incremental refactors.
- Sequence work so each pull request can be reviewed, tested, deployed, and rolled back independently.
- Preserve current runtime behavior while reducing future change risk.

## Non-Goals

- No production code changes in this audit.
- No file moves in this audit.
- No dependency changes.
- No Apps Script behavior changes.
- No changes to auth, analytics, site-view tracking, public cache, urgent marquee, public documents, CMS schema, routing, or UI.

## Oversized File Inventory

| File                                        | Current responsibility                                                                                                                                                                                                                                      | Mixed concerns                                                                                                                                          | Approx. risk | Recommended target modules                                                                                                                                                                                                | Timing                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps-script/Cms.gs`                        | CMS setup, public snapshots, content CRUD, document CRUD, carousel, external services, events, publishing, media normalization, Drive/Docs helpers, public record sanitization.                                                                             | Public read models, admin writes, content validation, document storage, snapshot assembly, Drive/Docs behavior, and data-shaping helpers live together. | High         | `Cms.Content.gs`, `Cms.Documents.gs`, `Cms.PublicSnapshots.gs`, later smaller files such as `Cms.Media.gs`, `Cms.Events.gs`, and `Cms.ExternalServices.gs` if needed.                                                     | Later, after lower-risk storage splits.                          |
| `apps-script/Storage.gs`                    | Spreadsheet access, sheet creation, settings storage, homepage settings, visitor stats, site-view tracking, Drive folder setup, row helpers, dashboard metrics.                                                                                             | Low-level sheet operations are mixed with feature-specific visitor stats, settings, Drive folder, and metrics behavior.                                 | High         | `Storage.Sheets.gs`, `Storage.Settings.gs`, `Storage.VisitorStats.gs`, `Storage.Drive.gs`.                                                                                                                                | Refactor now as P1, starting with visitor stats only.            |
| `src/public/components/PublicSiteShell.tsx` | Public page shell, header, top bar, mobile/desktop navigation framing, footer, social icons, SEO metadata, intro gate, loading/error shell, floating Messenger placement.                                                                                   | Layout, data loading, SEO, responsive header/footer components, social rendering, scroll affordances, and shell composition live in one file.           | Medium-high  | `src/features/public-shell/PublicSiteShell.tsx`, `TopBar.tsx`, `PublicHeader.tsx`, `FooterDirectory.tsx`, `SocialLinks.tsx`, `BackToTopButton.tsx`, with shared UI only where reused.                                     | Later. Keep stable until visible UX bugs are closed.             |
| `src/services/googleApi.ts`                 | Single frontend API adapter for auth, public snapshots, public content, site-view, admin content, documents, carousel, external services, menu, media, events, settings, visitor stats, users, health checks, session token, and request activity tracking. | Low-level request transport, auth token handling, activity state, public APIs, admin write APIs, and feature-specific payload types are coupled.        | High         | `src/shared/api/googleClient.ts`, `src/features/site-view/api.ts`, `src/features/public-documents/api.ts`, `src/features/public-content/api.ts`, `src/features/cms-documents/api.ts`, `src/features/cms-settings/api.ts`. | Later, after feature folders exist.                              |
| `src/admin/pages/DocumentsPage.tsx`         | Admin documents route, table/list UI, editor dialog state, draft normalization, date helpers, sort helpers, save/delete workflow.                                                                                                                           | Route page, document model helpers, form draft logic, table behavior, and API mutation wiring live together.                                            | Medium       | `src/features/cms-documents/DocumentsPage.tsx`, `DocumentEditorDialog.tsx`, `documentModel.ts`, `documentTable.ts`.                                                                                                       | Later, after Apps Script document split.                         |
| `apps-script/Cache.gs`                      | Public cache keys, snapshot wrappers, diagnostics, invalidation, version reporting, and performance metadata.                                                                                                                                               | Cache key ownership, wrapper behavior, diagnostics response shape, and invalidation policy live together.                                               | Medium       | `Cache.Public.gs`; future `Cache.Diagnostics.gs` only if diagnostics grows.                                                                                                                                               | Later. Keep cache behavior stable while feature splits occur.    |
| `apps-script/Code.gs`                       | `doGet`, `doPost`, request parsing, route dispatch, public/admin resource classification, auth gating, role checks, response helpers.                                                                                                                       | Thin HTTP entrypoint responsibilities are mixed with a large route table and authorization policy.                                                      | High         | Keep `Code.gs` as the thin router entrypoint, move dispatch bodies to `Routes.Public.gs` and `Routes.Admin.gs`.                                                                                                           | Later, after feature functions are already split.                |
| `src/types.ts`                              | Global frontend type registry for users, sessions, content, documents, media, carousel, services, events, menus, dashboard, integrations, visitor stats, settings, snapshots, and API envelopes.                                                            | Public contracts, admin contracts, feature models, backend payloads, and UI settings share one namespace.                                               | High         | `src/features/*/types.ts`, `src/shared/api/types.ts`, `src/shared/types.ts`.                                                                                                                                              | Not yet. Split last to avoid broad import churn.                 |
| `src/public/pages/PublicHomePage.tsx`       | Homepage orchestration, lazy section loading, deferred section wrapper, homepage data selection, site settings normalization, visitor settings normalization, layout assembly.                                                                              | Page composition, loading strategy, snapshot selection, and home section wiring are coupled.                                                            | Medium       | `src/features/public-home/PublicHomePage.tsx`, `DeferredHomeSection.tsx`, `homeSnapshotSelectors.ts`.                                                                                                                     | Later. Safe once home UX fixes stabilize.                        |
| `src/routes.tsx`                            | Full TanStack Router tree for public and admin routes.                                                                                                                                                                                                      | Public route definitions, admin route definitions, auth boundaries, and route metadata live in one file.                                                | Medium       | `src/routes/publicRoutes.tsx`, `src/routes/adminRoutes.tsx`, `src/routes/rootRoute.tsx`.                                                                                                                                  | Not yet. Route split should follow feature folder stabilization. |
| `apps-script/Config.gs`                     | Script settings keys, sheet names, headers, default project properties, environment defaults.                                                                                                                                                               | Configuration constants and schema headers for many features are centralized.                                                                           | Medium       | Keep global constants for now; later split only if sheet ownership is already clear.                                                                                                                                      | Not yet. Avoid schema churn.                                     |
| `src/routeComponents.tsx`                   | Lazy page registry, root layout effects, protected/admin wrappers, public content detail route adapter.                                                                                                                                                     | Route component loading is mixed with analytics/site-view side effects and auth guard layouts.                                                          | Medium       | `src/routes/routeComponents.tsx`, `src/routes/AppRootEffects.tsx`, `src/routes/ProtectedLayout.tsx`.                                                                                                                      | Later. Small file, but mixed responsibilities.                   |

## Backend Apps Script Split Plan

Apps Script files share one global namespace and do not use imports. Splits must keep function names and signatures stable where possible, avoid dependency cycles that rely on load order, and preserve all response shapes.

| Proposed file             | Functions or responsibilities to move                                                                                                                                                                                                                                                                                    | Dependency risks                                                                                                                                                                                               | Tests that must remain passing                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Code.gs`                 | Keep `doGet`, `doPost`, request parsing, top-level error handling, response helpers, and calls into public/admin route handlers.                                                                                                                                                                                         | Route entrypoint must keep the same request parsing, auth gating, CORS behavior, and error envelopes.                                                                                                          | `src/test/appsScriptCode.test.ts`, integration tests that exercise `googleApi.ts`.                                                                                                    |
| `Routes.Public.gs`        | Public route branches from `routeRequest`: `snapshot`, `public-home`, `public-content-list`, `public-document-list`, `public-program-list`, `public-search-index`, `content-detail`, `content-view`, `site-view`, display settings, menu reads, health checks, and cache diagnostics pass-through.                       | Public/admin resource classification must not change. `debugPerformance=1` must still flow to public cache diagnostics. Site-view must stay non-blocking and must not invalidate public snapshots.             | `src/test/appsScriptCode.test.ts`, `src/test/appsScriptCache.test.ts`, `src/test/appsScriptCms.test.ts`, `src/test/appsScriptDocuments.test.ts`, `src/test/siteViewTracking.test.ts`. |
| `Routes.Admin.gs`         | Admin route branches for auth login, admin snapshot, admin content detail, content saves/deletes, document saves/deletes, carousel, external services, media, events, menu, display settings, site settings, homepage settings, visitor settings, user management, publish actions, and health checks that require auth. | Role checks, session validation, script locks, and write response envelopes must remain identical.                                                                                                             | `src/test/appsScriptCode.test.ts`, `src/test/appsScriptCms.test.ts`, `src/test/appsScriptDocuments.test.ts`, integration tests for admin API calls.                                   |
| `Storage.Sheets.gs`       | Spreadsheet access, sheet lookup/creation, header initialization, row reading/writing, object normalization from rows, ID lookup, row deletion, and generic sheet helpers.                                                                                                                                               | Header ordering and sheet creation side effects must remain unchanged. All feature modules depend on these helpers.                                                                                            | `src/test/appsScriptStorage.test.ts`, `src/test/appsScriptCms.test.ts`, `src/test/appsScriptDocuments.test.ts`.                                                                       |
| `Storage.Settings.gs`     | Script/sheet settings access, display settings, site settings, homepage settings, visitor stats enable/disable settings if stored as settings, JSON parse helpers, and setting upserts.                                                                                                                                  | Settings defaults and public cache invalidation behavior must remain the same. Avoid moving visitor count computation here.                                                                                    | `src/test/appsScriptStorage.test.ts`, homepage settings tests, display settings tests.                                                                                                |
| `Storage.VisitorStats.gs` | Visitor stats normalization, visitor settings read/write if tightly coupled, site-view input validation, visitor ID validation, trackable path checks, period key helpers, site-view upsert, visitor stats record creation, stats computation, and site-view HTTP errors.                                                | High-frequency site-view writes must not invalidate public snapshots. Duplicate throttling, anonymous visitor handling, path exclusion, and period aggregation must stay byte-for-byte equivalent in behavior. | `src/test/appsScriptStorage.test.ts`, `src/test/appsScriptCode.test.ts`, `src/test/siteViewTracking.test.ts`, `src/test/publicSiteViewTracker.test.tsx`.                              |
| `Storage.Drive.gs`        | Managed folder resolution, folder creation, parent checks, Drive folder helpers, and folder property initialization.                                                                                                                                                                                                     | Drive permissions and folder IDs must not change. Existing folders must be reused.                                                                                                                             | Apps Script storage/setup tests, media and document backend tests.                                                                                                                    |
| `Cms.Content.gs`          | Content CRUD, content detail, content view increments, publish workflow, content normalization, slug/media/tag/category helpers, content body document helpers, and public/private content sanitizers.                                                                                                                   | Content detail shape, published-only public filtering, view count behavior, body document reads, and admin draft fields must remain stable.                                                                    | `src/test/appsScriptCms.test.ts`, `src/test/appsScriptCode.test.ts`, content detail tests, content block tests.                                                                       |
| `Cms.Documents.gs`        | Document list/read/write/delete functions, public document list snapshot support, document normalization, document sorting, document sanitization, and published-only public filtering.                                                                                                                                  | Public document response shape and admin document save/delete behavior must not change. Sheet headers must remain initialized before use.                                                                      | `src/test/appsScriptDocuments.test.ts`, `src/test/appsScriptCode.test.ts`, public document list tests, integration tests using document API resources.                                |
| `Cms.PublicSnapshots.gs`  | Public CMS snapshot assembly, public home snapshot assembly, public content list snapshot, public program list snapshot, public search index snapshot, home content selection, public search records, and snapshot sanitization.                                                                                         | Public cache keys, payload shape, homepage section ordering, and published-only filters must remain identical.                                                                                                 | `src/test/appsScriptCms.test.ts`, `src/test/appsScriptCache.test.ts`, public data-driven page tests, public cache tests.                                                              |
| `Cache.Public.gs`         | Existing public cache keys, cache wrappers, cache read/write helpers, invalidation functions, diagnostics, performance metadata, and version reporting.                                                                                                                                                                  | Cache keys, TTLs, invalidation policy, and diagnostics names must remain unchanged. Do not add invalidation to high-frequency site-view events.                                                                | `src/test/appsScriptCache.test.ts`, `src/test/appsScriptCode.test.ts`, cache diagnostics tests.                                                                                       |

## Frontend Feature Split Plan

The frontend split should preserve import paths or provide temporary re-exports during each phase. Do not combine feature moves with UI changes.

| Target area                     | Source files involved                                                                                                                                                                                                                                       | First safe move                                                                                                                      | Imports likely affected                                                                           | Tests to run                                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/site-view`        | `src/services/siteViewTracking.ts`, `src/shared/components/PublicSiteViewTracker.tsx`, `recordSiteView` and related types in `src/services/googleApi.ts`, route root effects in `src/routeComponents.tsx`.                                                  | Move the pure site-view service and tracker component together, or create a feature barrel while preserving existing public imports. | `src/routeComponents.tsx`, site-view tests, `googleApi.ts` if API wrapper is later extracted.     | `src/test/siteViewTracking.test.ts`, `src/test/publicSiteViewTracker.test.tsx`, `src/test/appsScriptStorage.test.ts`, `src/test/appsScriptCode.test.ts`, `pnpm test:integration`. |
| `src/features/public-documents` | `src/public/components/home/DocumentListCard.tsx`, public document cache/service files, public document types in `src/types.ts`, document homepage wiring in `PublicHomePage.tsx`, `getPublicDocumentList` in `googleApi.ts`.                               | Move document-specific public UI and cache helpers first, leaving API wrapper and global types in place until later.                 | `PublicHomePage.tsx`, public document page/routes if present, homepage tests, `googleApi.ts`.     | Public document tests, `src/test/appsScriptDocuments.test.ts`, public homepage regression tests, `pnpm test:integration`.                                                         |
| `src/features/public-home`      | `src/public/pages/PublicHomePage.tsx`, `src/public/components/home/*`, public homepage cache/hooks, homepage settings selectors.                                                                                                                            | Extract `DeferredHomeSection` and snapshot selection helpers before moving whole sections.                                           | Public home route, home section imports, homepage tests.                                          | Homepage settings tests, public home component tests, carousel regression tests, build.                                                                                           |
| `src/features/public-content`   | Public news/blog/announcement/department pages, `PublicContentCard.tsx`, `PublicContentDetailPage.tsx`, `usePublicContentDetail.ts`, `usePublicCmsSnapshot.ts`, public content cache helpers, content types.                                                | Move public content hooks and cards behind a feature barrel while keeping route imports stable.                                      | Public route components, content detail route adapter, shared content block renderer if imported. | Public content list/detail tests, public CMS cache tests, router tests, build.                                                                                                    |
| `src/features/cms-documents`    | `src/admin/pages/DocumentsPage.tsx`, document draft helpers inside that file, document save/delete wrappers in `googleApi.ts`, document admin types.                                                                                                        | Extract pure document draft/model helpers from the page into `documentModel.ts` without moving the route yet.                        | `DocumentsPage.tsx`, document tests, `googleApi.ts` only in later API split.                      | Document page tests, `src/test/appsScriptDocuments.test.ts`, integration tests for document saves.                                                                                |
| `src/features/cms-settings`     | `src/admin/pages/SettingsPage.tsx`, `src/services/displaySettings.ts`, site settings/homepage settings/visitor settings wrappers in `googleApi.ts`, setting types.                                                                                          | Group settings-specific service helpers behind feature exports while preserving existing service paths.                              | Settings page, admin dashboard if it reads visitor settings, settings tests.                      | Display settings tests, homepage settings tests, visitor stats tests, admin settings tests.                                                                                       |
| `src/shared/ui`                 | `src/shared/components/EmptyState.tsx`, `src/public/components/PublicLoadingState.tsx`, `src/public/components/PublicErrorState.tsx`, `src/admin/components/PageHeader.tsx`, `src/admin/components/StatusChip.tsx`, simple reusable card/status primitives. | Move only components reused across features. Keep public-only or admin-only components inside their feature until reuse is proven.   | Public and admin page imports, test setup snapshots if any.                                       | Unit tests for affected components, lint, build.                                                                                                                                  |
| `src/shared/api`                | Low-level request transport and activity tracking currently in `src/services/googleApi.ts`.                                                                                                                                                                 | Extract transport helpers only after one feature API split proves the pattern. Keep exported API function names stable.              | Most services and admin pages, integration tests.                                                 | `pnpm test:unit`, `pnpm test:integration`, build.                                                                                                                                 |
| `src/shared/utils`              | `src/utils/safeUrl.ts`, `src/utils/dateDisplay.ts`, `src/utils/seo.ts`, `src/utils/contentBlocks.ts`, other feature-neutral helpers.                                                                                                                        | Do not move unless a feature split needs a neutral import path.                                                                      | Many public/admin components.                                                                     | Focused utility tests plus full unit suite.                                                                                                                                       |

## Refactor Sequencing

### P0 - Docs and Audit Only

- Complete this plan.
- Do not move code.
- Use the plan to select one narrow refactor PR at a time.

### P1 - Apps Script Visitor Stats Split

- Move only visitor stats and site-view helper functions from `Storage.gs` to `Storage.VisitorStats.gs`.
- Keep function names, constants, and response shapes stable.
- Preserve site-view duplicate throttling, route exclusions, anonymous visitor ID behavior, and no public cache invalidation.
- Run the Apps Script deployment checklist if this reaches production.

### P2 - Apps Script Documents Split

- Move document-specific CMS functions from `Cms.gs` to `Cms.Documents.gs`.
- Keep sheet names, headers, published-only filtering, and admin save/delete behavior unchanged.
- Do not combine with frontend document moves.

### P3 - Frontend Site-View Split

- Move site-view tracking service and public tracker component into `src/features/site-view`.
- Keep route behavior and excluded paths unchanged.
- Keep `recordSiteView` behavior and non-blocking error handling unchanged.

### P4 - Frontend Public-Documents Split

- Move public document UI/cache helpers into `src/features/public-documents`.
- Keep document API wrappers and global types stable until tests prove the feature folder split.
- Do not add the full archive route as part of this refactor.

### P5 - Shared Types Split

- Split `src/types.ts` only after P1-P4 stabilize.
- Move one feature's types at a time.
- Prefer temporary re-exports to avoid broad import churn.

## Safety Rules

- No behavior change.
- No schema change.
- No API response shape change.
- No cache behavior change.
- No route behavior change.
- No UI redesign.
- No dependency changes.
- No frontend and Apps Script refactor in the same PR.
- Tests must pass after each phase.
- Apps Script deployments must follow `docs/deployment/apps-script-deployment-checklist.md` when `apps-script/*.gs` changes.

## Definition of Done for Each Refactor PR

- Changed files are limited to one feature or one backend responsibility.
- Moved functions keep names and signatures where possible.
- Tests are updated only for path/import changes.
- `pnpm quality` passes before merge.
- Apps Script deployment checklist is used if Apps Script files changed.
- Manual smoke notes are included in the PR:
  - Public homepage loads.
  - Admin login works if admin code changed.
  - Admin save works if write paths changed.
  - Relevant public endpoint works.
  - Cache diagnostics still work if cache/public snapshot code changed.
  - Site-view remains non-blocking if visitor stats changed.

## Do Not Do

- Do not rewrite the app.
- Do not split the repository.
- Do not introduce a new framework or tooling.
- Do not move all types at once.
- Do not refactor frontend and Apps Script in the same PR.
- Do not combine refactor work with feature work.
- Do not use a structural refactor to change API payloads, cache policy, route paths, auth behavior, analytics behavior, or UI design.

## First Recommended Refactor

Start with P1: split Apps Script visitor stats from `Storage.gs` into `Storage.VisitorStats.gs`.

This is the best first structural refactor because it isolates a high-frequency public write path, has clear functional boundaries, and can be verified with focused tests. The PR should only move visitor stats and site-view helpers, preserving behavior exactly.

Minimum verification for P1:

```bash
pnpm test:unit
pnpm test:integration
pnpm build
pnpm quality
```

Manual smoke for P1:

- Public homepage loads.
- Site-view POST fires on public routes.
- Site-view does not fire on `/login` or `/admin`.
- Visitor stats still compute today, yesterday, month, year, total, and online counts.
- Public cache diagnostics still respond when requested.
