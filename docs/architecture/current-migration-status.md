# Current Migration Status

Current milestone: M18 completed through operator-confirmed external non-production Preview D1 migration and admin write lifecycle smoke.

## Summary

M13: Passed externally per operator confirmation. The repository contains an approval-gated production import runner for `public-document-list`.

M14: Passed externally per operator confirmation. The repository contains a direct production Worker smoke gate for `public-document-list`.

M15: Production frontend cutover and rollback gate added. Actual production cutover has not been executed from this repository commit history.

M15.1: Operator-accepted under domain-management constraint. Technical dry-run gate blocked safely because the replacement system cannot use the real production domain while the old live production system remains on that domain. This is accepted as sufficient to proceed to M16 planning. No production mutation occurred.

M16: Cloudflare-first backend migration reset. The replacement system is now moving toward Cloudflare Worker + D1 as the primary application backend, while Apps Script is reduced to the target role of Google Drive media-file bridge only.

M17: Cloudflare Core Public Read Batch Migration. The public read layer is now planned as one grouped Cloudflare API foundation instead of separate endpoint-by-endpoint mini-milestones.

M17-B: Cloudflare Core Public Read API routes are implemented for dev/preview Worker use with D1-backed public responses. This is not a production cutover.

M17-C: `PASSED` through an externally executed, operator-approved dev/preview smoke run. The grouped Cloudflare public-read endpoints passed the M17-C smoke and minimum contract gate after the preview Worker was updated to the current M17 route implementation. The successful run used a non-production dev/preview Worker origin; the actual Worker URL remains redacted and uncommitted. This is not a production cutover.

M18: Admin + D1 Write Batch Migration completed as one cohesive milestone. It moves structured admin writes for M17 public-read data toward Cloudflare Worker + D1 in dev/preview mode while Apps Script remains production fallback and Google Drive media-file bridge. Browser preview admin writes require Cloudflare Access, CLI smoke uses a separate uncommitted smoke token, audit writes are trigger-backed and atomic, production Worker env config carries an explicit production marker with preview write gates disabled, smoke cleanup uses `If-Match` revision guarding, and `0004_admin_write_hardening.sql` uses parser-safe split audit triggers instead of nested `CASE ... END` trigger bodies. Fresh isolated local D1 migration acceptance for `0001` through `0004` passed, including trigger inspection and SQL semantic audit smoke. The operator confirmed external non-production Preview D1 migration acceptance and the external Preview Worker admin write lifecycle smoke passed with redacted infrastructure evidence. No production mutation occurred.

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

Status: M18 completed: external non-production Preview D1 migration and admin write lifecycle smoke passed.

M18 added:

- additive D1 migrations for structured admin write metadata and parser-safe trigger-backed atomic audit rows
- preview-gated Worker admin routes for content, document metadata, public-home sections, visitor daily stats, and admin snapshot readback
- Cloudflare Access browser authentication for preview admin writes
- separate non-browser smoke-token authentication for the M18 preview smoke runner
- explicit production Worker environment vars that mark `ENVIRONMENT=production` and keep preview write and smoke gates disabled
- explicit frontend admin write provider that defaults to Apps Script and switches to Cloudflare only in preview migration mode with `cloudflare-access`
- Apps Script media-file bridge boundary, keeping upload/delete operations on Apps Script
- approval-gated preview smoke runner for one sanitized admin write lifecycle with unique IDs and `If-Match` guarded cleanup in `finally`
- tests for provider defaults, Cloudflare Access authentication, smoke-token separation, Worker write validation, trigger audit safety, revision conflicts, public-read visibility, redaction, and safe blocked smoke behavior
- fresh isolated local D1 acceptance for `0001` through `0004`, including all expected trigger creation and no-op second apply
- SQL semantic audit smoke confirming content, document, public-home section, visitor daily stats, and archive-priority actions
- operator-confirmed external non-production Preview D1 migration and Preview Worker admin write lifecycle smoke acceptance

The earlier external Preview D1 migration failure reported `incomplete input`. Fresh isolated local Wrangler D1 accepted the previous SQL, so the repository issue was not invalid SQLite syntax. The committed correction removes the remote parser/splitter risk by avoiding nested `CASE ... END` inside trigger bodies. The operator later confirmed that the corrected `0004_admin_write_hardening.sql` migration was applied successfully to non-production Preview D1 and the expected 16 audit triggers were present.

The production context guard is explicit in committed Worker config through safe placeholder-only production vars. No real production D1 id, URL, account id, token, secret, or data is committed.

M18 external acceptance evidence is recorded in redacted form:

- Preview D1 `0004` migration accepted externally.
- Expected 16 trigger-backed audit triggers were verified.
- Preview Worker was deployed and bound to the non-production Preview D1 database outside git.
- Smoke credential and Preview write gates were configured outside git.
- `pnpm worker:admin-write:preview-smoke` returned `PASSED`.
- Sanitized lifecycle passed: create draft, admin read-after-write, revision-controlled update, publish, public visibility, unpublish, public disappearance, archive cleanup with `If-Match`, and final admin/public cleanup verification.
- Cleanup left no active or public smoke record.
- No sensitive response leakage was reported.
- The Access boundary remains in place for browser preview admin writes.
- CLI smoke-token authentication remains separate and uncommitted.
- Apps Script media-file bridge boundary is unchanged.
- No production cutover, production Worker deploy, production D1 migration/import/write, Apps Script change, or Google Drive media mutation occurred.

No production cutover, production Worker deploy, production D1 migration/import/write, production Vercel environment mutation, Apps Script change, `src/services/googleApi.ts` change, UI change, route change, cache key change, or cache TTL change is part of M18.

## Next Action

M18 is closed officially. The next work is a remaining parity and gap assessment to determine the scope of the next milestone. This commit does not name or start the next milestone.

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

No production Worker deploy was run.

No production D1 write, import, or migration was run.

The M18 external Preview migration, Preview Worker deployment, and Preview smoke were operator-confirmed outside git against non-production resources only. This documentation closeout did not run remote commands.

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
