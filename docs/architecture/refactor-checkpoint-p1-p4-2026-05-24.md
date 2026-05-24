# Refactor Checkpoint P1-P4 - 2026-05-24

Status: architecture checkpoint audit. This report documents the post-refactor state after P1 through P4. It does not change runtime behavior, UI, routes, Apps Script behavior, API response shapes, cache behavior, auth, analytics, CMS schema, dependencies, or shared types.

Related documents:

- [`structural-refactor-plan-2026-05-23.md`](./structural-refactor-plan-2026-05-23.md)
- [`project-simplification-audit-2026-05-23.md`](./project-simplification-audit-2026-05-23.md)
- [`stabilization-release-2026-05-23.md`](../releases/stabilization-release-2026-05-23.md)

## Executive Summary

P1 through P4 are structurally successful. The refactors moved clear feature responsibilities out of broad storage, CMS, service, and shared component locations without changing route resources, cache keys, storage keys, public API response shapes, or UI behavior.

Behavior appears preserved based on static ownership checks, stale import searches, duplicate Apps Script function searches, and the full automated quality gate. Production/manual smoke should still run before treating the refactor sequence as fully release-verified, especially because P1 and P2 changed Apps Script source files and require the Apps Script deployment process.

The project should pause before P5. A full shared-types split should be deferred until a P5 audit-only pass maps type ownership and import churn. `src/types.ts` has high blast radius and should not be split as a casual cleanup task.

## Completed Refactor Summary

### P1 Apps Script Visitor Stats Split

- Files created: `apps-script/Storage.VisitorStats.gs`.
- Files reduced: `apps-script/Storage.gs`.
- Ownership moved: visitor stats normalization, visitor stats read/write, site-view validation, site-view duplicate throttling, visitor record upsert, period key helpers, visitor stats computation, and site-view HTTP errors.
- Import paths updated: none required because Apps Script `.gs` files share a global namespace.
- Tests affected: `appsScriptStorage.test.ts`, `appsScriptCode.test.ts`, `siteViewTracking.test.ts`, `publicSiteViewTracker.test.tsx`.
- Behavior preserved: `POST ?resource=site-view`, `POST ?resource=visitor-stats`, duplicate throttling, route exclusions, visitor stats enable/disable, and public-home visitor stats shape.
- Deployment implications: Apps Script deployment required after source push/version/deploy. Vercel deployment alone is not enough for P1.

### P2 Apps Script Documents Split

- Files created: `apps-script/Cms.Documents.gs`.
- Files reduced: `apps-script/Cms.gs`.
- Ownership moved: public document list snapshot, document read/list helpers, public document filtering, admin document upsert/delete, document normalization, status validation, public sanitization, and document sorting.
- Import paths updated: none required because Apps Script `.gs` files share a global namespace.
- Tests affected: `appsScriptDocuments.test.ts`, `appsScriptCms.test.ts`, `appsScriptCode.test.ts`, `appsScriptCache.test.ts`, `googleApi.integration.test.ts`.
- Behavior preserved: `GET ?resource=public-document-list`, `POST ?resource=document`, `POST ?resource=document-delete`, published-only public filtering, admin save/delete validation, sorting, and cache invalidation on document writes.
- Deployment implications: Apps Script deployment required after source push/version/deploy. Vercel deployment alone is not enough for P2.

### P3 Frontend Site-View Split

- Files created: `src/features/site-view/siteViewTracking.ts`, `src/features/site-view/PublicSiteViewTracker.tsx`, `src/features/site-view/index.ts`.
- Files reduced or removed from ownership: generic `src/services` and `src/shared/components` no longer own the frontend site-view tracker logic.
- Import paths updated: `src/routeComponents.tsx`, `src/test/siteViewTracking.test.ts`, `src/test/publicSiteViewTracker.test.tsx`.
- Tests affected: `siteViewTracking.test.ts`, `publicSiteViewTracker.test.tsx`, `router-auth.integration.test.tsx`, `publicAnalytics.test.ts`.
- Behavior preserved: public-only tracking, `/login` and `/admin` exclusions, visitor id storage key, duplicate throttle key and interval, fire-and-forget tracking, and root layout mounting.
- Deployment implications: frontend deployment only. No Apps Script source changed in P3.

