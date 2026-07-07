> Historical record. This document describes a previous migration state and is not the current runtime source of truth. Use docs/architecture/m20-cleanup-runtime-ownership.md for current runtime ownership.

# Wave 2 Admin CMS Ownership Checkpoint - 2026-05-26

## Executive Summary

- Wave 2 Admin CMS ownership consolidation is clean and facade-first.
- The new `src/features/cms-*` modules re-export existing `src/services/googleApi.ts` functions and types; no API implementation was moved into feature modules.
- Admin pages/components now import CMS-specific API entry points through feature boundaries where low-risk.
- Runtime behavior appears preserved: no backend, route, UI, cache, auth, permission, package, or API response-shape changes were found in this checkpoint.
- `pnpm quality` passed.
- Wave 3 can be planned after admin and auth manual smoke checks pass. This checkpoint did not perform browser/manual smoke.

## Feature Boundary Verification

All Wave 2 feature `api.ts` files are facade-only re-exports from `src/services/googleApi.ts`.

| Feature                 | Facade exports verified                                                                                                                | Status |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `cms-content`           | `getAdminContentDetail`, `saveContentItem`, `deleteContentItem`, `publishContent`                                                      | Pass   |
| `cms-documents`         | `saveDocumentToApi`, `deleteDocumentFromApi`, `DocumentItemInput` type                                                                 | Pass   |
| `cms-dashboard`         | `getAdminCmsSnapshot`                                                                                                                  | Pass   |
| `cms-carousel`          | `saveCarouselSlideToApi`, `deleteCarouselSlideFromApi`, `CarouselSlideInput` type                                                      | Pass   |
| `cms-external-services` | `saveExternalServiceLinkToApi`, `deleteExternalServiceLinkFromApi`, `ExternalServiceLinkInput` type                                    | Pass   |
| `cms-media`             | `uploadMediaAsset`, `saveMediaAsset`, `deleteMediaAsset`, `MediaAssetInput` type                                                       | Pass   |
| `cms-events`            | `saveCalendarEvent`, `deleteCalendarEvent`, `CalendarEventInput` type                                                                  | Pass   |
| `cms-settings`          | `getDisplaySettingsFromApi`, `saveDisplaySettingsToApi`, `saveSiteSettingsToApi`, `saveHomepageSettingsToApi`, `saveVisitorStatsToApi` | Pass   |
| `cms-navigation`        | `getPublicMenuItems`, `savePublicMenuItems`                                                                                            | Pass   |

## Admin Import Verification

Verified admin imports are routed through feature boundaries where intended:

- `DashboardPage` imports `getAdminCmsSnapshot` from `cms-dashboard` and `publishContent` from `cms-content`.
- `ContentPage` imports content functions from `cms-content` and media functions/types from `cms-media`.
- `ContentEditorDialog` imports `MediaAssetInput` from `cms-media`.
- `DocumentsPage` imports document functions/types from `cms-documents`.
- `MediaPage` imports media functions from `cms-media`.
- `SettingsPage` imports settings functions from `cms-settings`.
- `CalendarPage` imports event functions from `cms-events`.
- `CarouselPage` imports carousel functions from `cms-carousel`, dashboard snapshot from `cms-dashboard`, and homepage settings save from `cms-settings`.
- `ExternalServicesPage` imports external service functions from `cms-external-services`.
- `MenuPage` imports menu/navigation functions from `cms-navigation`.

Remaining direct admin imports from `src/services/googleApi.ts` are intentional:

- `IntegrationsPage` imports `checkGoogleConnection`.
- `AdminActionProgress` imports `getGoogleApiActivityCount` and `subscribeGoogleApiActivity`.

Those remaining imports are transport/activity concerns and were intentionally left outside the CMS ownership facades.

## Implementation Preservation Check

- `src/services/googleApi.ts` remains the implementation owner.
- `postJson`, `googleFetch`, `readStoredSessionToken`, `ApiEnvelope`, and request activity tracking remain in `googleApi.ts`.
- API function bodies remain in `googleApi.ts`.
- Feature API modules contain only re-export statements and type re-exports.
- Working-tree diff checks found no changes in `src/services/googleApi.ts`, `apps-script`, auth/users services, routes, types, package files, or lockfile during this checkpoint.
- No Apps Script route/resource names were changed.
- No response shapes, UI output, routes, permissions, or cache behavior were changed by this checkpoint.

