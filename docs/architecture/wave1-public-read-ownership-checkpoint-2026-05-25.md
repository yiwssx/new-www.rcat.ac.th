# Wave 1 Public Read Ownership Checkpoint - 2026-05-25

> Historical note, 2026-07-04: This checkpoint describes a previous migration state and is not the current runtime source of truth. Current runtime ownership has advanced: structured public/admin data uses Cloudflare Worker + D1, Apps Script is retained only for the Vercel-proxied Google Drive media/file bridge, cleanup is completed, preview field verification is in progress, and M20 production cutover remains gated.

## Executive Summary

Wave 1 public-read ownership consolidation is clean and behavior-preserving. The public read API/cache entry points now live behind feature boundaries for public content, public home, public programs, and public search, while the previous service cache modules remain as compatibility shims.

Runtime behavior appears unchanged. The refactor did not change routes, UI composition, Apps Script code, API response shapes, cache keys, cache TTLs, authentication behavior, package dependencies, or `googleApi.ts` implementation.

The project is ready to plan Wave 2 Admin CMS Ownership Split, with the guardrails listed below.

## Feature Boundary Verification

- `src/features/public-content/` owns the public content list API facade, content detail API facade, public content list cache helpers, and content detail cache re-exports.
- `src/features/public-home/` owns the public home API facade and public home cache helpers.
- `src/features/public-programs/` owns the public program list API facade and public program list cache helpers.
- `src/features/public-search/` owns the public search index API facade and public search index cache helpers.
- `src/public/hooks/usePublicHomeSnapshot.ts` imports through `../../features/public-home`.
- `src/public/hooks/usePublicContentList.ts` imports through `../../features/public-content`.
- `src/public/hooks/usePublicContentDetail.ts` imports through `../../features/public-content`.
- `src/public/hooks/usePublicProgramList.ts` imports through `../../features/public-programs`.
- `src/public/hooks/usePublicSearchIndex.ts` imports through `../../features/public-search`.
- `src/services/googleApi.ts` has no working-tree diff and still owns the actual Google Apps Script request wrappers.
- `src/services/publicCmsCache.ts` remains the shared cache primitive for reading, writing, removing, and globally clearing public cache entries.

## Compatibility Shims

These service modules intentionally remain:

- `src/services/publicContentListCache.ts`
- `src/services/publicHomeCache.ts`
- `src/services/publicProgramListCache.ts`
- `src/services/publicSearchIndexCache.ts`

They preserve old imports, reduce review risk, and keep compatibility while callers migrate toward feature boundaries. They should only be removed after a repo-wide search proves no old imports remain and a separate cleanup checkpoint confirms the removal is safe. Current tests still import these service paths in `src/test/publicCmsCache.test.ts`, which helps verify shim compatibility.

## Cache Behavior Verification

Cache keys and TTLs are unchanged:

| Cache               | Key or Prefix                        | TTL              |
| ------------------- | ------------------------------------ | ---------------- |
| Public home         | `rcat.cms.public.home.snapshot`      | `15 * 60 * 1000` |
| Public content list | `rcat.cms.public.content-list.`      | `15 * 60 * 1000` |
| Public program list | `rcat.cms.public.program-list`       | `15 * 60 * 1000` |
| Public search index | `rcat.cms.public.search-index`       | `15 * 60 * 1000` |
| Content detail      | `rcat.cms.public.content-detail.v1.` | `30 * 60 * 1000` |

`clearPublicCmsCache` still clears the shared snapshot cache, public home cache, public document list cache, public program list cache, public search index cache, all public content list cache entries, and all content detail cache entries. `readPublicCache`, `writePublicCache`, and `removePublicCache` behavior remains unchanged in `src/services/publicCmsCache.ts`.

## API Facade Verification

The feature `api.ts` files re-export existing `googleApi.ts` wrappers:

- `src/features/public-home/api.ts` re-exports `getPublicHomeSnapshot`.
- `src/features/public-content/api.ts` re-exports `getPublicContentListSnapshot` and `getContentDetail`.
- `src/features/public-programs/api.ts` re-exports `getPublicProgramListSnapshot`.
- `src/features/public-search/api.ts` re-exports `getPublicSearchIndexSnapshot`.

No Google API transport logic, core request logic, resource mapping, response normalization, or Apps Script backend route was moved. No new fetches were introduced, and response shapes remain owned by the existing wrappers and shared types.

## Public Hook Verification

The public hooks now depend on feature boundaries while preserving their existing query behavior:

| Hook                     | Feature Boundary           | Query Key                       | Timing                                                                         |
| ------------------------ | -------------------------- | ------------------------------- | ------------------------------------------------------------------------------ |
| `usePublicHomeSnapshot`  | `features/public-home`     | `["public-home-snapshot"]`      | `staleTime` remains public home TTL; `gcTime` remains `60 * 60 * 1000`         |
| `usePublicContentList`   | `features/public-content`  | `["public-content-list", kind]` | `staleTime` remains public content list TTL; `gcTime` remains `60 * 60 * 1000` |
| `usePublicContentDetail` | `features/public-content`  | `["content-detail", slug]`      | `staleTime` remains content detail TTL; `gcTime` remains `60 * 60 * 1000`      |
| `usePublicProgramList`   | `features/public-programs` | `["public-program-list"]`       | `staleTime` remains public program list TTL; `gcTime` remains `60 * 60 * 1000` |
| `usePublicSearchIndex`   | `features/public-search`   | `["public-search-index"]`       | `staleTime` remains public search index TTL; `gcTime` remains `60 * 60 * 1000` |

## Search Results Summary

