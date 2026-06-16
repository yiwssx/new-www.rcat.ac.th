# M18 Admin + D1 Write Batch Migration

Status: M18 repository implementation complete. External preview smoke is `BLOCKED_SAFE` until non-production execution values are supplied. This is one cohesive milestone, not a production cutover.

## Objective

Move the structured admin write path that maintains the M17 public-read data toward Cloudflare Worker + D1 in dev/preview mode.

M18 covers structured application data only. Apps Script remains the production fallback and remains responsible for Google Drive media-file operations.

## Single Milestone Policy

M18 is delivered as one milestone. This document intentionally does not define numbered or lettered M18 sub-milestones, endpoint-specific mini-milestones, or a schema-only planning checkpoint.

Internal implementation phases are allowed inside M18, but the repository work is treated as one Admin + D1 Write Batch Migration.

## Admin Write Inventory

| Current frontend mutation         | Current Apps Script resource/action              | Current Apps Script implementation                | Target Worker route                                           | Target D1 table         | Validation contract                                                        | Public read affected                                                                                                 | Media bridge                                             |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `saveContentItem`                 | `content`                                        | `upsertContent`                                   | `POST /api/admin/content`, `PATCH /api/admin/content/:id`     | `contents`              | content type/status, title, slug, owner, duplicate slug, optional revision | `/api/public/content`, `/api/public/content/:slug`, `/api/public/search`, `/api/public/programs`, `/api/public/home` | media references only; Drive files stay Apps Script      |
| `publishContent`                  | `publish`                                        | `publishContent`                                  | `POST /api/admin/content/:id/publish`                         | `contents`              | existing id, status transition                                             | public content/search/program/home visibility                                                                        | not applicable                                           |
| unpublish equivalent              | status update through `content`                  | `upsertContent`                                   | `POST /api/admin/content/:id/unpublish`                       | `contents`              | existing id, status transition                                             | removes item from public content/search/program/home                                                                 | not applicable                                           |
| `deleteContentItem`               | `content-delete`                                 | `deleteContent`                                   | `DELETE /api/admin/content/:id`                               | `contents`              | existing id, soft archive                                                  | removes item from public content/search/program/home                                                                 | Google Docs body deletion is not migrated                |
| `getAdminContentDetail`           | `content-detail-admin`                           | `getContentDetail`                                | `GET /api/admin/content/:id`                                  | `contents`              | existing id or slug lookup                                                 | admin edit only                                                                                                      | media references only                                    |
| `saveDocumentToApi`               | `document`                                       | `upsertDocument`                                  | `POST /api/admin/documents`, `PATCH /api/admin/documents/:id` | `documents`             | title, file URL, status, ordering, pinned, optional revision               | `/api/public/documents`, `/api/public/home`                                                                          | file URL/reference only; upload stays Apps Script        |
| `deleteDocumentFromApi`           | `document-delete`                                | `deleteDocument`                                  | `DELETE /api/admin/documents/:id`                             | `documents`             | existing id, soft archive                                                  | removes document from public documents/home                                                                          | Drive file deletion is not migrated                      |
| public-home section configuration | not currently exposed as a dedicated UI mutation | public snapshot composition                       | `GET/POST/PATCH/DELETE /api/admin/home-sections`              | `public_home_sections`  | key, title, order, enabled, duplicate key, optional revision               | `/api/public/home`                                                                                                   | not applicable                                           |
| visitor daily stats adjustment    | `visitor-stats` settings write                   | `updateVisitorStats` plus visitor stats storage   | `GET/PUT/DELETE /api/admin/visitor-stats/daily/:day`          | `visitor_daily_stats`   | day, total, unique visitors, online users, optional revision               | `/api/public/visitor-stats`                                                                                          | not applicable                                           |
| admin structured snapshot         | `snapshot-admin`                                 | `getSnapshot({ includeUnpublished: true })`       | `GET /api/admin/snapshot`                                     | `contents`, `documents` | preview token gate                                                         | admin list/detail readback                                                                                           | media arrays remain empty until media metadata migration |
| media upload/delete               | `media`, `media-delete`                          | `upsertMedia`, `deleteMedia`, Drive file handling | not migrated in M18                                           | not changed             | Apps Script auth/session remains                                           | public responses may consume existing media references                                                               | Apps Script remains owner                                |

## Implemented Route Matrix