### P4 Frontend Public Documents Split

- Files created: `src/features/public-documents/DocumentListCard.tsx`, `src/features/public-documents/publicDocumentListCache.ts`, `src/features/public-documents/index.ts`.
- Files reduced or removed from ownership: `src/public/components/home/DocumentListCard.tsx` and `src/services/publicDocumentListCache.ts` no longer own public document UI/cache logic.
- Import paths updated: `src/public/pages/PublicHomePage.tsx`, `src/test/publicCardLayoutRegression.test.tsx`, `src/test/publicCmsCache.test.ts`.
- Tests affected: `publicCardLayoutRegression.test.tsx`, `publicDataDrivenPages.test.tsx`, `publicCmsCache.test.ts`, `googleApi.integration.test.ts`, `router-auth.integration.test.tsx`.
- Behavior preserved: homepage document card placement, lazy/deferred rendering, document labels/icons/empty states/link behavior, document cache key and TTL, no new public `/documents` route, and admin documents page behavior.
- Deployment implications: frontend deployment only. No Apps Script source changed in P4.

## Ownership Map After P1-P4

| Domain                                  | Owner files before                                                                                               | Owner files after                                                                                             | Public/admin scope                    | Backend/frontend scope | Risk after refactor | Notes                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| Visitor stats / site-view backend       | `apps-script/Storage.gs`, `apps-script/Code.gs`                                                                  | `apps-script/Storage.VisitorStats.gs`, route calls in `apps-script/Code.gs`                                   | Public tracking, admin enable/disable | Backend                | Medium              | High-frequency write logic is isolated. `Code.gs` remains the route boundary.              |
| Site-view frontend tracking             | `src/services/siteViewTracking.ts`, `src/shared/components/PublicSiteViewTracker.tsx`, `src/routeComponents.tsx` | `src/features/site-view/*`, mount in `src/routeComponents.tsx`                                                | Public only; login/admin excluded     | Frontend               | Low-medium          | Feature logic is owned by a feature folder. Root layout still owns global mounting.        |
| Public documents backend                | `apps-script/Cms.gs`, `apps-script/Cache.gs`, `apps-script/Code.gs`                                              | `apps-script/Cms.Documents.gs`, cache wrapper in `apps-script/Cache.gs`, route calls in `apps-script/Code.gs` | Public reads and admin writes         | Backend                | Medium              | Document CRUD/list logic is isolated. Routing and cache wrappers remain centralized.       |
| Public documents frontend display/cache | `src/public/components/home/DocumentListCard.tsx`, `src/services/publicDocumentListCache.ts`                     | `src/features/public-documents/*`                                                                             | Public homepage display               | Frontend               | Low-medium          | UI and feature-local cache helpers now share one owner folder.                             |
| PublicHomePage integration              | `src/public/pages/PublicHomePage.tsx`                                                                            | `src/public/pages/PublicHomePage.tsx` imports from feature folders                                            | Public                                | Frontend               | Medium              | Homepage still coordinates many sections, but feature ownership is clearer.                |
| Route/global tracker integration        | `src/routeComponents.tsx`                                                                                        | `src/routeComponents.tsx` imports `PublicSiteViewTracker` from `src/features/site-view`                       | Public/global root effects            | Frontend               | Medium              | Mounted once. Root route still mixes analytics, tracker, admin progress, and route outlet. |

## Stale File And Import Audit

