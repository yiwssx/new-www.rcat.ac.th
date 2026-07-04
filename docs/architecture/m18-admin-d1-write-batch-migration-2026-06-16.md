# M18 Admin + D1 Write Batch Migration

> Historical note, 2026-07-04: This checkpoint remains a historical record of the admin write migration. Current runtime ownership has advanced: structured public/admin data uses Cloudflare Worker + D1, Apps Script is retained only for the Vercel-proxied Google Drive media/file bridge, cleanup is completed, preview field verification is in progress, and M20 production cutover remains gated.

Status: M18 completed. External non-production Preview D1 migration and admin write lifecycle smoke passed by operator-confirmed external execution. This is one cohesive milestone, not a production cutover.

Latest D1-safe correction: the previous `0004_admin_write_hardening.sql` trigger design used nested `CASE ... END` expressions inside `CREATE TRIGGER ... BEGIN ... END` bodies. Fresh isolated local Wrangler D1 accepted that SQL, which proves it was not a SQLite syntax error. The external Preview failure reported `incomplete input`, consistent with a remote migration parser/splitter hazard around nested `END` tokens in trigger bodies. The committed `0004` now avoids that shape entirely by using separate, mutually exclusive `WHEN`-guarded triggers for archive, publish, unpublish, and normal update audit actions.

Previous hardening correction: the committed production Worker environment now has explicit safe placeholder-only vars that mark it as production and disable M18 preview write/smoke gates. The preview smoke cleanup path now sends the latest revision through `If-Match` instead of relying on a DELETE JSON body.

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
| admin structured snapshot         | `snapshot-admin`                                 | `getSnapshot({ includeUnpublished: true })`       | `GET /api/admin/snapshot`                                     | `contents`, `documents` | Cloudflare Access or smoke-token preview gate                              | admin list/detail readback                                                                                           | media arrays remain empty until media metadata migration |
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

Migrations:

- `cloudflare/public-api/migrations/0003_admin_write_batch.sql`
- `cloudflare/public-api/migrations/0004_admin_write_hardening.sql`

The migration is additive only:

- adds `owner` to `contents` for admin edit compatibility
- adds `created_at`, `deleted_at`, `created_by`, `updated_by`, and `revision` metadata to write-owned public-read tables
- adds audit table `admin_audit_log`
- adds active-record indexes for content slug and public-home section key
- adds admin updated/revision indexes

The hardening migration adds trigger-backed audit logging for `contents`, `documents`, `public_home_sections`, and `visitor_daily_stats`. Audit rows are now written inside the same D1 statement/transaction as the structured mutation. The application route no longer performs separate mutation-then-audit writes.

The hardening migration is parser-safe for D1 remote migration application:

- no trigger body contains nested `CASE ... END`
- all triggers use `CREATE TRIGGER IF NOT EXISTS`
- content update audit is split into `archive`, `publish`, `unpublish`, and normal `update` triggers
- document update audit is split into `archive`, `publish`, `unpublish`, and normal `update` triggers
- public-home section update audit is split into `archive` and normal `update` triggers
- visitor daily stats retain direct `create`, `update`, and `delete` triggers
- archive triggers have priority when a status change and archive happen in the same mutation
- trigger `WHEN` clauses are mutually exclusive, so one successful mutation creates exactly one audit row
- stale no-op mutations and failed D1 mutations create no audit row

The migrations do not drop tables, drop columns, import data, seed production data, or commit any D1 identifier.

## Preview Security Gate

Admin write routes are closed by default.

Browser preview admin requests require Cloudflare Access:

- `ADMIN_WRITE_PREVIEW_ENABLED=true`
- `ADMIN_WRITE_AUTH_MODE=cloudflare-access`
- `ADMIN_WRITE_ACCESS_TEAM_DOMAIN`
- `ADMIN_WRITE_ACCESS_AUD`
- optional `ADMIN_WRITE_ALLOWED_EMAILS`
- request header `Cf-Access-Jwt-Assertion`
- allowed browser `Origin` from `ADMIN_WRITE_ALLOWED_ORIGINS`
- non-production-like Worker environment context

The Worker validates the Access JWT signature through JWKS, issuer, audience, expiration, and authenticated email. The audit actor is derived from the verified Access identity; browser-supplied actor headers are not trusted.

CLI smoke requests use a separate uncommitted smoke credential:

- `ADMIN_WRITE_SMOKE_ENABLED=true`
- `ADMIN_WRITE_SMOKE_TOKEN` supplied outside git
- request header `X-RCAT-Admin-Smoke-Token`
- no `Origin` header
- non-production-like Worker environment context

Committed production Worker config is intentionally placeholder-only and explicit:

- `ENVIRONMENT=production`
- `ADMIN_WRITE_PREVIEW_ENABLED=false`
- `ADMIN_WRITE_SMOKE_ENABLED=false`
- production D1 binding remains `production-placeholder`

This makes a Worker deployed with the production environment unambiguously production-like to `hasProductionContext()` and keeps M18 preview admin writes rejected. No real production D1 id, URL, token, account id, or secret is committed.

Missing or invalid credentials return safe `401` or `403` responses. JWT contents, key material, audience values, team domains, smoke tokens, stacks, and SQL are never returned in API errors.

Admin CORS is separate from public CORS. Admin CORS supports restricted preview origins through `ADMIN_WRITE_ALLOWED_ORIGINS` and does not use a wildcard fallback.

## Frontend Provider Behavior

Default provider: Apps Script.

Cloudflare admin structured writes require:

- `VITE_BACKEND_MIGRATION_MODE=cloudflare-first-preview`
- `VITE_ADMIN_WRITE_PROVIDER=cloudflare`
- `VITE_CLOUDFLARE_PUBLIC_API_URL=<dev-or-preview-worker-origin>` or `VITE_CLOUDFLARE_ADMIN_API_URL=<dev-or-preview-worker-origin>`
- `VITE_CLOUDFLARE_ADMIN_AUTH_MODE=cloudflare-access`

Unknown, missing, empty, or invalid provider values fall back to Apps Script.

No browser-visible `VITE_*` variable contains an admin write secret. Browser requests rely on the Cloudflare Access session and use `credentials: "include"`.

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
- Cloudflare Access missing JWT, invalid JWT, wrong audience, expired JWT, disallowed email, and verified identity
- smoke token accepted only when smoke mode is enabled and no browser `Origin` is present
- disallowed admin `Origin` rejected before D1 mutation
- admin CORS and unsupported methods
- malformed JSON, missing required fields, invalid status values, duplicate slug conflicts
- stale revision conflict
- mutation-level revision checks for update, publish, unpublish, and archive operations
- parser-safe trigger-backed audit rows and no separate application audit insert
- no nested `CASE ... END` inside trigger bodies
- split audit triggers with mutually exclusive `WHEN` clauses
- content create, update, publish, unpublish, and archive
- document metadata create, publish, deterministic ordering, and archive
- public home section writes
- visitor daily stat writes
- one audit row per successful mutation and no audit row for stale or failed mutations
- D1 failure safe errors without stack, SQL, token, or secret leakage
- public reads reflecting published D1 writes and excluding draft/unpublished/archived records
- frontend Apps Script default and fallback behavior
- explicit Cloudflare preview structured writes
- Apps Script media upload/delete retention
- M18 preview smoke runner gates, URL safety, unique IDs/slugs, semantic public-read checks, best-effort cleanup, and redaction

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

Fresh isolated local D1 acceptance was also run with Wrangler `--local --persist-to <temp-dir>`:

- first apply recorded `0001_public_read_schema.sql` through `0004_admin_write_hardening.sql`
- `sqlite_master` contained all 16 expected audit triggers
- a second apply against the same isolated state returned no migrations to apply
- SQL semantic smoke produced the expected action sequences:
  - content: `create update publish unpublish archive`
  - document: `create update publish unpublish archive`
  - public home section: `create update archive`
  - visitor daily stats: `create update delete`
  - archive priority cases: `create archive`

## Preview Smoke Command

Script:

```bash
pnpm worker:admin-write:preview-smoke
```

Required environment:

- `RCAT_M18_ADMIN_WRITE_SMOKE_APPROVAL=APPROVED_M18_ADMIN_WRITE_PREVIEW_SMOKE`
- `RCAT_PREVIEW_WORKER_URL=<dev-or-preview-worker-origin>`
- `RCAT_M18_ADMIN_WRITE_SMOKE_TOKEN=<preview-smoke-token>`

The smoke runner creates one uniquely identifiable sanitized M18 preview content record, verifies admin read-after-write, updates it using the current revision, publishes it using the current revision, verifies exact public visibility, unpublishes it using the current revision, verifies exact public disappearance, archives only the run-created record using an `If-Match` header with the latest revision, verifies admin archive/not-active state, verifies public cleanup, and prints only redacted status.

Cleanup is attempted in a `finally` path whenever creation succeeded. Cleanup failure makes the smoke result `FAILED`.

Cleanup DELETE requests do not rely on a JSON body for optimistic concurrency. The revision is sent as an HTTP precondition header, for example:

```http
If-Match: "4"
```

It does not deploy Worker code, mutate Vercel environment, run Wrangler, apply D1 migrations, seed remote D1, or touch production.

## External Preview Acceptance Result

Status: `PASSED`.

Target: non-production Preview Worker and non-production Preview D1.

