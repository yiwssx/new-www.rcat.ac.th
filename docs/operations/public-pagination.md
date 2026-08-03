# Public Pagination

Public list pages use UI/render pagination to avoid mounting large numbers of cards at once. This keeps the public site responsive while preserving the existing Cloudflare Worker and D1 read paths.

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
- When a filter changes or a requested page exceeds the available page count, pagination replaces the route search value with the safe page instead of adding a duplicate history entry.

## Current Scope

- This is UI/render pagination. The frontend still receives the current public read snapshot, but cards are rendered only for the current page slice.
- The home achievement payload is also limited at the Worker public home snapshot level.
- This step changes frontend URL-state ownership only; route search state remains a frontend concern until server loaders and server-side pagination are introduced in later migration work.
- No database schema changes are required.
- No D1 migrations are required.
- No Apps Script changes are required.

## SSR Readiness

Router-owned search state is required before server rendering because the server and the hydrating browser must derive the same page/filter selection from the request URL. Browser-only `window.location` snapshots or custom `pushState` events would otherwise produce a different first render during hydration.

## Future Scale Note

If public datasets grow very large, add server-side pagination to the relevant Cloudflare Worker endpoints so the browser does not need to download full list snapshots.
