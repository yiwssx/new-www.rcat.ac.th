# Final Refactor Checkpoint - 2026-05-26

## Executive Summary

The structural refactor sequence is complete through P1-P5, G3-G4, Wave 1, Wave 2, Wave 3, and commitlint setup.

Ownership is now feature-based for public reads, admin CMS entry points, public documents, site-view tracking, visitor stats settings, and many feature type contracts. `src/types.ts` is now mostly a compatibility facade plus intentionally retained high-risk aggregate and auth contracts. `src/services/googleApi.ts` intentionally remains the transport and implementation owner for actual Apps Script API wrappers.

Apps Script visitor stats and documents ownership were split into dedicated backend files during P1 and P2. Conventional Commit enforcement is active through commitlint and the Husky `commit-msg` hook. The automated quality gate passes for this final checkpoint.

These refactors reduce ownership ambiguity, but they do not solve backend latency. Apps Script and Google Sheets remain the dominant public API performance bottleneck. After manual public/admin/auth smoke is confirmed, the project is ready to shift toward backend migration and performance planning.

## Completed Refactor Timeline

| Phase             | Commit/theme                    | Main change                                                                                        | Behavior changed? | Risk after completion | Notes                                                                                                          |
| ----------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| P1                | Apps Script visitor stats split | Moved visitor stats/site-view backend ownership into `apps-script/Storage.VisitorStats.gs`.        | No                | Medium                | Apps Script deployment required; `Code.gs` remains route boundary.                                             |
| P2                | Apps Script documents split     | Moved document backend ownership into `apps-script/Cms.Documents.gs`.                              | No                | Medium                | Public/admin document behavior preserved; Apps Script deployment required.                                     |
| P3                | Frontend site-view split        | Created `src/features/site-view/` for tracking logic and tracker component.                        | No                | Low-medium            | Public-only tracking, `/login`, `/admin`, throttle, and visitor id behavior preserved.                         |
| P4                | Frontend public-documents split | Created `src/features/public-documents/` for public document UI/cache ownership.                   | No                | Low-medium            | Document card behavior and cache key/TTL preserved.                                                            |
| P5 Audit          | Shared types audit              | Mapped `src/types.ts` ownership and risk before moving types.                                      | No                | Low                   | Audit-only pass prevented high-churn type movement.                                                            |
| G3                | Public-documents API facade     | Added public document API boundary while preserving `googleApi.ts` compatibility.                  | No                | Low                   | Facade-first pattern established.                                                                              |
| P5.1              | Public-documents types split    | Moved `PublicDocumentItem` and `PublicDocumentListSnapshot` to `public-documents/types.ts`.        | No                | Low                   | `src/types.ts` re-export preserved compatibility.                                                              |
| P5.2              | Visitor-stats type split        | Moved `VisitorStatsSettings` to `visitor-stats/types.ts`.                                          | No                | Low                   | Compatibility re-export preserved.                                                                             |
| Commitlint        | Conventional Commit enforcement | Added commitlint config, Husky hook, dependencies, and convention docs.                            | No                | Low                   | Hook mode verified as `100755`; valid/invalid messages verified under Git `sh`.                                |
| G4                | Site-view API facade            | Added `src/features/site-view/api.ts` as facade for `recordSiteView` and `SiteViewInput`.          | No                | Low                   | Fire-and-forget site-view behavior remains in `googleApi.ts`.                                                  |
| Wave 1            | Public-read ownership split     | Added public content/home/program/search API and cache feature boundaries.                         | No                | Low-medium            | Public-read service shims retained intentionally.                                                              |
| Wave 1 Checkpoint | Public read verification        | Verified shims, cache keys, TTLs, hooks, and API facades.                                          | No                | Low                   | `pnpm quality` passed; live Apps Script smoke not performed.                                                   |
| Wave 2            | Admin CMS ownership split       | Added CMS feature API facades and updated low-risk admin imports.                                  | No                | Medium                | `googleApi.ts` remained implementation owner.                                                                  |
| Wave 2 Checkpoint | Admin CMS verification          | Verified facade-first admin ownership and auth/user guardrails.                                    | No                | Medium                | Manual admin/auth smoke remained recommended.                                                                  |
| Wave 3            | Type contracts and safe facades | Moved remaining safe feature types, added `cms-integrations` and `shared/api/activity` facades.    | No                | Medium                | `CmsSnapshot`, `PublicHomeSnapshot`, and auth/session/user contracts intentionally retained in `src/types.ts`. |
| Wave 3 Checkpoint | Type ownership compatibility    | Verified `src/types.ts` facade, feature type modules, circular import guardrails, and API facades. | No                | Medium                | `pnpm quality` passed; manual smoke not performed.                                                             |

