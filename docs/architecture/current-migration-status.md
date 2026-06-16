# Current Migration Status

Current milestone: M18 repository implementation complete; external preview smoke remains `BLOCKED_SAFE`.

## Summary

M13: Passed externally per operator confirmation. The repository contains an approval-gated production import runner for `public-document-list`.

M14: Passed externally per operator confirmation. The repository contains a direct production Worker smoke gate for `public-document-list`.

M15: Production frontend cutover and rollback gate added. Actual production cutover has not been executed from this repository commit history.

M15.1: Operator-accepted under domain-management constraint. Technical dry-run gate blocked safely because the replacement system cannot use the real production domain while the old live production system remains on that domain. This is accepted as sufficient to proceed to M16 planning. No production mutation occurred.

M16: Cloudflare-first backend migration reset. The replacement system is now moving toward Cloudflare Worker + D1 as the primary application backend, while Apps Script is reduced to the target role of Google Drive media-file bridge only.

M17: Cloudflare Core Public Read Batch Migration. The public read layer is now planned as one grouped Cloudflare API foundation instead of separate endpoint-by-endpoint mini-milestones.

M17-B: Cloudflare Core Public Read API routes are implemented for dev/preview Worker use with D1-backed public responses. This is not a production cutover.

M17-C: `PASSED` through an externally executed, operator-approved dev/preview smoke run. The grouped Cloudflare public-read endpoints passed the M17-C smoke and minimum contract gate after the preview Worker was updated to the current M17 route implementation. The successful run used a non-production dev/preview Worker origin; the actual Worker URL remains redacted and uncommitted. This is not a production cutover.

M18: Admin + D1 Write Batch Migration repository implementation is complete as one cohesive milestone. It moves structured admin writes for M17 public-read data toward Cloudflare Worker + D1 in dev/preview mode while Apps Script remains production fallback and Google Drive media-file bridge. External preview smoke remains `BLOCKED_SAFE` until non-production Worker URL and preview admin token values are supplied outside git.

## M15.1 Dry-Run Result

Dry-run cutover command used:

```bash
pnpm public-documents:cutover -- --cutover
```

Dry-run rollback command used:

```bash
pnpm public-documents:cutover -- --rollback
```

Technical dry-run cutover result: `BLOCKED`, safely.

Technical dry-run rollback result: `BLOCKED`, safely.

Earlier local dry-run attempts were blocked by missing required environment values:

- `RCAT_PROD_FRONTEND_URL`
- `RCAT_PROD_WORKER_URL`

The operator decision update records the deployment reality: available replacement-system endpoints are not the real production frontend domain. A Vercel preview frontend cannot be treated as production by the gate, and preview, staging, dev, test, or sandbox-looking Worker origins must remain blocked.

Operator decision: `ACCEPTED` for planning.

Real production cutover: `NOT EXECUTED`.

Future domain cutover: deferred until the replacement system is complete and the old live system can safely be moved.

No `--execute` command was run.

## Provider Status

Current production frontend provider: Apps Script until approved cutover.

Target provider after approved cutover: Cloudflare public API for `public-document-list` only.

Rollback provider: Apps Script.

M15.2 real execute cutover: deferred.

Current real production domain: old live system.

Replacement-system Cloudflare endpoints before final cutover: dev/preview Worker origins only.

Apps Script target role: media-file bridge only.

## M17-C Actual Preview Smoke Result

Status: `PASSED`.

Evidence source: external operator-confirmed dev/preview smoke execution.

Command:

```bash
pnpm worker:public-read:preview-smoke
```

The operator confirmed the earlier failed attempt was caused by the preview Worker still running an older deployment. After the required non-production preview migration and sanitized seed were applied, and after the current preview Worker was deployed, the operator reran the smoke command successfully.

Recorded result:

- grouped public-read smoke passed
- minimum public response contracts passed
- approval gate passed
- preview Worker URL safety gate passed
- leakage checks passed
- preview Worker URL remains redacted and uncommitted
- no exact D1 database name, D1 id, account id, deployment id, token, secret, record payload, item count, or generated timestamp is committed
- no production cutover occurred
- no production Vercel environment mutation occurred
- no production Worker deployment occurred
- no production D1 migration, import, or write occurred
- Apps Script remains the current production provider
- Apps Script remains the planned Google Drive media-file bridge
- M15.2 remains deferred

M17 is completed for the current preview smoke and contract-freeze checkpoint.

## M18 Repository Implementation Result