| Route                                 | Methods                             | Purpose                                    | D1 table                |
| ------------------------------------- | ----------------------------------- | ------------------------------------------ | ----------------------- |
| `/api/admin/snapshot`                 | `GET`, `OPTIONS`                    | preview admin structured readback          | `contents`, `documents` |
| `/api/admin/content`                  | `GET`, `POST`, `OPTIONS`            | list and create/upsert content             | `contents`              |
| `/api/admin/content/:id`              | `GET`, `PATCH`, `DELETE`, `OPTIONS` | detail, update, soft archive               | `contents`              |
| `/api/admin/content/:id/publish`      | `POST`, `OPTIONS`                   | publish content                            | `contents`              |
| `/api/admin/content/:id/unpublish`    | `POST`, `OPTIONS`                   | unpublish content                          | `contents`              |
| `/api/admin/documents`                | `GET`, `POST`, `OPTIONS`            | list and create/upsert document metadata   | `documents`             |
| `/api/admin/documents/:id`            | `GET`, `PATCH`, `DELETE`, `OPTIONS` | detail, update, soft archive               | `documents`             |
| `/api/admin/documents/:id/publish`    | `POST`, `OPTIONS`                   | publish document metadata                  | `documents`             |
| `/api/admin/documents/:id/unpublish`  | `POST`, `OPTIONS`                   | unpublish document metadata                | `documents`             |
| `/api/admin/home-sections`            | `GET`, `POST`, `OPTIONS`            | list and create public-home sections       | `public_home_sections`  |
| `/api/admin/home-sections/:id`        | `PATCH`, `DELETE`, `OPTIONS`        | update or archive public-home sections     | `public_home_sections`  |
| `/api/admin/visitor-stats/daily`      | `GET`, `OPTIONS`                    | list visitor daily stats                   | `visitor_daily_stats`   |
| `/api/admin/visitor-stats/daily/:day` | `PUT`, `DELETE`, `OPTIONS`          | upsert or delete sanitized daily stat rows | `visitor_daily_stats`   |

## D1 Schema And Migration Summary

Migration: `cloudflare/public-api/migrations/0003_admin_write_batch.sql`.

The migration is additive only:

- adds `owner` to `contents` for admin edit compatibility
- adds `created_at`, `deleted_at`, `created_by`, `updated_by`, and `revision` metadata to write-owned public-read tables
- adds audit table `admin_audit_log`
- adds active-record indexes for content slug and public-home section key
- adds admin updated/revision indexes

The migration does not drop tables, drop columns, import data, seed production data, or commit any D1 identifier.

## Preview Security Gate

Admin write routes are closed by default.

The Worker requires all of:

- `ADMIN_WRITE_PREVIEW_ENABLED=true`
- `ADMIN_WRITE_TOKEN` supplied outside git
- request header `X-RCAT-Admin-Write-Token`
- non-production-like Worker environment context

Missing credentials return safe `401` or `403` responses. The token is never stored in D1, never printed, and never committed.

Admin CORS is separate from public CORS. Admin CORS supports restricted preview origins through `ADMIN_WRITE_ALLOWED_ORIGINS` and does not use a wildcard fallback.

## Frontend Provider Behavior

Default provider: Apps Script.

Cloudflare admin structured writes require:

- `VITE_BACKEND_MIGRATION_MODE=cloudflare-first-preview`
- `VITE_ADMIN_WRITE_PROVIDER=cloudflare`
- `VITE_CLOUDFLARE_PUBLIC_API_URL=<dev-or-preview-worker-origin>` or `VITE_CLOUDFLARE_ADMIN_API_URL=<dev-or-preview-worker-origin>`
- `VITE_CLOUDFLARE_ADMIN_WRITE_TOKEN=<preview-admin-token>`

Unknown, missing, empty, or invalid provider values fall back to Apps Script.

The provider wiring is focused on structured content and document mutations plus structured admin snapshot readback. Media upload/delete functions remain Apps Script-backed.

## Apps Script Media-Only Boundary

M18 does not migrate:

- Google Drive binary upload
- Google Drive file deletion
- Google Drive permission changes
- image, video, PDF, sheet, or attachment binary handling
- Google Docs body-file creation or deletion
- auth, users, password, or session migration

Structured D1 records may store already-provided media/document references. The Worker does not call Google Drive.

## Tests

M18 tests cover:

- Worker admin gate disabled, missing credential, invalid credential, and valid credential
- admin CORS and unsupported methods
- malformed JSON, missing required fields, invalid status values, duplicate slug conflicts
- stale revision conflict
- content create, update, publish, unpublish, and archive
- document metadata create, publish, deterministic ordering, and archive
- public home section writes
- visitor daily stat writes
- D1 failure safe errors without stack, SQL, token, or secret leakage
- public reads reflecting published D1 writes and excluding draft/unpublished/archived records
- frontend Apps Script default and fallback behavior
- explicit Cloudflare preview structured writes
- Apps Script media upload/delete retention
- M18 preview smoke runner gates, URL safety, write lifecycle, cleanup, and redaction

## Local Verification

Required local checks for M18:

```bash
pnpm worker:typecheck
pnpm test
pnpm build
pnpm format:check
pnpm lint
```

Focused checks:

```bash
pnpm vitest run cloudflare/public-api/test/adminWriteRoutes.test.ts
pnpm vitest run cloudflare/public-api/test/adminWritePreviewSmoke.test.mjs
pnpm vitest run src/config/adminWriteProvider.test.ts src/features/admin-write/adminWriteProvider.test.ts
```

Local D1 migration may be applied only to the local development database:

```bash
pnpm worker:d1:migrate:local
```

## Preview Smoke Command

Script:

```bash
pnpm worker:admin-write:preview-smoke
```

Required environment:

- `RCAT_M18_ADMIN_WRITE_SMOKE_APPROVAL=APPROVED_M18_ADMIN_WRITE_PREVIEW_SMOKE`
- `RCAT_PREVIEW_WORKER_URL=<dev-or-preview-worker-origin>`
- `RCAT_M18_ADMIN_WRITE_TOKEN=<preview-admin-token>`

The smoke runner creates one uniquely identifiable sanitized M18 preview content record, verifies admin read-after-write, updates it, publishes it, verifies public visibility, unpublishes it, verifies public disappearance, archives it, and prints only redacted status.

It does not deploy Worker code, mutate Vercel environment, run Wrangler, apply D1 migrations, seed remote D1, or touch production.

## Rollback Behavior

Preview rollback is environment-only:

- remove `VITE_ADMIN_WRITE_PROVIDER`
- or set `VITE_ADMIN_WRITE_PROVIDER=apps-script`
- remove the preview admin token from the frontend preview environment

Apps Script routes remain present. Production provider remains Apps Script. No production rollback action is required for M18.

## Known External Execution Status

M18 repository implementation is complete without remote preview credentials.

External preview smoke status for this checkpoint is `BLOCKED_SAFE` until the operator supplies non-production Worker URL, preview admin token, and approved execution environment.

This blocked-safe state is not a new milestone.

Next operator action when non-production preview resources are ready:

```bash
RCAT_M18_ADMIN_WRITE_SMOKE_APPROVAL=APPROVED_M18_ADMIN_WRITE_PREVIEW_SMOKE
RCAT_PREVIEW_WORKER_URL=<dev-or-preview-worker-origin>
RCAT_M18_ADMIN_WRITE_TOKEN=<preview-admin-token>
pnpm worker:admin-write:preview-smoke
```

## Production Safety

M18 does not perform:

- production frontend cutover
- production Worker deployment
- production D1 migration
- production D1 import
- production D1 write
- production Vercel environment mutation
- Apps Script modification
- `src/services/googleApi.ts` modification
- UI, route layout, cache key, or cache TTL redesign
- admin auth/user migration
- media upload/delete migration

No production URLs, preview Worker URLs, D1 ids, Cloudflare account ids, deployment ids, API tokens, admin write tokens, Google Drive URLs, Apps Script URLs, real records, or personal data are committed.

## M18 Acceptance Criteria

M18 repository implementation is accepted when:

- structured admin write inventory is documented
- additive D1 migration exists
- structured admin Worker routes are implemented
- preview-only write security gate is implemented and tested
- frontend structured-write provider exists
- Apps Script remains default and fallback
- Apps Script remains responsible for media-file operations
- public reads reflect published D1 writes
- drafts, unpublished records, and archived records remain excluded from public reads
- validation, conflict, safe failure, and leakage tests pass
- M17 public-read tests remain passing
- approval-gated M18 preview smoke runner exists
- rollback to Apps Script is documented
- no production mutation occurs
- no secret or infrastructure identifier is committed
- no M18 sub-milestone is created

## Next Milestone

The next milestone should be named only after M18 is accepted.

Do not start the next milestone from this document while M18 preview smoke is still blocked-safe.
