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

- Public pages still use UI/render pagination by default, so the established unpaginated content-list URL remains backward compatible.
- The Cloudflare public content-list contract now also accepts opt-in `page` and `pageSize` parameters and returns pagination metadata. This capability is available for later route-loader/server-pagination adoption without forcing the current browser pages to switch in the same migration step.
- `pageSize` is constrained to 1–100 by the Worker; the default is 20 when `page` is supplied without `pageSize`.
- The home achievement payload is limited at the Worker public home snapshot level.
- Search query filtering is Worker-owned when `q` is supplied; the browser preserves the Worker result order and applies its current UI page slice.
- No database schema changes are required.
- No D1 migrations are required.
- No Apps Script changes are required.

## SSR Readiness

Router-owned search state is required before server rendering because the server and the hydrating browser must derive the same page/filter selection from the request URL. Browser-only `window.location` snapshots or custom `pushState` events would otherwise produce a different first render during hydration.

The optional Worker pagination contract provides the next-stage server data boundary, but Step 4 does not add route loaders or switch current archive pages to server pagination.

## Future Scale Note

When public datasets grow beyond the current browser snapshot budget, route loaders can adopt the existing Worker `page`/`pageSize` contract incrementally instead of introducing a second pagination API shape.