| Check                                                                                                        | Result                                                                                                                             | Classification     | Notes                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Old site-view imports: `services/siteViewTracking` or `shared/components/PublicSiteViewTracker`              | None found in `src`.                                                                                                               | Clear              | Tests and route integration import from `src/features/site-view`.                                                                                                                                      |
| Old public document imports: `public/components/home/DocumentListCard` or `services/publicDocumentListCache` | None found in `src`.                                                                                                               | Clear              | Public home and tests import from `src/features/public-documents`.                                                                                                                                     |
| New site-view feature references                                                                             | Found in `src/routeComponents.tsx`, `siteViewTracking.test.ts`, and `publicSiteViewTracker.test.tsx`.                              | Keep intentionally | References are expected feature ownership.                                                                                                                                                             |
| New public documents feature references                                                                      | Found in `PublicHomePage.tsx`, `publicCardLayoutRegression.test.tsx`, and `publicCmsCache.test.ts`.                                | Keep intentionally | References are expected feature ownership.                                                                                                                                                             |
| Apps Script visitor stats duplicate definitions                                                              | No duplicate function owner found. Definitions live in `Storage.VisitorStats.gs`; `Code.gs` calls `incrementSiteView`.             | Clear              | `updateVisitorStats()` still invalidates public cache; `incrementSiteView()` does not.                                                                                                                 |
| Apps Script document duplicate definitions                                                                   | No duplicate function owner found. Definitions live in `Cms.Documents.gs`; `Cms.gs`, `Cache.gs`, and `Code.gs` call those globals. | Clear              | Calls from `Cms.gs` are intentional public-home and fallback integrations, not duplicate definitions.                                                                                                  |
| Empty files in `src`, `apps-script`, `scripts`, or `docs`                                                    | None found.                                                                                                                        | Clear              | No placeholder cleanup needed.                                                                                                                                                                         |
| Dead re-export shims                                                                                         | None found.                                                                                                                        | Clear              | P3/P4 use feature barrels where useful, not old-path shims.                                                                                                                                            |
| Old tests/imports                                                                                            | None found for moved paths.                                                                                                        | Clear              | Tests point to new feature owners.                                                                                                                                                                     |
| Public document cache key appears in two places                                                              | Found in `src/features/public-documents/publicDocumentListCache.ts` and `src/services/publicCmsCache.ts`.                          | Keep intentionally | The feature helper owns the document-list cache. The generic public cache clear helper keeps the same key so broad public cache clearing can remove document-list data without importing feature code. |

## Behavior Preservation Checklist

### Visitor Stats And Site-View

- `POST ?resource=site-view` still exists in `apps-script/Code.gs`.
- `/login`, `/admin`, and `/admin/*` are still excluded by frontend site-view tracking.
- Duplicate same-path throttling remains unchanged in frontend tracking and Apps Script write logic.
- `site-view` still does not call `invalidatePublicSnapshotCache()`.
- `updateVisitorStats()` still invalidates public snapshots when admin visitor settings change.
- `VisitorStatsCard` still renders "Who's Online" immediately on the public homepage when visitor stats are enabled.
- Visitor id storage key remains `rcat.site.visitor.id`.

### Public Documents

- `GET ?resource=public-document-list` still routes through the cached public document list wrapper.
- `public-home.documentItems` behavior remains backend-owned and unchanged.
- Legacy keyword-derived page fallback remains in the public-home/CMS layer.
- Frontend document cache key remains `rcat.cms.public.document-list`.
- No public `/documents` route was added.
- `src/admin/pages/DocumentsPage.tsx` remains in the admin pages area and was not moved by P4.
- Document save/delete still invalidate public snapshots from `Cms.Documents.gs`.

### Frontend

- `PublicSiteViewTracker` is still mounted once in `src/routeComponents.tsx`.
- `PublicHomePage` still lazy-loads `DocumentListCard` and directly renders `VisitorStatsCard`.
- No route files were changed during this checkpoint audit.
- No UI redesign was performed during P1-P4 verification.

## Remaining Structural Risks

- `src/types.ts` is still broad and contains shared public, admin, backend payload, and UI settings contracts.
- `src/services/googleApi.ts` is still broad and owns transport, auth token handling, activity tracking, public reads, admin writes, and feature-specific API wrappers.
- `src/public/pages/PublicHomePage.tsx` still coordinates many sections, data selection, lazy/deferred rendering, and layout composition.
- `apps-script/Code.gs` still centralizes routing, auth classification, resource names, and public/admin dispatch.
- `apps-script/Cms.gs` and `apps-script/Storage.gs` are improved but remain large enough to require careful future ownership work.
- The `public-home` payload is still broad and couples homepage rendering to many backend resources.

## P5 Recommendation

Defer the full P5 shared-types split.

