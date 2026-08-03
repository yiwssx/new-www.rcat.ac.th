# Public Pagination

Public list pages use URL-owned pagination so TanStack Router, the browser, and future SSR loaders share the same page state. Most archive pages still render a browser-side page slice from their existing snapshot, while the Worker now exposes true D1-backed pagination contracts for content lists and search.

## Home Achievements

- The home section `ผลงานและความภาคภูมิใจ` renders the latest 6 achievement items.
- Items are sorted by `publishAt` descending before the 6-item limit is applied.
- The full archive is available at `/achievements`.

## Archive Route

- `/achievements` shows published content whose title, summary, category, or tags match achievement semantics such as `achievement`, `award`, `รางวัล`, `ผลงาน`, `ความสำเร็จ`, `ความภาคภูมิใจ`, `ชนะเลิศ`, `รองชนะเลิศ`, or `เหรียญ`.
- The archive sorts by `publishAt` descending.

## Page Sizes

- News: 12 per page.
- Announcements: 12 per page.
- Public pages inside announcements: 12 per page, using `pagesPage`.
- Documents: 15 per page.
- Calendar: 12 per page.
- Achievements: 12 per page.
- Search results: 12 per page.
- Departments/programs: 12 per page.
- Blog: 12 per page.

## Query Parameters

TanStack Router owns Public URL search state. Public list rendering no longer reads `window.location.search` or mutates `window.history` directly.

- Most public list pages use `page`.
- The announcements page has two independent lists:
  - `announcementsPage` for announcements.
  - `pagesPage` for public page items.
- News and announcements preserve `tag` and `category` filters while paging.
- Search preserves `q` while paging.
- Route search validators normalize positive integer page values and trimmed text filters before route components consume the location.
- Page `1`, invalid page values, and blank text filters are treated as the default and omitted from normalized route search state.
- Unrelated query parameters are preserved when validated pagination/filter state is normalized.
- Pagination changes use TanStack Router navigation so browser back/forward behavior and future server rendering share the same URL source of truth.
- When a filter changes or a requested page exceeds the available page count, pagination uses the safe page without requiring browser-owned URL parsing.

## Worker Pagination Contracts

### Public content lists

`GET /api/public/content?kind=<kind>&page=<page>&pageSize=<pageSize>` uses a D1 `COUNT(*)` query plus a paged `SELECT ... LIMIT ? OFFSET ?` query. The Worker no longer loads the complete content list and slices it in memory when pagination is requested.

The legacy unpaginated content-list URL remains available for current archive pages that have not yet moved to route-loader pagination.

### Public search

`GET /api/public/search?q=<query>&page=<page>&pageSize=<pageSize>` is the active Search page contract. Search filtering, result ordering, total counting, and page slicing are Worker/D1-owned. The response includes:

- `page`
- `pageSize`
- `totalItems`
- `totalPages`

The Search page renders the returned page directly and uses TanStack Router to update `page` while preserving `q`. A response without pagination metadata remains compatible as an incremental-rollout fallback and is sliced in the browser.

### Limits

- `pageSize` is constrained to 1–100 by the Worker.
- The default page size is 20 when `page` is supplied without `pageSize`.
- Requested pages beyond the available range are clamped to the final page.
- No database schema or D1 migration is required.

## Read Scope Hardening

Paged content/search responses avoid unrelated full-table reads:

- Content list summaries omit article bodies.
- Content list media is loaded only for media IDs referenced by the returned content/page rows.
- Content detail media is loaded only by the detail item's `featuredMediaId` and `mediaIds` references.
- Search uses lightweight shell metadata (`siteSettings`, `homepageSettings`, `displaySettings`, and `menu`) and does not load the complete media, carousel, external-service, or event collections.

These boundaries keep later dehydrated SSR payloads and D1 work proportional to the requested page instead of the total dataset.

## Current Scope

- Search now uses Worker-owned server pagination in the current Public UI.
- Other archive pages can adopt the same paginated content-list contract during the route-loader migration; their current browser pagination remains backward compatible until then.
- The home achievement payload remains limited at the Worker public home snapshot level.
- No Apps Script changes are required.

## SSR Readiness

Router-owned search state is required before server rendering because the server and the hydrating browser must derive the same page/filter selection from the request URL. Browser-only `window.location` snapshots or custom `pushState` events would otherwise produce a different first render during hydration.

The D1-backed content/search pagination contracts are now suitable for route loaders because a request for one page no longer requires loading all matching content rows into the Worker first.
