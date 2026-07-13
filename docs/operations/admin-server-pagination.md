# Admin server-side pagination

The Admin CMS list screens read one bounded page from the authenticated Cloudflare Worker and D1. Normal list rendering no longer downloads the complete Admin CMS snapshot.

## Response contract

All paginated Admin list endpoints return:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 0,
    "totalPages": 0,
    "hasPreviousPage": false,
    "hasNextPage": false
  },
  "generatedAt": "2026-07-12T00:00:00.000Z"
}
```

The Worker runs a database `COUNT(*)` query and a separate item query with bound `LIMIT` and `OFFSET` values. It does not load every matching row and slice it in JavaScript.

Rules:

- `page` defaults to `1` and cannot be less than `1`.
- General lists default to `25` rows; Media defaults to `24` rows.
- `pageSize` is capped at `100`.
- Invalid values use safe defaults.
- A page beyond the last page is clamped to the last valid page.
- Search, filter, `LIMIT`, and `OFFSET` values are D1 bound parameters.
- Sort keys map through endpoint-specific SQL column allowlists. Raw query input is never inserted into `ORDER BY`.
- Responses use `Cache-Control: no-store` and require the existing Admin authentication/RBAC path.

## Endpoints

| Endpoint                           | Default size | Server-side filters                                    | Allowed sort keys (default)                                                                           |
| ---------------------------------- | -----------: | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `GET /api/admin/content`           |           25 | `q`, `status`, `type`, `category`, `owner`, `featured` | `updatedAt`, `publishAt`, `title`, `createdAt`, `status`, `type`, `viewCount` (`updatedAt desc`)      |
| `GET /api/admin/documents`         |           25 | `q`, `status`, `pinned`, `category`                    | `updatedAt`, `publishedAt`, `title`, `createdAt`, `order`, `pinned` (pinned group, then manual order) |
| `GET /api/admin/media`             |           24 | `q`, `type`                                            | `updatedAt`, `name`, `type`, `owner` (`updatedAt desc`)                                               |
| `GET /api/admin/events`            |           25 | `q`, `status`, `visibility`, `category`                | `date`, `updatedAt`, `title`, `status`, `category` (`date desc`)                                      |
| `GET /api/admin/users`             |           25 | `q`, `role`, `status`                                  | `email`, `name`, `role`, `status`, `createdAt`, `updatedAt` (`role`, then email)                      |
| `GET /api/admin/carousel`          |           25 | `q`, `enabled`                                         | `order`, `title`, `updatedAt`, `startAt`, `enabled` (`order asc`)                                     |
| `GET /api/admin/external-services` |           25 | `q`, `enabled`, `tone`                                 | `order`, `title`, `updatedAt`, `enabled` (`order asc`)                                                |
| `GET /api/admin/menu`              |           25 | `q`, `enabled`, `parentId`, `parentRoot`               | `order`, `label`, `updatedAt`, `enabled` (parent, then `order asc`)                                   |

Common parameters are `page`, `pageSize`, `q`, `sortBy`, and `sortDirection=asc|desc`. Each endpoint normalizes unsupported sort keys to its documented default.

Content list rows exclude the full content body (`body_snapshot`/`body`). The existing authenticated content detail endpoint remains the source for an editor session.

### Supporting reads and actions

- `GET /api/admin/media/by-ids?ids=...` resolves selected media that is not on the current picker page. It accepts at most 50 unique IDs.
- `GET /api/admin/dashboard-summary` returns aggregate counts and only bounded recent/pending records.
- `POST /api/admin/content/publish-pending` preserves the Dashboard's publish-all-pending action without downloading every pending content ID.
- `GET /api/admin/visitor-stats/summary` supplies the Settings page without the full snapshot or an unbounded daily-row read.
- The existing `GET /api/admin/settings/site` and `GET /api/admin/settings/homepage` endpoints supply their individual settings records.

## Admin URL state

List pages keep practical state in the browser URL:

- `page`
- `pageSize`
- `q`
- entity filters such as `status`, `type`, `role`, `enabled`, or `pinned`
- `sortBy`
- `sortDirection`

Back/forward navigation, refresh, and shared Admin URLs therefore preserve the current view. Search input is debounced by approximately 300 ms. Changing search, a filter, page size, or sorting resets the page to `1`; opening and closing an editor does not.

General page-size choices are `25`, `50`, and `100`. Media choices are `24`, `48`, and `96`.

TanStack Query keys include entity, page, page size, debounced search, filters, and sorting. Previous data remains visible but is marked as fetching while a replacement page is requested, preventing an empty-table flash without presenting old rows as settled new-page data.

## CRUD and page fallback

- After create, lists sorted with newest records first return to page `1`.
- Edit and publish invalidate and refetch the current query while keeping URL state.
- Delete refetches the current page. If deleting the last row makes that page invalid, the UI moves to the previous valid page and preserves search, filters, and sorting.
- List rows retain IDs and revisions needed for edit, delete, publish, and stale-write protection.
- Read-authorized users may search and paginate. Mutation controls remain governed by the existing frontend and Worker RBAC rules.

## Global ordering mode

Normal Documents, Menu, Carousel, and External Services screens use paginated list endpoints. Their global ordering data is loaded only after the user opens `จัดลำดับ`:

- `GET/PUT /api/admin/documents/order`
- `GET/PUT /api/admin/menu/order`
- `GET/PUT /api/admin/carousel/order`
- `GET/PUT /api/admin/external-services/order`

These endpoints transfer compact fields only: identity, display label/title, order, grouping/enabled state where relevant, and revision. Save updates only ordering fields and uses revision checks; it does not overwrite large or unrelated record fields. Documents retain separate pinned/unpinned ordering groups. Cancel discards the local ordering draft. Global ordering is intentionally not paginated because cross-page moves would not have a correct global position.

An order save must include the complete active compact collection (up to 2,000 rows), with a unique order within each applicable group. The Worker rejects partial, duplicate-order, stale-revision, or changed-parent submissions so global public order cannot be corrupted by a paginated slice.

Menu and External Services normal CRUD use individual record operations. A paginated slice is never sent to a destructive full-collection replacement endpoint.

## Media pickers

The Content editor and Carousel image chooser load media only when needed. They use the Media list endpoint for server-side search/type filtering and pagination. The Content editor also resolves existing selected IDs through the bounded by-ID endpoint, so an off-page attachment remains selected. Current-page thumbnails use lazy image loading.

## Why the Admin snapshot remains but is not used for lists

`GET /api/admin/snapshot` remains available for backward compatibility and migration diagnostics. It is unsuitable for growing Admin list pages because its response size and browser render cost scale with every content, document, media, and event record. Dashboard, Settings, and all large list screens now use bounded or entity-specific reads instead.

## Future index recommendations

No schema or D1 migration is required for this change. If table sizes and query latency grow materially, review `EXPLAIN QUERY PLAN` output before adding append-only migrations. Likely candidates are composite indexes matching the most common filters and default sorts, for example:

- content status/type plus `updated_at`
- documents status/pinned plus `sort_order`
- media type plus `updated_at`
- events status/visibility plus `date`
- users role/status plus email or `updated_at`
- ordered collections on `sort_order` (and Menu `parent_id, sort_order`)

Search currently uses bound `LIKE` predicates. If substring search becomes the dominant cost at much larger scale, evaluate an SQLite FTS design separately rather than adding many low-selectivity single-column indexes.