Recommended next action is P5 audit-only. `src/types.ts` has high import churn and high blast radius because it is shared by public pages, admin pages, services, tests, and API payloads. Splitting it without a type ownership map would create unnecessary risk and make behavior-preserving review harder.

P5 should proceed only after documenting:

- Which types are API contracts versus UI-only models.
- Which types are public-only, admin-only, or shared.
- Which imports would churn by feature.
- Which tests cover each type group.
- Whether temporary re-export shims are needed to keep each PR small.

## Recommended Next Tasks

1. Run production/manual smoke after P1-P4, including public homepage, site-view, visitor stats, public documents, and admin document create/edit/delete.
2. Create a P5 shared-types audit-only document before moving any type.
3. Document `googleApi.ts` API ownership before splitting transport or feature API wrappers.
4. Measure public-home payload/cache with `debugPerformance=1` before changing public-home composition.
5. Keep Cloudflare D1 migration planning separate from this refactor sequence.

## Commands Run

| Command                                                                                                                                                                | Result                 | Notes                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `pnpm ai:ask "P1 P4 structural refactor checkpoint site-view public documents Apps Script visitor stats stale imports duplicate functions"`                            | Passed                 | SigMap coverage reported 100%.                                                                                         |
| `rg "services/siteViewTracking\|shared/components/PublicSiteViewTracker" src`                                                                                          | No matches             | No stale frontend site-view imports.                                                                                   |
| `rg "public/components/home/DocumentListCard\|services/publicDocumentListCache" src`                                                                                   | No matches             | No stale public document imports.                                                                                      |
| `rg "features/site-view" src`                                                                                                                                          | Matches expected files | Route integration and tests only.                                                                                      |
| `rg "features/public-documents" src`                                                                                                                                   | Matches expected files | Public home and tests only.                                                                                            |
| `rg "incrementSiteView\|computeVisitorStats\|SITE_VIEW_DUPLICATE_WINDOW_MS\|normalizeVisitorStats" apps-script`                                                        | Passed                 | Definitions are owned by `Storage.VisitorStats.gs`; `Code.gs` calls `incrementSiteView`.                               |
| `rg "getPublicDocumentListSnapshot\|getDocuments\|getPublicDocuments\|upsertDocument\|deleteDocument\|ALLOWED_DOCUMENT_STATUSES\|normalizeDocumentRecord" apps-script` | Passed                 | Definitions are owned by `Cms.Documents.gs`; callers remain in route/cache/snapshot code.                              |
| Empty-file search for `src`, `apps-script`, `scripts`, and `docs`                                                                                                      | No matches             | No empty stale files found.                                                                                            |
| `pnpm lint:report`                                                                                                                                                     | Passed                 | No ESLint warnings reported.                                                                                           |
| `pnpm lint:errors`                                                                                                                                                     | Passed                 | No ESLint errors reported.                                                                                             |
| `pnpm format:check`                                                                                                                                                    | Passed                 | Prettier check passed.                                                                                                 |
| `pnpm test:unit`                                                                                                                                                       | Passed                 | 33 files, 264 tests. Existing Vitest localStorage and router-provider warnings remain.                                 |
| `pnpm test:integration`                                                                                                                                                | Passed                 | 2 files, 10 tests. Existing Vitest localStorage warning remains.                                                       |
| `pnpm build`                                                                                                                                                           | Passed                 | Generated sitemap and built production bundle. Existing Vite `crypto` externalization warning from `bcryptjs` remains. |
| `pnpm quality`                                                                                                                                                         | Passed                 | Format, lint, unit tests, integration tests, and build passed.                                                         |

## Go / No-Go

GO for treating P1-P4 as structurally complete when:

- `pnpm quality` passes.
- No stale imports remain for moved site-view or public document paths.
- No duplicate global Apps Script functions remain for moved visitor stats or document ownership.
- Public homepage smoke passes.
- Admin documents smoke passes.
- Site-view smoke passes.

NO-GO if:

- Stale imports reappear.
- Duplicate global Apps Script function definitions are introduced.
- Public-home breaks.
- Site-view tracking breaks or blocks rendering.
- Admin documents create/edit/delete breaks.
- P5 is attempted before an audit-only type ownership pass.
