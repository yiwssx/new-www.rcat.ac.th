# M17 Cloudflare Core Public Read Batch Migration

Status: M17-C preview smoke and contract freeze passed through externally confirmed operator execution. This is not a production cutover.

## Purpose

M17 replaces endpoint-by-endpoint milestone sprawl with a grouped Cloudflare Core Public Read API layer.

The public read layer is migrated as one coherent foundation before admin writes, auth, media upload/delete, or final production domain cutover.

## Current Context

M15.2 real execute cutover remains deferred.

M16 Cloudflare-first direction remains active.

The replacement system may use Cloudflare Worker endpoints only in dev/preview replacement-system mode.

Replacement-system endpoints before final cutover: dev/preview Worker origins only.

The old live system remains on the real production domain until final cutover is explicitly approved.

No production Vercel environment mutation, Worker production deploy, D1 production migration, D1 production import, or D1 production write occurs in M17-C.

## Dev/Preview Enforcement

M17-C uses the M16 policy:

- `VITE_BACKEND_MIGRATION_MODE=cloudflare-first-preview`
- `VITE_PUBLIC_API_PROVIDER=cloudflare`
- `VITE_CLOUDFLARE_PUBLIC_API_URL=<dev-or-preview-worker-origin>`

M17-C does not weaken M15 production validation.

Vercel preview URLs must not pass as production frontend URLs.

Preview, staging, dev, test, or sandbox Worker origins must not pass as production Worker URLs.

Apps Script fallback remains available until each public read endpoint is parity-verified and a later cutover gate is explicitly approved.

## M17-C Scope

In scope:

- approval-gated dev/preview smoke runner for the grouped public read route batch
- minimum public response contract freeze for all M17 public read endpoints
- safe redacted smoke summary output
- tests proving approval gates, URL safety, 501 failure, server-error failure, leakage failure, and valid safe response success
- current-status and M17 architecture documentation

Out of scope:

- new endpoint migration scope
- endpoint-specific milestone documents
- M18 admin write implementation
- admin write routes
- media upload/delete
- Apps Script modification
- `src/services/googleApi.ts` rewrite
- removing Apps Script fallback
- production Vercel environment mutation
- Worker production deploy
- production D1 migration, import, or write
- any command requiring an execute flag
- weakening M15 production safety gates

## M17-B Scope

In scope:

- D1-backed Worker routes for the core public read layer
- typed route contract registry marked implemented for the grouped route batch
- existing `public-document-list` route preserved
- additive D1 migration for home-section projection and read indexes
- fake local/dev seed data for home, documents, content, programs, and visitor stats
- route availability and leak-safety tests
- architecture and current status documentation

Out of scope:

- real production cutover
- production Vercel environment mutation
- real production domain routing
- Worker production deploy
- production D1 import, migration, or write
- admin write migration
- auth migration
- media upload/delete migration
- Apps Script modification
- `src/services/googleApi.ts` rewrite
- removing Apps Script fallback
- broad UI behavior changes

## M17-C Preview Smoke

M17-C adds the smoke runner:

```bash
pnpm worker:public-read:preview-smoke
```

It requires:

- `RCAT_M17_PUBLIC_READ_SMOKE_APPROVAL=APPROVED_M17_PUBLIC_READ_PREVIEW_SMOKE`
- `RCAT_PREVIEW_WORKER_URL=<dev-or-preview-worker-origin>`

The runner is fetch-only. It does not run Wrangler, does not deploy Worker code, does not mutate Vercel env, and does not write D1.

It verifies these routes:

| Request Path                              | Acceptable Result                         |
| ----------------------------------------- | ----------------------------------------- |
| `/api/public/documents`                   | 2xx public JSON                           |
| `/api/public/home`                        | 2xx public JSON                           |
| `/api/public/content`                     | 2xx public JSON                           |
| `/api/public/content/sample-preview-news` | 2xx public JSON or safe 404 if not seeded |
| `/api/public/search?q=sample`             | 2xx public JSON                           |
| `/api/public/programs`                    | 2xx public JSON                           |
| `/api/public/visitor-stats`               | 2xx public JSON                           |

The runner fails if any scoped endpoint returns 501, returns a server error, leaks unsafe implementation details, leaks production endpoint evidence, or fails the minimum public response contract.

The runner prints only a redacted summary: Worker host label, endpoint labels, HTTP status, item counts, generated timestamps, checks, and validation issue labels.

Actual dev/preview smoke must use an approved dev/preview Worker origin. Production-domain smoke and production cutover remain out of scope.

## M17-C Actual Preview Smoke Result

Status: `PASSED`.

Evidence source: external operator-confirmed dev/preview smoke execution.

Command:

```bash
pnpm worker:public-read:preview-smoke
```

Recorded outcome:

- approval gate passed
- preview Worker URL safety gate passed
- grouped public-read smoke passed
- minimum public response contracts passed
- leakage checks passed
- the preview Worker had been updated to the current M17 route implementation before the successful rerun
- no exact Worker URL, D1 id, account id, deployment id, token, secret, record payload, item count, or generated timestamp is committed
- no production cutover or production mutation occurred
- Apps Script fallback remains available
- M15.2 remains deferred
- M17-C acceptance criteria are now satisfied