Evidence source: operator-confirmed external execution using redacted preview infrastructure values.

The operator confirmed that the corrected `0004_admin_write_hardening.sql` migration was accepted by non-production Preview D1, the expected 16 audit triggers were verified, and the Preview Worker was deployed with the admin write preview gate enabled. Smoke authentication used the non-browser credential path with an operator-provided smoke credential kept outside git.

The sanitized admin write lifecycle smoke passed:

- create draft passed
- admin read-after-write passed
- revision-controlled update passed
- publish passed
- public visibility passed
- unpublish passed
- public disappearance passed
- archive cleanup with `If-Match` passed
- final admin cleanup verification passed
- final public cleanup verification passed

External acceptance checklist:

- [x] Preview D1 migration applied
- [x] Expected trigger set present
- [x] Preview Worker deployed
- [x] Admin smoke authentication accepted
- [x] Draft creation passed
- [x] Admin read-after-write passed
- [x] Revision-controlled update passed
- [x] Publish passed
- [x] Public visibility passed
- [x] Unpublish passed
- [x] Public disappearance passed
- [x] Archive cleanup with `If-Match` passed
- [x] Final cleanup verification passed
- [x] Leakage check passed
- [x] No Production mutation occurred

No public smoke record remained after cleanup. No sensitive response leakage was reported.

M18 acceptance is not Production approval. It does not authorize M15.2 real production frontend cutover, a Production D1 migration, a Production D1 import, a Production Worker deploy, or any Production write. Production D1 identifiers, Access policy details, migration procedure, monitoring, and rollback execution remain out of scope for this document. Apps Script remains Production provider until a future approved cutover gate.

## Rollback Behavior

Preview rollback is environment-only:

- remove `VITE_ADMIN_WRITE_PROVIDER`
- or set `VITE_ADMIN_WRITE_PROVIDER=apps-script`
- remove the Cloudflare Access preview route/session requirement from the preview frontend path if configured externally
- remove the smoke token from Worker preview secrets if no longer needed

Apps Script routes remain present. Production provider remains Apps Script. No production rollback action is required for M18.

## Known External Execution Status

Status: `PASSED`.

M18 repository implementation remains safe without remote preview credentials or infrastructure identifiers committed.

The previously reported external Preview D1 migration failure has been resolved for M18 acceptance by operator-confirmed external execution of the corrected parser-safe migration against non-production Preview D1.

The operator confirmed:

- Preview D1 `0004` accepted.
- The expected 16 trigger-backed audit triggers were verified.
- Preview Worker deployment and Preview D1 binding were completed outside git.
- Cloudflare Access browser boundary remained in place.
- CLI smoke-token authentication remained separate from browser Access authentication.
- `pnpm worker:admin-write:preview-smoke` returned `PASSED`.
- Draft creation, admin read-after-write, revision-controlled update, publish, public visibility, unpublish, public disappearance, archive cleanup with `If-Match`, and final cleanup verification passed.
- Cleanup left no active or public smoke record.
- Apps Script media-file bridge behavior was unchanged.
- No Production mutation occurred.

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

M18 repository implementation and external Preview acceptance are complete because:

- structured admin write inventory is documented
- additive D1 migration exists
- structured admin Worker routes are implemented
- preview-only write security gate is implemented and tested
- browser `VITE_*` admin write token is removed
- browser preview auth uses Cloudflare Access
- CLI smoke auth uses a separate uncommitted smoke token
- audit writes are atomic through D1 triggers
- D1 audit triggers are parser-safe for remote migration application
- fresh isolated local D1 migration acceptance passes for `0001` through `0004`
- SQL semantic smoke confirms exactly one audit row per successful mutation
- stale revision checks are mutation-level
- frontend structured-write provider exists
- Apps Script remains default and fallback
- Apps Script remains responsible for media-file operations
- public reads reflect published D1 writes
- drafts, unpublished records, and archived records remain excluded from public reads
- validation, conflict, safe failure, and leakage tests pass
- M17 public-read tests remain passing
- approval-gated M18 preview smoke runner exists
- smoke records use unique IDs and cleanup is always attempted after creation
- smoke cleanup uses `If-Match` revision guarding and fails the smoke result if cleanup fails
- production Worker env config explicitly marks production context and disables M18 preview write/smoke gates
- rollback to Apps Script is documented
- no production mutation occurs
- no secret or infrastructure identifier is committed
- no M18 sub-milestone is created
- external non-production Preview D1 migration passed by operator confirmation
- external non-production Preview Worker admin write lifecycle smoke passed by operator confirmation
- external acceptance evidence is recorded only in redacted form

## Next Milestone

M18 is closed officially.

The next work is a remaining parity and gap assessment to determine the scope of the next milestone. This document does not name or start that next milestone.