## Auth and Users Guardrail Check

Wave 2 did not move or alter auth/session/user ownership:

- `loginUserFromApi` remains in `src/services/googleApi.ts` and is consumed by `src/services/auth.ts`.
- `getUserAccountsFromApi`, `saveUserAccountToApi`, `deleteUserAccountFromApi`, and `resetUserAccountsFromApi` remain in `src/services/googleApi.ts` and are consumed by `src/services/users.ts`.
- `readStoredSessionToken` remains in `src/services/googleApi.ts`.
- `src/services/auth.ts`, `src/services/authSession.ts`, and `src/services/users.ts` were not changed in this checkpoint.
- Router auth behavior remains covered by `router-auth.integration.test.tsx`, which passed.

## Public-Read Shim Guardrail Check

Wave 1 public-read compatibility shims remain:

- `src/services/publicContentListCache.ts`
- `src/services/publicHomeCache.ts`
- `src/services/publicProgramListCache.ts`
- `src/services/publicSearchIndexCache.ts`

The shims still re-export from feature cache modules:

- `publicContentListCache.ts` re-exports from `../features/public-content/cache`.
- `publicHomeCache.ts` re-exports from `../features/public-home/cache`.
- `publicProgramListCache.ts` re-exports from `../features/public-programs/cache`.
- `publicSearchIndexCache.ts` re-exports from `../features/public-search/cache`.

No public cache key, TTL, read/write/remove behavior, or global cache clearing behavior was changed.

## Search Summary

| Search | Result |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `rg "features/cms-..." src` | Admin pages/components import through Wave 2 feature boundaries. |
| `rg "from .*services/googleApi" src/admin src/test` | Only intentional admin direct imports remain: `checkGoogleConnection`, request activity helpers; tests still import compatibility surface. |
| `rg "loginUserFromApi                               | ...                                                                                                                                        | readStoredSessionToken" src` | Auth/user APIs remain in `googleApi.ts`, consumed by `auth.ts` and `users.ts`; tests unchanged. |
| `rg "postJson                                       | googleFetch                                                                                                                                | ApiEnvelope                                                                         | subscribeGoogleApiActivity                                                                      | getGoogleApiActivityCount" src/services/googleApi.ts` | Transport, envelope, and activity tracking remain centralized in `googleApi.ts`. |
| `rg "saveContentItem                                | deleteContentItem                                                                                                                          | publishContent                                                                      | getAdminContentDetail                                                                           | getAdminCmsSnapshot" src` | Implementations remain in `googleApi.ts`; admin callers use `cms-content` and `cms-dashboard`; integration tests still cover compatibility. |
| `rg "saveDocumentToApi                              | deleteDocumentFromApi" src` | Implementations remain in `googleApi.ts`; admin document page uses `cms-documents`. |
| `rg "saveMediaAsset                                 | uploadMediaAsset                                                                                                                           | deleteMediaAsset" src` | Implementations remain in `googleApi.ts`; admin media/content callers use `cms-media`. |
| `rg "saveDisplaySettingsToApi                       | saveSiteSettingsToApi                                                                                                                      | saveHomepageSettingsToApi                                                           | saveVisitorStatsToApi" src` | Implementations remain in `googleApi.ts`; admin settings/carousel callers use `cms-settings`; shared display settings service intentionally remains on compatibility import. |
| `rg "savePublicMenuItems                            | getPublicMenuItems" src` | Implementations remain in `googleApi.ts`; admin menu page uses `cms-navigation`. |
| `rg "services/publicContentListCache                | services/publicHomeCache                                                                                                                   | services/publicProgramListCache                                                     | services/publicSearchIndexCache" src` | Public cache tests still exercise the Wave 1 service shims. |

## Commands Run

