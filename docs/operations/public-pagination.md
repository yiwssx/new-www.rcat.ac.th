# Public Pagination

Public list pages use URL-owned pagination so TanStack Router, the browser, and SSR loaders share the same page state. News and Blog now use Worker/D1 pagination for their normal unfiltered archive routes, while filtered `tag`/`category` views deliberately retain the complete snapshot so filtering semantics remain exact across the full archive. Other archive surfaces remain incremental as described below.

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
- News, Blog, and announcements preserve `tag` and `category` filters while paging.
- Search preserves `q` while paging.
- Route search validators normalize positive integer page values and trimmed text filters before route components consume the location.
- Page `1`, invalid page values, and blank text filters are treated as the default and omitted from normalized route search state.
- Unrelated query parameters are preserved when validated pagination/filter state is normalized.
- Pagination changes use TanStack Router navigation so browser back/forward behavior and server rendering share the same URL source of truth.
- When a filter changes or a requested page exceeds the available page count, pagination uses the safe page without requiring browser-owned URL parsing.

## Canonical Pagination Policy

Indexable Public archive pages use self-referencing canonicals for normalized pagination state:

- `/news?page=2` canonicals to `/news?page=2`.
- `/blog?page=3` canonicals to `/blog?page=3`.
- `/announcements?announcementsPage=2&pagesPage=3` keeps both independent page channels in the canonical URL.
- Page `1` and invalid page values canonicalize to the base route.
- Filter/tracking parameters such as `tag`, `category`, and `utm_*` are not copied into the pagination canonical by this policy.
- `/search` remains `noindex,follow` and canonicals to `/search`; query-specific Search SEO can be revisited separately.

This keeps page 2+ crawlable as distinct archive pages without making arbitrary filters or tracking parameters canonical URL variants.

## Worker Pagination Contracts

### Public content lists

`GET /api/public/content?kind=<kind>&page=<page>&pageSize=<pageSize>` uses a D1 `COUNT(*)` query plus a paged `SELECT ... LIMIT ? OFFSET ?` query. The Worker does not load the complete content list and slice it in memory when pagination is requested.

The active unfiltered News and Blog routes use this contract with a page size of 12 from both SSR route loaders and the hydrating browser query. Requested pages therefore return only the content summaries and referenced media needed for that archive page.

The legacy unpaginated content-list URL remains available where a complete snapshot is still required. In particular, News and Blog `tag`/`category` filter views retain the full snapshot until those filters are moved into a dedicated Worker/D1 filtering contract, preventing a filter from accidentally matching only the currently fetched page.

### Announcement public pages

The `pageItems` collection returned with `kind=announcements` is independently paginated. The active UI uses:

`GET /api/public/content?kind=announcements&pagesPage=<page>&pagesPageSize=<pageSize>`

The Worker performs a D1 `COUNT(*)` for published `type=page` rows and a matching `LIMIT/OFFSET` read. The response returns only the requested `pageItems` slice plus `pageItemsPagination` containing:

- `page`
- `pageSize`
- `totalItems`
- `totalPages`

The default public-page slice is page 1 with 12 items even when the auxiliary pagination parameters are omitted. This prevents the announcements endpoint from loading every published page row merely to render the first Public page list.

`announcementsPage` remains independent and currently paginates the announcement snapshot in the browser. `pagesPage` changes the TanStack Query key and issues a new Worker request for the selected Public page slice.

### Public search

`GET /api/public/search?q=<query>&page=<page>&pageSize=<pageSize>` is the active Search page contract. Search filtering, result ordering, total counting, and page slicing are Worker/D1-owned. The response includes:

- `page`
- `pageSize`
- `totalItems`
- `totalPages`

The Search page renders the returned page directly and uses TanStack Router to update `page` while preserving `q`. A response without pagination metadata remains compatible as an incremental-rollout fallback and is sliced in the browser.

### Limits

- `pageSize` and `pagesPageSize` are constrained to 1–100 by the Worker.
- The default main content-list page size is 20 when `page` is supplied without `pageSize`.
- Public News and Blog route loaders explicitly request 12 items per page.
- The default announcement Public page slice is 12.
- Requested pages beyond the available range are clamped to the final page.
- No database schema or D1 migration is required.

## Read Scope Hardening

Paged content/search responses avoid unrelated full-table reads:

- Content list summaries omit article bodies.
- Unfiltered News and Blog use D1 `COUNT + LIMIT/OFFSET` instead of a complete archive read.
- Announcement `pageItems` use D1 `COUNT + LIMIT/OFFSET`; the route does not call the unpaginated `type=page` list reader.
- Content list media is loaded only for media IDs referenced by the returned content/page rows.
- Content detail media is loaded only by the detail item's `featuredMediaId` and `mediaIds` references.
- Search uses lightweight shell metadata (`siteSettings`, `homepageSettings`, `displaySettings`, and `menu`) and does not load the complete media, carousel, external-service, or event collections.

These boundaries keep dehydrated SSR payloads and D1 work proportional to the requested page instead of the total dataset for the migrated surfaces.

## Current Scope

- Search uses Worker-owned server pagination in the current Public UI.
- Unfiltered `/news` and `/blog` archives use Worker-owned server pagination in both SSR route loaders and browser queries.
- News/Blog `tag` or `category` filter views intentionally retain full-list client filtering until Worker-side filter semantics are introduced.
- The Public page list inside `/announcements` uses Worker-owned server pagination through `pagesPage`.
- The main announcement list still uses browser pagination and is the next content-list candidate for the combined primary/page-items pagination contract.
- The home achievement payload remains limited at the Worker public home snapshot level.
- No Apps Script changes are required.

## SSR Readiness

Router-owned search state is required for server rendering because the server and the hydrating browser must derive the same page/filter selection from the request URL. Browser-only `window.location` snapshots or custom `pushState` events would otherwise produce a different first render during hydration.

For News and Blog, route `loaderDeps` now derive the unfiltered page from normalized TanStack Router search state and preload the same paged query key that the page hook consumes. Filtered routes preload the full-list key instead. This keeps SSR, hydration, browser navigation, and D1 read scope aligned.