## Current Ownership Map

| Domain                            | Owner module                                                                                   | Implementation owner                                                                               | Compatibility facade/shim                                                   | Risk level  | Notes                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| Public home                       | `src/features/public-home`                                                                     | `src/services/googleApi.ts`, `src/services/publicCmsCache.ts`, Apps Script public-home functions   | `src/services/publicHomeCache.ts`                                           | Medium-high | `PublicHomeSnapshot` remains broad in `src/types.ts`.                        |
| Public content list/detail        | `src/features/public-content`                                                                  | `src/services/googleApi.ts`, `src/services/publicCmsCache.ts`, Apps Script content functions       | `src/services/publicContentListCache.ts`                                    | Medium      | Content detail cache prefix/TTL preserved.                                   |
| Public documents                  | `src/features/public-documents`                                                                | `src/services/googleApi.ts`, `apps-script/Cms.Documents.gs`                                        | `src/types.ts` type re-export                                               | Low-medium  | Public document UI/cache/types/API facade now feature-owned.                 |
| Public programs                   | `src/features/public-programs`                                                                 | `src/services/googleApi.ts`, Apps Script public program snapshot                                   | `src/services/publicProgramListCache.ts`                                    | Medium      | Cache key/TTL preserved.                                                     |
| Public search                     | `src/features/public-search`                                                                   | `src/services/googleApi.ts`, Apps Script search snapshot                                           | `src/services/publicSearchIndexCache.ts`                                    | Medium      | Cache key/TTL preserved.                                                     |
| Site-view tracking                | `src/features/site-view`                                                                       | `src/services/googleApi.ts`, `apps-script/Storage.VisitorStats.gs`                                 | `src/features/site-view/api.ts`                                             | Low-medium  | Tracker logic feature-owned; write implementation remains in `googleApi.ts`. |
| Visitor stats settings            | `src/features/visitor-stats`                                                                   | `src/services/googleApi.ts`, `src/services/visitorStats.ts`, `apps-script/Storage.VisitorStats.gs` | `src/types.ts` type re-export                                               | Low-medium  | Type ownership split is complete; runtime normalizers unchanged.             |
| Admin content                     | `src/features/cms-content`                                                                     | `src/services/googleApi.ts`, Apps Script CMS content functions                                     | `src/features/cms-content/api.ts`                                           | Medium-high | Facade only; content model remains shared with public content.               |
| Admin documents                   | `src/features/cms-documents`                                                                   | `src/services/googleApi.ts`, `apps-script/Cms.Documents.gs`                                        | `src/features/cms-documents/api.ts`, `src/types.ts` type re-export          | Medium      | Document save/delete implementation remains in `googleApi.ts`.               |
| Admin dashboard snapshot          | `src/features/cms-dashboard`                                                                   | `src/services/googleApi.ts`                                                                        | `src/features/cms-dashboard/api.ts`                                         | High        | `getAdminCmsSnapshot` remains broad.                                         |
| Admin carousel                    | `src/features/cms-carousel`                                                                    | `src/services/googleApi.ts`                                                                        | `src/features/cms-carousel/api.ts`, `src/types.ts` type re-export           | Medium      | Carousel input type remains in `googleApi.ts`.                               |
| Admin external services           | `src/features/cms-external-services`                                                           | `src/services/googleApi.ts`                                                                        | `src/features/cms-external-services/api.ts`, `src/types.ts` type re-export  | Medium      | API facade only.                                                             |
| Admin media                       | `src/features/cms-media`                                                                       | `src/services/googleApi.ts`, Apps Script media/Drive behavior                                      | `src/features/cms-media/api.ts`, `src/types.ts` type re-export              | High        | Drive upload behavior remains sensitive.                                     |
| Admin events                      | `src/features/cms-events`                                                                      | `src/services/googleApi.ts`                                                                        | `src/features/cms-events/api.ts`, `src/types.ts` type re-export             | Medium      | API facade only.                                                             |
| Admin settings                    | `src/features/cms-settings`                                                                    | `src/services/googleApi.ts`, settings normalizers                                                  | `src/features/cms-settings/api.ts`, `src/types.ts` type re-export           | Medium-high | Site/homepage/display/visitor settings cross public and admin.               |
| Admin navigation/menu             | `src/features/cms-navigation`                                                                  | `src/services/googleApi.ts`                                                                        | `src/features/cms-navigation/api.ts`, `src/types.ts` type re-export         | Medium      | Public/admin menu payload shape preserved.                                   |
| Integrations health check         | `src/features/cms-integrations`                                                                | `src/services/googleApi.ts`                                                                        | `src/features/cms-integrations/api.ts`                                      | Low-medium  | `checkGoogleConnection` facade added in Wave 3.                              |
| Google API request activity       | `src/shared/api/activity.ts`                                                                   | `src/services/googleApi.ts`                                                                        | `src/shared/api/activity.ts`, `src/shared/api/index.ts`                     | Medium      | Activity state still lives with transport.                                   |
| Auth/session/users                | `src/services/auth.ts`, `src/services/authSession.ts`, `src/services/users.ts`, `src/types.ts` | `src/services/googleApi.ts` and auth/user services                                                 | none beyond existing services                                               | High        | Explicitly deferred.                                                         |
| Apps Script visitor stats backend | `apps-script/Storage.VisitorStats.gs`                                                          | Apps Script global functions                                                                       | `apps-script/Code.gs` route dispatch                                        | Medium      | High-frequency write path isolated.                                          |
| Apps Script documents backend     | `apps-script/Cms.Documents.gs`                                                                 | Apps Script global functions                                                                       | `apps-script/Code.gs`, `apps-script/Cache.gs`, `apps-script/Cms.gs` callers | Medium      | Document list/admin CRUD logic isolated.                                     |
| Shared aggregate snapshots        | `src/types.ts`                                                                                 | `src/types.ts`, `src/services/googleApi.ts`, Apps Script snapshots                                 | `src/types.ts`                                                              | High        | `CmsSnapshot` and `PublicHomeSnapshot` intentionally broad.                  |
| Public cache primitives           | `src/services/publicCmsCache.ts`                                                               | `src/services/publicCmsCache.ts`                                                                   | Wave 1 service cache shims                                                  | Medium      | Global clearing still knows multiple public cache keys.                      |