| Command                                                                                                                                                              | Result                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `rg "features/public-content\|features/public-home\|features/public-programs\|features/public-search" src`                                                           | Public hooks import feature boundaries; service shim modules re-export from feature cache modules.                                    |
| `rg "services/publicContentListCache\|services/publicHomeCache\|services/publicProgramListCache\|services/publicSearchIndexCache" src`                               | Old service cache imports remain only in `src/test/publicCmsCache.test.ts`.                                                           |
| `rg "PUBLIC_HOME_CACHE_KEY\|PUBLIC_CONTENT_LIST_CACHE_TTL_MS\|PUBLIC_PROGRAM_LIST_CACHE_KEY\|PUBLIC_SEARCH_INDEX_CACHE_KEY\|PUBLIC_CONTENT_DETAIL_CACHE_PREFIX" src` | Constants are present in feature cache modules, service shims, shared `publicCmsCache`, and cache tests. Values match prior behavior. |
| `rg "getPublicHomeSnapshot\|getPublicContentListSnapshot\|getContentDetail\|getPublicProgramListSnapshot\|getPublicSearchIndexSnapshot" src`                         | Hooks use feature exports; feature API files re-export from `googleApi.ts`; backend-oriented tests still cover Apps Script behavior.  |
| `rg "public-home\|public-content-list\|content-detail\|public-program-list\|public-search-index" src apps-script`                                                    | Existing resource names remain in config, Apps Script, tests, hooks, and pages. No new route/resource names were introduced.          |

## Command Results

| Command                                                                                                                                             | Result | Notes                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd ai:ask "Wave 1 public read ownership checkpoint audit public-content public-home public-programs public-search cache shims public hooks"` | Passed | SigMap generated focused context with 100% coverage; command also printed the existing "The system cannot find the path specified." message.   |
| `git status --short`                                                                                                                                | Passed | Clean before checkpoint document creation.                                                                                                     |
| `pnpm format:check`                                                                                                                                 | Passed | Prettier reported all matched files use configured style.                                                                                      |
| `pnpm lint:report`                                                                                                                                  | Passed | ESLint stylish report completed with no errors.                                                                                                |
| `pnpm lint:errors`                                                                                                                                  | Passed | ESLint quiet mode completed with no errors.                                                                                                    |
| `pnpm test:unit`                                                                                                                                    | Passed | 33 test files, 264 tests passed. Existing test-environment warnings were observed.                                                             |
| `pnpm test:integration`                                                                                                                             | Passed | 2 test files, 10 tests passed. Existing localstorage-file warnings were observed.                                                              |
| `pnpm build`                                                                                                                                        | Passed | Sitemap generation, TypeScript check, and Vite production build completed. Existing Vite bcryptjs crypto externalization warning was observed. |
| `pnpm quality`                                                                                                                                      | Passed | Full format, lint, unit, integration, and build sequence completed successfully.                                                               |

## Manual Smoke Checklist

| Check                         | Status                                 | Notes                                                                                                                                |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Public homepage loads         | Checked locally                        | Built SPA route loaded; without live Apps Script data it showed the public error state. Covered by `publicDataDrivenPages.test.tsx`. |
| News list page loads          | Checked locally                        | Built SPA route loaded; without live Apps Script data it showed the public error state. Covered by public data-driven page tests.    |
| Announcements list page loads | Partially checked locally              | Route navigation was attempted in built SPA smoke; live data smoke was not performed. Covered by public data-driven page tests.      |
| Blog list page loads          | Checked locally                        | Built SPA route loaded; without live Apps Script data it showed the public error state.                                              |
| Content detail page loads     | Checked locally                        | Built SPA route loaded; without live Apps Script data it showed the public error state. Covered by content detail tests.             |
| Program list loads            | Checked locally                        | Built SPA route loaded; without live Apps Script data it showed the public error state. Covered by public data-driven page tests.    |
| Search works                  | Checked by tests and local route smoke | Built search route loaded; search utility and public search page behavior are covered by tests.                                      |
| Documents still work          | Checked by tests                       | Public documents are covered by public data-driven and cache tests; no document feature files changed in this checkpoint.            |
| Site-view still works         | Checked by tests                       | `siteViewTracking.test.ts` and `publicSiteViewTracker.test.tsx` passed.                                                              |
| Who's Online still works      | Checked by tests                       | Visitor stats homepage rendering and visitor stats normalization tests passed.                                                       |

Live Apps Script smoke was not performed during this checkpoint. The local browser smoke validates route/rendering resilience in the built SPA, while the passing tests provide stronger behavior coverage for data-dependent flows.

## Remaining Risks

- `PublicHomeSnapshot` is still broad and should not be split casually.
- `googleApi.ts` still centralizes the actual transport and API wrapper implementations.
- Service compatibility shims still exist intentionally and should not be deleted in Wave 2.
- `publicCmsCache.ts` still knows multiple public cache keys for global clearing.
- This refactor does not improve backend latency or Apps Script response time.

## Recommended Next Step

Proceed with Wave 2 Admin CMS Ownership Split.

Wave 2 guardrails:

- Do not move auth/session ownership.
- Do not migrate or redesign the backend.
- Do not delete service shims yet.
- Keep admin behavior, API response shapes, routes, cache behavior, and permissions unchanged.

## Go / No-Go

GO for Wave 2 planning.

Reasons:

- Public read ownership is now feature-based for the targeted hooks and cache/API entry points.
- Compatibility shims are present and intentional.
- Cache keys and TTLs are unchanged.
- No backend/API/UI/runtime behavior changes were found.
- `pnpm quality` passes.
