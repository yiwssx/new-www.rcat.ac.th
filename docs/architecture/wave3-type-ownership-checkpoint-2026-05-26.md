> Historical record. This document describes a previous migration state and is not the current runtime source of truth. Use docs/architecture/m20-cleanup-runtime-ownership.md for current runtime ownership.

# Wave 3 Type Ownership Checkpoint - 2026-05-26

## Executive Summary

Wave 3 type ownership consolidation is clean and behavior-preserving. `src/types.ts` now acts as a compatibility facade for moved feature-owned type contracts while intentionally retaining auth/session/user contracts and broad aggregate snapshot contracts.

The new API facades are facade-first only:

- `src/features/cms-integrations/api.ts` re-exports `checkGoogleConnection`.
- `src/shared/api/activity.ts` re-exports Google API request activity helpers.

No runtime implementations were moved. No Apps Script, auth, routing, package, cache key, cache TTL, API response shape, or UI behavior changes were found. The project is ready for a final refactor checkpoint planning pass after smoke testing.

## src/types.ts Compatibility Facade

`src/types.ts` re-exports the moved feature-owned contracts and still exports the compatibility surface expected by old imports.

Confirmed compatibility re-exports:

- CMS: `CarouselSlide`, `DashboardMetric`, `CmsDocumentItem`, `DocumentStatus`, `CalendarEvent`, `ExternalServiceIconKey`, `ExternalServiceLink`, `ExternalServiceTone`, `IntegrationState`, `IntegrationStatus`, `MediaAsset`, `MediaType`, `PublicMenuItem`, settings contracts.
- Public: `ContentItem`, `ContentStatus`, `ContentType`, `PublicContentListKind`, `PublicContentListSnapshot`, `PublicDocumentItem`, `PublicDocumentListSnapshot`, `PublicProgramListSnapshot`, `PublicSearchIndexSnapshot`.
- Visitor stats: `VisitorStatsSettings`.

Intentionally still owned by `src/types.ts`:

- `User`
- `UserAccount`
- `Session`
- `RolePermission`
- `CmsSnapshot`
- `PublicHomeSnapshot`

Reasoning:

- Auth/session/user types are deferred to a future explicit auth ownership wave.
- `CmsSnapshot` and `PublicHomeSnapshot` are broad aggregate contracts that compose many feature-owned types; moving them casually would create avoidable circular import and ownership risk.

`src/types.ts` uses `import type` for feature contracts required by `CmsSnapshot` and `PublicHomeSnapshot`. Duplicate moved type definitions were not found in `src/types.ts`.

## Feature Type Ownership

Confirmed feature-owned type modules:

| Feature                 | Owned contracts                                                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cms-carousel`          | `CarouselSlide`                                                                                                                                                                                                        |
| `cms-dashboard`         | `DashboardMetric`                                                                                                                                                                                                      |
| `cms-documents`         | `DocumentStatus`, `CmsDocumentItem`                                                                                                                                                                                    |
| `cms-events`            | `CalendarEvent`                                                                                                                                                                                                        |
| `cms-external-services` | `ExternalServiceTone`, `ExternalServiceIconKey`, `ExternalServiceLink`                                                                                                                                                 |
| `cms-integrations`      | `IntegrationState`, `IntegrationStatus`                                                                                                                                                                                |
| `cms-media`             | `MediaType`, `MediaAsset`                                                                                                                                                                                              |
| `cms-navigation`        | `PublicMenuItem`                                                                                                                                                                                                       |
| `cms-settings`          | `DisplaySettings`, `HomepageIntroGateSettings`, `HomepageMarqueeSettings`, `HomepageIntroVideoSettings`, `HomepageCarouselSettings`, `HomepageSettings`, `FooterDirectoryLink`, `FooterDirectoryGroup`, `SiteSettings` |
| `public-content`        | `ContentStatus`, `ContentType`, `ContentItem`, `PublicContentListKind`, `PublicContentListSnapshot`                                                                                                                    |
| `public-documents`      | `PublicDocumentItem`, `PublicDocumentListSnapshot`                                                                                                                                                                     |
| `public-programs`       | `PublicProgramListSnapshot`                                                                                                                                                                                            |
| `public-search`         | `PublicSearchIndexSnapshot`                                                                                                                                                                                            |
| `visitor-stats`         | `VisitorStatsSettings`                                                                                                                                                                                                 |

## Circular Import And Dependency Smell Check

Feature type modules do not import from `src/types.ts`.

Observed feature type dependencies are type-only and directional:

- `cms-documents/types.ts` imports `PublicDocumentItem` from `public-documents/types.ts`.
- `public-content/types.ts` imports type-only contracts from `cms-media`, `cms-navigation`, and `cms-settings`.
- `public-programs/types.ts` imports type-only contracts from `cms-media`, `cms-navigation`, `cms-settings`, and `public-content`.
- `public-search/types.ts` imports type-only contracts from `cms-navigation`, `cms-settings`, and `public-content`.

`src/types.ts` imports from feature type modules only with `import type`. No runtime import was introduced for moved type contracts. No circular dependency risk was found in the Wave 3 type modules.

Two feature files still intentionally import aggregate or compatibility types from `src/types.ts`:

- `src/features/public-home/cache.ts` imports `PublicHomeSnapshot`, which intentionally remains in `src/types.ts`.
- `src/features/public-documents/DocumentListCard.tsx` imports `ContentItem` from `src/types.ts` for compatibility and to avoid broad UI import churn.

## API Facade Verification

Confirmed:

- `src/features/cms-integrations/api.ts` re-exports `checkGoogleConnection` from `src/services/googleApi.ts`.
- `src/features/cms-integrations/index.ts` exports `checkGoogleConnection`, `IntegrationState`, and `IntegrationStatus`.
- `src/admin/pages/IntegrationsPage.tsx` imports `checkGoogleConnection` and `IntegrationStatus` from `../../features/cms-integrations`.
- `src/shared/api/activity.ts` re-exports `getGoogleApiActivityCount` and `subscribeGoogleApiActivity` from `src/services/googleApi.ts`.
- `src/admin/components/AdminActionProgress.tsx` imports activity helpers from `../../shared/api/activity`.

No `googleApi.ts` implementation, transport helper, request activity state, or API function body was moved.

## Implementation Preservation

Guardrail diff checks found no working-tree changes in:

- `src/services/googleApi.ts`
- `src/services/auth.ts`
- `src/services/authSession.ts`
- `src/services/users.ts`
- `apps-script`
- `package.json`
- `pnpm-lock.yaml`
- route files

Confirmed in `src/services/googleApi.ts`:

- `googleFetch` remains in `googleApi.ts`.
- `postJson` remains in `googleApi.ts`.
- `ApiEnvelope` remains in `googleApi.ts`.
- `readStoredSessionToken` remains in `googleApi.ts`.
- request activity helpers and state remain in `googleApi.ts`.
- auth/user API wrappers remain in `googleApi.ts`.

No Apps Script route/resource names, response shapes, UI logic, package dependencies, cache keys, or cache TTLs were changed by this checkpoint.

## Auth And Users Guardrail

Wave 3 did not move or alter:

- `loginUserFromApi`
- `getUserAccountsFromApi`
- `saveUserAccountToApi`
- `deleteUserAccountFromApi`
- `resetUserAccountsFromApi`
- `readStoredSessionToken`
- `User`
- `UserAccount`
- `Session`
- `RolePermission`
- `src/services/auth.ts`
- `src/services/authSession.ts`
- `src/services/users.ts`
- router auth logic

## Compatibility Import Check

Imports from `src/types.ts` still exist across public, admin, services, utilities, and tests. This is expected and confirms old import paths remain available without broad churn.

Moved types are available from both:

- their feature-owned type modules or feature barrels
- `src/types.ts` compatibility re-exports

The TypeScript build and tests compile successfully with this compatibility shape.

## Public And Admin Behavior Preservation

Wave 1 public-read service shims remain:

- `src/services/publicContentListCache.ts`
- `src/services/publicHomeCache.ts`
- `src/services/publicProgramListCache.ts`
- `src/services/publicSearchIndexCache.ts`

Wave 2 admin CMS feature facades remain in place. No public/admin route behavior, UI rendering behavior, backend behavior, cache key, or TTL change was found.

## Manual Smoke Checklist

Manual browser smoke was not performed in this checkpoint. Status is recorded as not checked:

| Area   | Check                                           | Status      |
| ------ | ----------------------------------------------- | ----------- |
| Admin  | `/admin` dashboard loads                        | Not checked |
| Admin  | `/admin/content` loads                          | Not checked |
| Admin  | `/admin/documents` loads                        | Not checked |
| Admin  | `/admin/media` loads                            | Not checked |
| Admin  | `/admin/settings` loads                         | Not checked |
| Admin  | `/admin/integrations` loads                     | Not checked |
| Admin  | request activity/progress indicator still works | Not checked |
| Auth   | login works                                     | Not checked |
| Auth   | logout works                                    | Not checked |
| Auth   | protected admin routes still work               | Not checked |
| Auth   | unauthorized access behavior unchanged          | Not checked |
| Public | homepage loads                                  | Not checked |
| Public | public content list works                       | Not checked |
| Public | content detail works                            | Not checked |
| Public | public documents work                           | Not checked |
| Public | programs work                                   | Not checked |
| Public | search works                                    | Not checked |
| Public | site-view still works                           | Not checked |
| Public | Who's Online still works                        | Not checked |

Automated unit, integration, build, and quality gates passed.

## Remaining Risks

- `src/types.ts` still owns `CmsSnapshot` and `PublicHomeSnapshot` intentionally.
- Auth/session/user types remain intentionally deferred.
- `src/services/googleApi.ts` still owns transport and actual API implementations.
- Feature API modules are facades, not implementation owners.
- Public-read service shims still remain intentionally.
- This refactor does not improve backend latency.

## Recommended Next Step

Create a Final Refactor Checkpoint covering:

- P1-P5
- G3-G4
- Wave 1
- Wave 2
- Wave 3
- commitlint
- remaining risks
- readiness for a Backend Migration Readiness Audit

Do not start backend migration or auth/session ownership work until that final checkpoint is complete.

## Commands Run

| Command                                                                                                                                                                                       | Result | Notes                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd ai:ask "Wave 3 type ownership checkpoint src/types compatibility feature types cms-integrations shared api activity"`                                                               | Passed | SigMap context generated with 100% query coverage; tool also printed its existing path warning.                                                          |
| `rg "export interface\|export type" src/types.ts`                                                                                                                                             | Passed | `src/types.ts` now shows compatibility type re-exports plus `User`, `UserAccount`, `Session`, `RolePermission`, `CmsSnapshot`, and `PublicHomeSnapshot`. |
| `rg "export interface\|export type" src/features -g types.ts`                                                                                                                                 | Passed | Found expected feature-owned type contracts.                                                                                                             |
| `rg "\.\./types\|\.\./\.\./types\|\.\./\.\./\.\./types" src/features`                                                                                                                         | Passed | Only `public-home/cache.ts` and `public-documents/DocumentListCard.tsx` import from `src/types.ts`; neither is a feature type module.                    |
| `rg "import .* from .*types" src/features`                                                                                                                                                    | Passed | Found type-only feature imports and feature barrel exports; no runtime type-module imports requiring concern.                                            |
| `rg "import type" src/features`                                                                                                                                                               | Passed | Feature type dependencies use `import type`.                                                                                                             |
| `rg "from \"./features/" src/types.ts`                                                                                                                                                        | Passed | `src/types.ts` imports/re-exports feature modules.                                                                                                       |
| `rg "from .*services/googleApi" src/admin src/shared src/features src/test`                                                                                                                   | Passed | Admin direct imports were removed; feature/shared facades and compatibility tests still reference `googleApi.ts`.                                        |
| `rg "features/cms-integrations\|shared/api/activity" src`                                                                                                                                     | Passed | Confirmed updated callers.                                                                                                                               |
| `rg "CmsSnapshot\|PublicHomeSnapshot" src`                                                                                                                                                    | Passed | Aggregates remain in `src/types.ts` and compatibility callers still compile.                                                                             |
| `rg "UserAccount\|Session\|RolePermission" src`                                                                                                                                               | Passed | Auth/session/user contracts remain in `src/types.ts` and auth services.                                                                                  |
| `git diff HEAD~1..HEAD -- src/services/googleApi.ts apps-script src/services/auth.ts src/services/authSession.ts src/services/users.ts package.json pnpm-lock.yaml`                           | Passed | No diff output for these guardrails in the requested commit range.                                                                                       |
| `git diff -- src/services/googleApi.ts apps-script src/services/auth.ts src/services/authSession.ts src/services/users.ts package.json pnpm-lock.yaml src/routes.tsx src/routeComponents.tsx` | Passed | No working-tree guardrail diff.                                                                                                                          |
| `rg "googleFetch\|postJson\|ApiEnvelope\|readStoredSessionToken\|subscribeGoogleApiActivity\|getGoogleApiActivityCount\|activeRequest" src/services/googleApi.ts`                             | Passed | Core transport/activity/auth helper symbols remain in `googleApi.ts`.                                                                                    |
| `pnpm.cmd format:check`                                                                                                                                                                       | Passed | Prettier check clean.                                                                                                                                    |
| `pnpm.cmd lint:report`                                                                                                                                                                        | Passed | ESLint stylish report clean.                                                                                                                             |
| `pnpm.cmd lint:errors`                                                                                                                                                                        | Passed | ESLint quiet check clean.                                                                                                                                |
| `pnpm.cmd test:unit`                                                                                                                                                                          | Passed | 33 test files, 264 tests passed; existing Vitest/browser test warnings printed.                                                                          |
| `pnpm.cmd test:integration`                                                                                                                                                                   | Passed | 2 test files, 10 tests passed; existing `--localstorage-file` warning printed.                                                                           |
| `pnpm.cmd build`                                                                                                                                                                              | Passed | Sitemap generation, TypeScript check, and Vite build passed; existing Vite bcrypt `crypto` externalization warning printed.                              |
| `pnpm.cmd quality`                                                                                                                                                                            | Passed | Full quality gate passed after the checkpoint document was added.                                                                                        |

## Go / No-Go

GO for final refactor checkpoint planning.

Rationale:

- `pnpm quality` passes.
- `src/types.ts` compatibility facade is intact.
- feature type modules own the expected contracts.
- no duplicate moved type definitions remain in `src/types.ts`.
- no feature type module imports from `src/types.ts`.
- API facades are facade-first.
- auth/session/users were not moved.
- `googleApi.ts` implementation was not changed.
- Apps Script/backend/package/route/cache/UI guardrails were preserved.