## src/types.ts Final State

`src/types.ts` re-exports moved feature-owned types and remains compatible for old imports. It still owns:

- `User`
- `UserAccount`
- `Session`
- `RolePermission`
- `CmsSnapshot`
- `PublicHomeSnapshot`

These remain because auth/session/user ownership is deferred, and `CmsSnapshot` plus `PublicHomeSnapshot` are broad aggregate contracts spanning multiple feature domains.

Search results:

- `rg "export interface|export type" src/types.ts`: confirmed feature type re-exports plus the retained auth and aggregate contracts.
- `rg "\.\./types|\.\./\.\./types|\.\./\.\./\.\./types" src/features`: found only `public-home/cache.ts` importing `PublicHomeSnapshot` and `public-documents/DocumentListCard.tsx` importing `ContentItem`; no feature type module imports from `src/types.ts`.
- `rg "CmsSnapshot|PublicHomeSnapshot|UserAccount|Session|RolePermission" src`: confirmed aggregates and auth contracts remain in `src/types.ts`, `googleApi.ts`, auth/user services, tests, and expected public/admin consumers.

No duplicate moved type definitions were found in `src/types.ts`. Compatibility imports from `src/types.ts` still compile.

## googleApi.ts Final State

`src/services/googleApi.ts` still owns:

- Apps Script transport
- `googleFetch`
- `postJson`
- `ApiEnvelope`
- `readStoredSessionToken`
- request activity state and subscriptions
- actual API function bodies
- auth/session/user API wrappers

Search results:

- `rg "googleFetch|postJson|ApiEnvelope|readStoredSessionToken|subscribeGoogleApiActivity|getGoogleApiActivityCount" src/services/googleApi.ts`: confirmed all core transport/activity symbols remain in `googleApi.ts`.
- `rg "from .*services/googleApi" src/features src/shared src/admin src/public src/test`: confirmed feature API modules and shared activity are facades; tests and a small number of compatibility callers still import `googleApi.ts`.
- `rg "loginUserFromApi|getUserAccountsFromApi|saveUserAccountToApi|deleteUserAccountFromApi|resetUserAccountsFromApi" src`: confirmed auth/user wrappers remain in `googleApi.ts` and are consumed by `auth.ts` and `users.ts`.

No backend/API response shape changes were found.

## Compatibility Shims And Facades

Intentional public-read service shims remain:

- `src/services/publicContentListCache.ts`
- `src/services/publicHomeCache.ts`
- `src/services/publicProgramListCache.ts`
- `src/services/publicSearchIndexCache.ts`

Intentional feature/shared API facades exist for:

- public documents
- site-view
- public content
- public home
- public programs
- public search
- admin CMS feature groups
- cms-integrations
- shared API activity

These layers preserve old imports, reduce review risk, and let the repository continue migrating callers toward feature boundaries. They should only be removed after repo-wide searches prove no old imports remain and a separate cleanup checkpoint verifies removal safety.

## Cache And Behavior Preservation

Search results:

- `rg "PUBLIC_HOME_CACHE_KEY|PUBLIC_CONTENT_LIST_CACHE_TTL_MS|PUBLIC_PROGRAM_LIST_CACHE_KEY|PUBLIC_SEARCH_INDEX_CACHE_KEY|PUBLIC_CONTENT_DETAIL_CACHE_PREFIX" src`: confirmed public cache keys and constants remain in feature cache modules, service shims, shared cache primitive, and tests.
- `rg "SITE_VISITOR_ID_STORAGE_KEY|SITE_VIEW_THROTTLE_STORAGE_KEY|SITE_VIEW_THROTTLE_MS" src`: confirmed site-view visitor id key `rcat.site.visitor.id`, throttle key `rcat.site.view.throttle.v1`, and throttle duration `30 * 60 * 1000`.
- `rg "rcat.cms.public.document-list|PUBLIC_DOCUMENT_LIST_CACHE_TTL_MS" src`: confirmed public document cache key `rcat.cms.public.document-list` and TTL `15 * 60 * 1000`.

The checkpoint found no route changes, UI behavior changes, auth behavior changes, package changes, cache key changes, or cache TTL changes. `clearPublicCmsCache` remains in `src/services/publicCmsCache.ts` and still clears the public cache family through the shared primitive.

## Apps Script Split Verification

Search results:

- `rg "incrementSiteView|computeVisitorStats|SITE_VIEW_DUPLICATE_WINDOW_MS|normalizeVisitorStats" apps-script`: confirmed visitor stats and site-view backend ownership in `Storage.VisitorStats.gs`, with `Code.gs` dispatching `incrementSiteView`.
- `rg "getPublicDocumentListSnapshot|getDocuments|getPublicDocuments|upsertDocument|deleteDocument|normalizeDocumentRecord" apps-script`: confirmed document ownership in `Cms.Documents.gs`, with `Code.gs`, `Cms.gs`, and `Cache.gs` as callers.
- `rg "public-home|public-document-list|site-view|visitor-stats|document|document-delete" apps-script`: confirmed existing route/resource names remain in `Code.gs`, `Cache.gs`, and related backend files.

No duplicate global Apps Script ownership was found in the searched domains. `Code.gs` remains the route dispatcher and `Cache.gs` behavior remains centralized for cached public resources.

## Commitlint And Tooling Verification

Verified:

- `@commitlint/cli` and `@commitlint/config-conventional` are present in `package.json` and `pnpm-lock.yaml`.
- `commitlint.config.cjs` exists and extends `@commitlint/config-conventional`.
- `.husky/commit-msg` exists, is executable, and runs `pnpm exec commitlint --edit "$1"`.
- `docs/development/commit-convention.md` exists.

Command results:

- `git ls-files -s .husky/commit-msg`: `100755`, executable.
- `Write-Output "docs(architecture): verify final refactor checkpoint" | pnpm.cmd exec commitlint`: failed in PowerShell because `commitlint` was not resolved from local bins.
- Git `sh` equivalent passed: `printf '%s\n' 'docs(architecture): verify final refactor checkpoint' | pnpm exec commitlint`.
- Git `sh` invalid-message check failed as expected: `bad commit message` produced `subject-empty` and `type-empty`.

This matches the earlier commitlint checkpoint: the hook path is valid in the Husky/Git shell environment, while direct PowerShell `pnpm exec commitlint` remains a local-bin resolution caveat.

## Manual Smoke Checklist

Manual browser smoke was not performed in this final checkpoint. These checks remain required before backend migration readiness is treated as release-ready.

### Public

| Check                     | Status      |
| ------------------------- | ----------- |
| homepage loads            | Not checked |
| public content lists load | Not checked |
| content detail loads      | Not checked |
| documents work            | Not checked |
| programs work             | Not checked |
| search works              | Not checked |
| site-view works           | Not checked |
| Who's Online works        | Not checked |

### Admin

| Check                                    | Status      |
| ---------------------------------------- | ----------- |
| dashboard loads                          | Not checked |
| content create/edit/delete/publish works | Not checked |
| documents create/edit/delete works       | Not checked |
| media upload/save/delete works           | Not checked |
| settings save works                      | Not checked |
| integrations page loads                  | Not checked |
| calendar/events save/delete works        | Not checked |
| carousel save/delete works               | Not checked |
| external services save/delete works      | Not checked |
| menu/navigation save works               | Not checked |

### Auth

| Check                                  | Status                                             |
| -------------------------------------- | -------------------------------------------------- |
| login works                            | Not checked                                        |
| logout works                           | Not checked                                        |
| protected admin routes work            | Not checked                                        |
| unauthorized access behavior unchanged | Covered by integration tests; not checked manually |

## Remaining Risks

- Backend latency remains the main performance bottleneck.
- Apps Script and Google Sheets still dominate public API latency.
- The public-home payload is still broad.
- `src/services/googleApi.ts` is still the monolithic implementation and transport owner.
- Auth/session/users are intentionally deferred.
- `CmsSnapshot` and `PublicHomeSnapshot` are intentionally broad aggregate contracts.
- Feature API modules are still facades, not implementation owners.
- Public cache shims remain intentionally.
- Cloudflare/D1 migration has not started.

## Recommended Next Step

Proceed to Backend Migration Readiness Audit and performance planning next.

Default recommendation: shift from structural refactoring to backend migration/performance planning because structural refactor ROI is now low and backend latency is the real bottleneck.

Do not start backend migration inside this checkpoint.

## Commands Run