| Command                                                                                                                                                                            | Result | Notes                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm.cmd ai:ask "Wave 2 Admin CMS ownership checkpoint facade-first audit googleApi admin imports public shims"`                                                                  | Pass   | SigMap context generated; existing "path not found" message also appeared.                                                           |
| `git status --short`                                                                                                                                                               | Pass   | Clean before checkpoint edits.                                                                                                       |
| Required `rg` searches                                                                                                                                                             | Pass   | Results summarized above.                                                                                                            |
| `Get-Content` on Wave 2 `api.ts` files                                                                                                                                             | Pass   | All are re-export facades only.                                                                                                      |
| `Get-Content` on Wave 1 public cache shims                                                                                                                                         | Pass   | Shims remain and re-export feature cache modules.                                                                                    |
| `git diff -- src/services/googleApi.ts apps-script src/services/auth.ts src/services/authSession.ts src/services/users.ts src/types.ts src/routes.tsx package.json pnpm-lock.yaml` | Pass   | No diff.                                                                                                                             |
| `pnpm.cmd format:check`                                                                                                                                                            | Pass   | All matched files use Prettier style.                                                                                                |
| `pnpm.cmd lint:report`                                                                                                                                                             | Pass   | ESLint completed with no reported failures.                                                                                          |
| `pnpm.cmd lint:errors`                                                                                                                                                             | Pass   | ESLint quiet mode completed with no errors.                                                                                          |
| `pnpm.cmd test:unit`                                                                                                                                                               | Pass   | 33 files, 264 tests passed. Existing router/localstorage/act warnings observed.                                                      |
| `pnpm.cmd test:integration`                                                                                                                                                        | Pass   | 2 files, 10 tests passed. Existing localstorage warning observed.                                                                    |
| `pnpm.cmd build`                                                                                                                                                                   | Pass   | Build completed; known Vite bcrypt/crypto externalization warning observed. Build regenerated sitemap timestamp, restored afterward. |
| `pnpm.cmd quality`                                                                                                                                                                 | Pass   | Aggregate quality passed. Build regenerated sitemap timestamp, restored afterward.                                                   |

## Manual Smoke Checklist

Manual browser smoke was not performed during this checkpoint. These checks should be completed before starting Wave 3.

### Admin

- `/admin` dashboard loads: Not checked.
- `/admin/content` loads: Not checked.
- Content create/edit/delete works: Not checked.
- Publish content works: Not checked.
- `/admin/documents` loads: Not checked.
- Document create/edit/delete works: Not checked.
- `/admin/media` loads: Not checked.
- Media upload/save/delete works: Not checked.
- `/admin/settings` loads: Not checked.
- Site/homepage/display/visitor stats settings save works: Not checked.
- `/admin/calendar` or events page loads: Not checked.
- Event save/delete works: Not checked.
- Carousel save/delete works: Not checked.
- External services save/delete works: Not checked.
- Menu/navigation save works: Not checked.

### Auth

- Login works: Not checked manually.
- Logout works: Not checked manually.
- Protected admin routes still work: Covered by integration tests; not checked manually.
- Unauthorized access behavior unchanged: Covered by integration tests; not checked manually.

### Public

- Homepage loads: Not checked manually.
- Public documents still work: Not checked manually.
- Public content/search/programs still work: Not checked manually.
- Site-view still works: Not checked manually.
- Who's Online still works: Not checked manually.

## Remaining Risks

- `googleApi.ts` still owns actual implementations and transport.
- Feature modules are facades, not implementation owners yet.
- Auth/session/users are intentionally deferred.
- Admin snapshot remains broad.
- Media upload and Drive behavior remain sensitive and should not be moved casually.
- Public-read shims remain intentionally.
- This refactor does not improve backend latency.

## Recommended Next Step

Recommend Wave 3 Remaining Types/API Facades Cleanup only after:

- `pnpm quality` remains green.
- Admin manual smoke passes.
- Auth manual smoke passes.

Wave 3 should not move auth/session/users unless explicitly scoped.

## Go / No-Go

Code checkpoint status: GO.

Wave 3 start status: CONDITIONAL GO after manual admin and auth smoke checks are completed.

The checkpoint criteria are satisfied for code structure: feature facades are clean, `googleApi.ts` remains the implementation owner, auth/session/users were not moved, public shims remain, backend/API/UI/cache behavior was not changed, and `pnpm quality` passed.