The operator confirmed the previous failed attempt was caused by the preview Worker still running the older deployment. The successful rerun happened after the required non-production preview migration and sanitized seed were applied and the current preview Worker was deployed.

Next phase: M18 Admin + D1 Write Batch Migration.

## Route Contract Plan

All public read routes allow `GET` and `OPTIONS` only in M17-B.

The grouped public read routes now return public JSON responses from D1-backed repositories in the Worker. They no longer return the M17 safe 501 skeleton response in Worker tests.

| Route                           | Resource               | Response Type                 | Target D1 Tables                                | Fallback Behavior                                                  | M17-B Behavior |
| ------------------------------- | ---------------------- | ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ | -------------- |
| `GET /api/public/documents`     | `public-document-list` | `PublicDocumentListSnapshot`  | `documents`                                     | Apps Script fallback remains available in frontend provider switch | implemented    |
| `GET /api/public/home`          | `public-home`          | `PublicHomeSnapshot`          | `public_home_sections`, `contents`, `documents` | Apps Script until D1 parity is accepted                            | implemented    |
| `GET /api/public/content`       | `content-list`         | `PublicContentListSnapshot`   | `contents`                                      | Apps Script until D1 parity is accepted                            | implemented    |
| `GET /api/public/content/:slug` | `content-detail`       | `PublicContentDetailSnapshot` | `contents`                                      | Apps Script until D1 parity is accepted                            | implemented    |
| `GET /api/public/search`        | `search`               | `PublicSearchSnapshot`        | `contents`                                      | Apps Script until D1 parity is accepted                            | implemented    |
| `GET /api/public/programs`      | `program`              | `PublicProgramListSnapshot`   | `contents`                                      | Apps Script until D1 parity is accepted                            | implemented    |
| `GET /api/public/visitor-stats` | `visitor-stats`        | `PublicVisitorStatsSnapshot`  | `visitor_daily_stats`                           | Apps Script until D1 parity is accepted                            | implemented    |

## M17-B Implementation Notes

The Worker now has route handlers, repositories, contracts, and adapters for:

- public home
- public content list
- public content detail
- public search
- public programs
- public visitor stats

The response contracts intentionally expose public camelCase fields only.

Repository row interfaces remain Worker-local and snake_case.

`/api/public/content/:slug` returns a safe 404 for missing public content.

`OPTIONS` returns CORS headers and no body.

Non-GET methods return 405 with `Allow: GET, OPTIONS`.

## M17-C Contract Freeze

M17-C freezes the minimum public read contracts:

- documents: `items`, `generatedAt`
- home: `sections`, `featuredContent`, `featuredDocuments`, `programs`, `generatedAt`
- content list: `items`, `generatedAt`
- content detail: `item`, `generatedAt`, or safe 404
- search: `items`, `query`, `generatedAt`
- programs: `items`, `generatedAt`
- visitor stats: `total`, `today`, `generatedAt`

The freeze is intentionally minimum-shape only. It does not require exact production data and does not bundle real records.

## Remaining Parity Work

M17-B is a working public-read route batch. M17-C preview smoke and minimum contract freeze have passed through external operator-confirmed dev/preview execution.

Known follow-up areas before any production-domain traffic switch:

- confirm homepage parity beyond the minimum M17-B core shape
- confirm search ranking and filtering parity
- confirm visitor-stat aggregation parity
- run browser smoke with explicit Cloudflare provider env values only
- keep rollback to Apps Script available

## Field Safety

Public read responses must expose public fields only.

Committed fixtures and tests must not include:

- production URLs
- Worker URLs
- D1 ids
- account ids
- tokens or secrets
- full records
- Google Drive raw URLs
- Apps Script endpoint URLs
- raw D1 row keys such as snake_case storage columns
- stack traces, SQL text, or database error details

## Site View

Site-view read/write is planned with the public read batch, but no write migration is implemented in M17-B.

The first safe write path should be designed separately with throttling, privacy-safe fields, replay protection, and non-production verification.

## Rollback Strategy

For dev/preview testing, rollback means removing the explicit Cloudflare provider env values or setting the frontend provider back to Apps Script.

For production cutover work, M15 rollback safety remains unchanged and M15.2 remains deferred.

## Acceptance For M17-C

M17-C is accepted. The checkpoint is satisfied by the implemented route batch, contract-freeze tests, and the external operator-confirmed dev/preview smoke pass.

Acceptance evidence:

- grouped public read route registry exists and all M17-B routes are marked implemented
- `public-document-list` still works as before
- public read routes for home, content list, content detail, search, programs, and visitor stats return public JSON responses
- tests prove the grouped routes no longer return the M17 safe 501 skeleton
- preview smoke runner exists and is exposed by package scripts
- preview smoke runner blocks without exact approval and a safe dev/preview Worker origin
- preview smoke runner fails 501, server errors, unsafe leakage, and invalid public response shapes
- contract freeze tests cover all grouped public read endpoints
- tests prove no stack, SQL, internal field, production endpoint, Google Drive endpoint, Apps Script endpoint, or secret leakage
- M16 dev/preview policy remains strict
- Apps Script fallback remains available
- no production mutation occurs

## Next Phase

M18: Admin + D1 Write Batch Migration.

M18 planning may begin after the M17-C smoke and contract freeze pass. M18 implementation has not started in this checkpoint, and it must not remove the media bridge role until media upload/delete has a dedicated migration plan.