| Command                                                                                                                                                                                                                      | Result             | Notes                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd ai:ask "final refactor checkpoint P1 P5 G3 G4 Wave 1 Wave 2 Wave 3 commitlint ownership googleApi types Apps Script"`                                                                                              | Passed             | SigMap generated focused context with 100% coverage; existing path warning printed.                               |
| `git status --short`                                                                                                                                                                                                         | Passed             | Clean before final checkpoint document creation.                                                                  |
| `Get-Content` architecture checkpoints and commit convention docs                                                                                                                                                            | Passed             | Inspected P1-P4, P5, googleApi, P5/commitlint, Wave 1, Wave 2, Wave 3, and commit convention docs.                |
| `rg` type exports in `src/types.ts`                                                                                                                                                                                          | Passed             | Compatibility re-exports plus retained auth/aggregate contracts verified.                                         |
| `rg` feature imports from `src/types.ts`                                                                                                                                                                                     | Passed             | Only expected compatibility/aggregate imports found; no feature type module imports from `src/types.ts`.          |
| `rg` broad aggregate/auth contracts in `src`                                                                                                                                                                                 | Passed             | `CmsSnapshot`, `PublicHomeSnapshot`, `UserAccount`, `Session`, and `RolePermission` remain in expected locations. |
| `rg` googleApi core symbols                                                                                                                                                                                                  | Passed             | Core transport, envelope, session-token, and activity symbols remain in `googleApi.ts`.                           |
| `rg "from .*services/googleApi" src/features src/shared src/admin src/public src/test`                                                                                                                                       | Passed             | Feature/shared facades point to `googleApi.ts`; tests and limited compatibility callers remain.                   |
| `rg` auth/user API wrappers                                                                                                                                                                                                  | Passed             | Auth/user API wrappers remain in `googleApi.ts`; services consume them.                                           |
| `rg` public cache constants                                                                                                                                                                                                  | Passed             | Public cache constants and global clearing references verified.                                                   |
| `rg` site-view storage/throttle constants                                                                                                                                                                                    | Passed             | Site-view storage and throttle constants unchanged.                                                               |
| `rg` public document cache key/TTL                                                                                                                                                                                           | Passed             | Public document cache key and TTL unchanged.                                                                      |
| `rg` visitor stats Apps Script functions                                                                                                                                                                                     | Passed             | Visitor stats backend ownership remains in `Storage.VisitorStats.gs`.                                             |
| `rg` document Apps Script functions                                                                                                                                                                                          | Passed             | Document backend ownership remains in `Cms.Documents.gs`.                                                         |
| `rg` Apps Script route/resource names                                                                                                                                                                                        | Passed             | Apps Script route/resource references remain present.                                                             |
| `git ls-files -s .husky/commit-msg`                                                                                                                                                                                          | Passed             | Hook mode is `100755`.                                                                                            |
| `Get-Content .husky/commit-msg`                                                                                                                                                                                              | Passed             | Hook runs `pnpm exec commitlint --edit "$1"`.                                                                     |
| `Get-Content commitlint.config.cjs`                                                                                                                                                                                          | Passed             | Extends `@commitlint/config-conventional`.                                                                        |
| `rg` commitlint dependency/config/docs entries                                                                                                                                                                               | Passed             | Dependencies and docs verified.                                                                                   |
| Valid commitlint message under Git `sh`                                                                                                                                                                                      | Passed             | `docs(architecture): verify final refactor checkpoint` was accepted.                                              |
| Invalid commitlint message under Git `sh`                                                                                                                                                                                    | Failed as expected | `bad commit message` was rejected with `type-empty` and `subject-empty`.                                          |
| `git diff -- src/services/googleApi.ts apps-script src/services/auth.ts src/services/authSession.ts src/services/users.ts package.json pnpm-lock.yaml src/routes.tsx src/routeComponents.tsx src/services/publicCmsCache.ts` | Passed             | No source/backend/package guardrail diff; checkpoint remains docs-only.                                           |
| `pnpm format:check`                                                                                                                                                                                                          | Passed             | New checkpoint document was formatted with Prettier before the final pass.                                        |
| `pnpm lint:report`                                                                                                                                                                                                           | Passed             | ESLint stylish report completed with no errors.                                                                   |
| `pnpm lint:errors`                                                                                                                                                                                                           | Passed             | ESLint quiet error gate completed with no errors.                                                                 |
| `pnpm test:unit`                                                                                                                                                                                                             | Passed             | 33 test files and 264 tests passed; existing localstorage/router/act warnings printed.                            |
| `pnpm test:integration`                                                                                                                                                                                                      | Passed             | 2 test files and 10 tests passed; existing localstorage warning printed.                                          |
| `pnpm build`                                                                                                                                                                                                                 | Passed             | Sitemap generation, TypeScript no-emit, and Vite production build passed.                                         |
| `pnpm quality`                                                                                                                                                                                                               | Passed             | Full quality gate passed; generated sitemap timestamp churn was restored.                                         |

## Go / No-Go

Automated checkpoint status: GO for Backend Migration Readiness Audit planning. Release-grade GO still requires public/admin/auth smoke confirmation.

GO conditions satisfied by static/automated checkpoint work:

- `src/types.ts` compatibility remains intact.
- `pnpm quality` passes with this document included.
- Feature ownership boundaries are documented.
- `googleApi.ts` implementation remains untouched.
- Apps Script split ownership remains intact.
- Commitlint hook and config are verified.
- No source/runtime guardrail diff was introduced by this checkpoint before document creation.

Still required before backend migration readiness is release-grade:

- Public smoke must pass.
- Admin smoke must pass.
- Auth smoke must pass.

NO-GO if quality fails, auth smoke fails, admin save flows fail, public data routes fail, circular imports appear, or Apps Script duplicate ownership appears.
