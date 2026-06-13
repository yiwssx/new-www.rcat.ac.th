# M16 Cloudflare-First Backend Reset

Status: Cloudflare-first migration reset for the replacement system. This is not a production domain cutover.

## Current Status After M15.1

M15.1 is operator-accepted for planning under a domain-management constraint.

The technical M15 production cutover dry-run remained blocked-safe because the replacement system cannot use the real production frontend domain while the old live system still serves that domain.

M15.2 real execute cutover is deferred.

No `--execute` command was run.

No production Vercel environment was changed.

No Worker deploy, D1 write, D1 migration, or production import was run for this checkpoint.

## New Direction

The replacement system moves to a Cloudflare-first backend model:

Frontend replacement system -> Cloudflare Worker API -> D1 structured data.

Cloudflare Worker becomes the primary application API.

D1 becomes the primary structured data store.

Apps Script stops being the long-term application backend.

## Apps Script Future Role

Apps Script remains only as a Google Drive media-file bridge until final domain cutover.

Apps Script target role: media-file bridge only.

Allowed future Apps Script responsibilities:

- upload media files to Google Drive
- return media metadata such as file id, file URL, MIME type, file name, and size
- optionally delete or update media files in Google Drive

Explicitly removed from the target Apps Script role:

- public content source of truth
- main public API provider
- admin structured-data source of truth
- search, program, content, document, site-view, or visitor-stats business logic

## Google Drive Future Role

Google Drive remains media file storage only.

Google Drive is not the target structured-data store.

The frontend should consume media metadata through the Cloudflare API once each endpoint is migrated, even if Apps Script performs the underlying file operation.

## Production Domain Cutover

Production domain cutover is deferred until the replacement system is complete.

M16 does not require the replacement system to use the real production frontend domain.

M16 does not weaken M15 production-domain validation.

M15 must continue to reject preview, staging, dev, test, sandbox, and Vercel preview URLs as production cutover targets.

## Dev/Preview Endpoint Enforcement

Before final domain cutover, replacement-system Cloudflare testing must use dev or preview Worker origins only.

Replacement-system endpoints before final cutover: dev/preview Worker origins only.

The M16 policy helper is `src/config/backendProviderPolicy.ts`.

Relevant environment variables:

- `VITE_BACKEND_MIGRATION_MODE=cloudflare-first-preview`
- `VITE_PUBLIC_API_PROVIDER=cloudflare`
- `VITE_CLOUDFLARE_PUBLIC_API_URL=<dev-or-preview-worker-origin>`

The policy explicitly records:

- production domain cutover is not allowed in M16
- production frontend domain is not required for M16 work
- dev/preview Cloudflare origin testing is allowed for replacement-system migration mode
- M15 production validation remains strict
- Apps Script fallback remains available for endpoints not migrated yet
- media file operations may continue through Apps Script

## Endpoint Migration Inventory

| Endpoint                 | Current Provider                                 | Target Provider                                | D1 Table Or Worker Route Needed                                             | Apps Script Dependency                             | Priority | Risk   | Dev/Preview Test Requirement                          |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- | -------- | ------ | ----------------------------------------------------- |
| public-document-list     | Cloudflare preview capable, Apps Script fallback | Cloudflare Worker + D1                         | existing `/api/public/documents`, documents tables                          | fallback only until final cutover                  | 1        | Low    | compare snapshot shape, ordering, count, and rollback |
| public-home              | Apps Script                                      | Cloudflare Worker + D1                         | `/api/public/home`, homepage, content, documents, programs, settings tables | fallback until route parity exists                 | 2        | High   | full homepage snapshot parity and UI smoke            |
| content-list             | Apps Script                                      | Cloudflare Worker + D1                         | `/api/public/content`, content tables                                       | fallback until route parity exists                 | 3        | Medium | list parity by type/status/order                      |
| content-detail           | Apps Script                                      | Cloudflare Worker + D1                         | `/api/public/content/:slug`, content and media metadata tables              | fallback until route parity exists                 | 4        | Medium | slug detail parity and public-field validation        |
| search                   | Apps Script                                      | Cloudflare Worker + D1                         | `/api/public/search`, searchable content index                              | fallback until route parity exists                 | 5        | Medium | query parity and no private fields                    |
| program                  | Apps Script                                      | Cloudflare Worker + D1                         | `/api/public/programs`, program/content tables                              | fallback until route parity exists                 | 6        | Medium | department/program list parity                        |
| site-view                | Apps Script                                      | Cloudflare Worker + D1                         | `/api/public/site-view`, analytics/event table                              | temporary write bridge until Cloudflare write path | 7        | Medium | write throttling and privacy-safe event checks        |
| visitor-stats            | Apps Script                                      | Cloudflare Worker + D1                         | `/api/public/visitor-stats`, visitor stats table/view                       | fallback until route parity exists                 | 8        | Medium | counter parity and cache behavior                     |
| admin structured data    | Apps Script                                      | Cloudflare Worker + D1                         | admin Worker routes and normalized D1 tables                                | fallback until auth/write migration                | 9        | High   | authenticated dev/preview admin workflow tests        |
| media metadata           | Apps Script                                      | Cloudflare Worker + D1                         | `/api/media`, media metadata table                                          | Apps Script bridge for file operations             | 10       | High   | metadata parity without file URL leakage              |
| media file upload/delete | Apps Script                                      | Apps Script media bridge behind Cloudflare API | Cloudflare route delegates file operation, stores metadata in D1            | required until storage strategy changes            | 11       | High   | upload/delete smoke with sanitized files only         |

## Rollback Strategy

Until final domain cutover, rollback means removing the explicit Cloudflare provider environment values or setting the public provider back to Apps Script.

Apps Script fallback remains available for unmigrated endpoints.

M15 rollback safety remains unchanged for production cutover work.

## M16 Scope

In scope:

- document the Cloudflare-first backend reset
- define dev/preview endpoint enforcement
- add a non-mutating frontend policy helper
- keep `public-document-list` as the only migrated public-read endpoint for now
- inventory endpoint migration order and risk

Out of scope:

- real production domain cutover
- production Vercel environment mutation
- Worker production deploy
- D1 production migration, import, or write
- migrating every endpoint in one commit
- Apps Script changes
- `src/services/googleApi.ts` changes
- UI, route, cache key, or cache TTL changes
- admin/auth/media upload migration

## Safety Constraints

No real production URLs, Worker URLs, D1 ids, account ids, tokens, secrets, full records, Google Drive file URLs, or Apps Script endpoint URLs are committed.

The old live system remains on the real production domain until final cutover is explicitly approved.

M16 is a planning and policy reset plus a safe local policy helper.

The first implementation step after this checkpoint should pick one endpoint, add a Cloudflare Worker route and D1 schema/test path, verify dev/preview parity, and preserve Apps Script fallback until the endpoint is explicitly ready.