Status: repository implementation complete; external preview smoke `BLOCKED_SAFE`.

M18 added:

- additive D1 migration for structured admin write metadata and audit rows
- preview-gated Worker admin routes for content, document metadata, public-home sections, visitor daily stats, and admin snapshot readback
- explicit frontend admin write provider that defaults to Apps Script and switches to Cloudflare only in preview migration mode
- Apps Script media-file bridge boundary, keeping upload/delete operations on Apps Script
- approval-gated preview smoke runner for one sanitized admin write lifecycle
- tests for provider defaults, preview-only Cloudflare routing, Worker write validation, public-read visibility, redaction, and safe blocked smoke behavior

External preview smoke was not executed from this repository state because non-production execution values are not committed and were not supplied to the local environment.

Next operator action when non-production preview resources are ready:

```bash
RCAT_M18_ADMIN_WRITE_SMOKE_APPROVAL=APPROVED_M18_ADMIN_WRITE_PREVIEW_SMOKE
RCAT_PREVIEW_WORKER_URL=<dev-or-preview-worker-origin>
RCAT_M18_ADMIN_WRITE_TOKEN=<preview-admin-token>
pnpm worker:admin-write:preview-smoke
```

No production cutover, production Worker deploy, production D1 migration/import/write, production Vercel environment mutation, Apps Script change, `src/services/googleApi.ts` change, UI change, route change, cache key change, or cache TTL change is part of M18.

## Next Action

Next action: run the M18 external preview smoke only when approved non-production Worker URL and preview admin token values are supplied outside git.

M16 goal: move the replacement system toward Cloudflare as the primary backend for all application data, while keeping Apps Script only as a Google Drive media-file bridge until final domain cutover.

M17 goal: build the Cloudflare Core Public Read API foundation, preserve existing `public-document-list`, implement D1-backed public read routes for home, content, search, programs, and visitor stats, and document remaining parity requirements.

M17 status: public read API foundation implemented for dev/preview Worker origins, with M17-C preview smoke and contract freeze passed through externally confirmed operator execution. The grouped routes no longer return M17 safe 501 skeleton responses in Worker tests, but Apps Script fallback remains available until final cutover gates are approved.

M15.2 real execute cutover remains deferred until the replacement system is complete, the production domain can be moved safely, explicit operator approval is recorded, and an approved production monitoring window exists.

M16 architecture checkpoint: `docs/architecture/m16-cloudflare-first-backend-reset-2026-06-13.md`.

M17 architecture checkpoint: `docs/architecture/m17-cloudflare-core-public-read-batch-2026-06-13.md`.

M18 architecture checkpoint: `docs/architecture/m18-admin-d1-write-batch-migration-2026-06-16.md`.

## Safety

No production secrets, production URLs, D1 ids, tokens, full records, Google Drive URLs, Apps Script URLs, account ids, or Worker URLs are committed.

No production Vercel environment was changed.

No Worker deploy was run.

No D1 write, import, or migration was run.

No Apps Script change was made.

No `src/services/googleApi.ts` change was made.

No UI, route, cache key, or cache TTL change was made.

## M17-C Preview Smoke Gate

M17-C adds:

- `cloudflare/public-api/scripts/public-read-preview-smoke.mjs`
- root script `worker:public-read:preview-smoke`
- Worker package script `public-read:preview-smoke`

The smoke gate requires:

- `RCAT_M17_PUBLIC_READ_SMOKE_APPROVAL=APPROVED_M17_PUBLIC_READ_PREVIEW_SMOKE`
- `RCAT_PREVIEW_WORKER_URL=<dev-or-preview-worker-origin>`

The gate verifies:

- `GET /api/public/documents`
- `GET /api/public/home`
- `GET /api/public/content`
- `GET /api/public/content/:slug`
- `GET /api/public/search?q=`
- `GET /api/public/programs`
- `GET /api/public/visitor-stats`

The smoke gate fails on 501, server errors, unsafe leakage, invalid public response shape, production-looking origins, Apps Script origins, Google Drive origins, or the real production school domain.

Actual dev/preview smoke must be run only against an approved dev/preview Worker origin. No production cutover, production environment mutation, Worker deploy, D1 migration/import/write, Apps Script change, `src/services/googleApi.ts` change, UI change, route change, cache key change, or cache TTL change is part of M17-C.

M17-C actual dev/preview smoke has now passed through operator-confirmed external execution. The successful run used a non-production dev/preview Worker origin, and the actual Worker URL remains redacted and uncommitted.
