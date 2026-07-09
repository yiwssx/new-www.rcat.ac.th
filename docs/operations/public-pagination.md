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

- Most public list pages use `page`.
- The announcements page has two independent lists:
  - `announcementsPage` for announcements.
  - `pagesPage` for public page items.
- Existing query filters such as `tag`, `category`, `search`, and `q` are preserved when the page changes.
- Invalid page values are clamped safely.

## Current Scope

- This is UI/render pagination. The frontend still receives the current public read snapshot, but cards are rendered only for the current page slice.
- The home achievement payload is also limited at the Worker public home snapshot level.
- No database schema changes are required.
- No D1 migrations are required.
- No Apps Script changes are required.

## Future Scale Note

If public datasets grow very large, add server-side pagination to the relevant Cloudflare Worker endpoints so the browser does not need to download full list snapshots.
