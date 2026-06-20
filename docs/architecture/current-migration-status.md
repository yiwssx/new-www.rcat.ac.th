# Current Migration Status

Current milestone: M19 repository-owned parity remediation is closed. Post-M19 external preview verification passed for admin proxy login, snapshot, and admin writes; public frontend data loading is restored. External operator blockers remain, M20 is blocked and not started, and production cutover readiness is not claimed.

## Summary

M13: The repository contains an approval-gated production import runner for `public-document-list`. The M13 checkpoint document states that the actual production import was not executed in that commit, and current M19 confirmation states that no production D1 migration, import, or write has occurred.

M14: The repository contains a direct production Worker smoke gate for `public-document-list`. The M14 checkpoint document states that the actual production Worker smoke was not executed in that commit, and current M19 instructions confirm that no production Worker deployment should be assumed.

M15: Production frontend cutover and rollback gate added. Actual production cutover has not been executed from this repository commit history.

M15.1: Operator-accepted under domain-management constraint. Technical dry-run gate blocked safely because the replacement system cannot use the real production domain while the old live production system remains on that domain. This is accepted as sufficient to proceed to M16 planning. No production mutation occurred.

M16: Cloudflare-first backend migration reset. The replacement system is now moving toward Cloudflare Worker + D1 as the primary application backend, while Apps Script is reduced to the target role of Google Drive media-file bridge only.

M17: Cloudflare Core Public Read Batch Migration. The public read layer is now planned as one grouped Cloudflare API foundation instead of separate endpoint-by-endpoint mini-milestones.

M17-B: Cloudflare Core Public Read API routes are implemented for dev/preview Worker use with D1-backed public responses. This is not a production cutover.

M17-C: `PASSED` through an externally executed, operator-approved dev/preview smoke run. The grouped Cloudflare public-read endpoints passed the M17-C smoke and minimum contract gate after the preview Worker was updated to the current M17 route implementation. The successful run used a non-production dev/preview Worker origin; the actual Worker URL remains redacted and uncommitted. This is not a production cutover.

M18: Admin + D1 Write Batch Migration completed as one cohesive milestone. It moves structured admin writes for M17 public-read data toward Cloudflare Worker + D1 in dev/preview mode while Apps Script remains production fallback and Google Drive media-file bridge. Browser preview admin writes require Cloudflare Access, CLI smoke uses a separate uncommitted smoke token, audit writes are trigger-backed and atomic, production Worker env config carries an explicit production marker with preview write gates disabled, smoke cleanup uses `If-Match` revision guarding, and `0004_admin_write_hardening.sql` uses parser-safe split audit triggers instead of nested `CASE ... END` trigger bodies. Fresh isolated local D1 migration acceptance for `0001` through `0004` passed, including trigger inspection and SQL semantic audit smoke. The operator confirmed external non-production Preview D1 migration acceptance and the external Preview Worker admin write lifecycle smoke passed with redacted infrastructure evidence. No production mutation occurred.

M18 preview admin proxy follow-up: the Vercel same-origin proxy login and proxied admin snapshot read now pass externally. Repository fixes cover Vercel runtime environment access, safe missing-key diagnostics, bcryptjs default-export interop, credentialed admin CORS, signed HttpOnly proxy sessions, and server-only Worker credential forwarding. This remains a non-production preview path.

M19: `CLOSED` for repository-owned parity remediation. Public Worker contracts now match current React snapshot dependencies, all public-read feature adapters honor the existing explicit provider switch, structured settings/menu/carousel/service/event admin routes and frontend adapters exist behind the M18 preview gate, admin snapshot parity is filled, and ordered migration `0005` adds audit metadata for the new write-owned tables. Remaining items are external operator blockers, not hidden repository gaps.

Post-M19 external verification: the replacement production Vercel frontend was configured outside git to select the existing public Cloudflare provider, and public frontend data loading and browser sanity were restored. Preview admin proxy login and snapshot were verified, and the preview admin write smoke passed. A distinct post-M19 public-read smoke result was not included in the operator output and remains pending; the earlier M17-C public-read smoke remains valid historical evidence. This evidence does not establish production cutover readiness.

M20-P0: Production Readiness Gate Scaffolding is added as repository-owned readiness preparation only. It includes the M20 readiness document, operations runbook, offline readiness script, and tests. M19 remains closed, M20 production execution remains BLOCKED, no production mutation occurred, and no cutover readiness is claimed.

M20: `BLOCKED` and not started. Production identity/RBAC approval, sanitized full-data reconciliation, Drive bridge recovery ownership, representative migration/backup/restore/rollback rehearsal, production resources, monitoring thresholds, and cutover authority are still required outside git.

## M15.1 Dry-Run Result

Dry-run cutover command used:

```bash
pnpm worker:public-documents:cutover -- --cutover
```

Dry-run rollback command used:

```bash
pnpm worker:public-documents:cutover -- --rollback
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

Current replacement production Vercel frontend public-read provider: Cloudflare, selected through the existing environment-only provider setting after M19. This external provider configuration restored public data loading but does not establish production cutover readiness or start M20.

Apps Script remains the fallback and rollback provider. Provider defaults and runtime behavior were not changed by this documentation update.

Current preview public provider capability: Cloudflare is explicitly selectable for documents, public home, content list/detail, search, and programs. Public visitor stats are supplied through the Cloudflare public-home snapshot and direct Worker route. Default and unknown provider values remain Apps Script.

Current preview admin provider capability: Cloudflare is explicitly selectable for dashboard snapshot, content, document metadata, site/homepage/display settings, menu, carousel, external services, and events. Media binary operations, visitor analytics settings mutation, users, and application auth remain Apps Script-backed under the documented bridge or external-blocker classifications.

Target provider after eventual approved full cutover: Cloudflare Worker + D1 for accepted structured application data, with Apps Script retained only for the approved Google Drive media-file bridge.

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

## M19 Parity And Gap Assessment

Status: `CLOSED` for repository-owned parity remediation. External operator blockers remain. This is not production-cutover approval.

Assessment document: `docs/architecture/m19-parity-gap-assessment-2026-06-19.md`.

Repository closure evidence:

- React-compatible public home, content list/detail, search, programs, visitor stats, settings, menu, events, and media-reference fields are composed from D1 rows.
- Existing explicit public provider selection now covers every migrated public read; Apps Script remains the default.
- Preview-gated settings, menu, carousel, external-service, and event admin lifecycles are implemented and frontend-wired.
- Admin snapshot includes structured settings, navigation, media metadata, events, carousel, services, visitor stats, content, documents, and metrics.
- Ordered migration `0005_m19_structured_admin_parity.sql` defines actor/revision metadata and audit triggers but was not applied remotely.
- `pnpm worker:m19:readiness` verifies repository invariants without remote commands or mutations.

External blockers remain for production identity/RBAC, analytics policy, sanitized complete data inventory and reconciliation, Drive bridge compensation/recovery, production resources, migration rehearsal, backup/restore, monitoring, rollback, and cutover authority.

The M19 repository closure change executed no production cutover, D1 mutation, Worker deployment, Vercel environment mutation, Apps Script mutation, or Google Drive mutation. The later external Vercel public provider configuration is recorded separately below.

## Post-M19 External Verification

Status: `PARTIALLY VERIFIED`; the supplied operator evidence passed the preview admin checks and public browser sanity, while a distinct post-M19 public-read smoke result is pending operator output.

Evidence source: external operator report recorded without infrastructure identifiers, payloads, screenshots, exact timestamps, or secrets.

Recorded results:

- replacement production Vercel frontend public Cloudflare provider environment: configured externally
- public frontend data loading: restored
- public browser sanity check: passed
- preview admin proxy login: verified
- preview admin snapshot: verified
- preview admin write smoke: `PASSED`
- post-M19 public-read smoke: `PENDING OPERATOR OUTPUT`

The successful browser data load is not substituted for the dedicated public-read smoke result. The previously recorded M17-C public-read smoke is historical evidence from before this post-M19 verification.

Safety boundary:

- no production D1 migration, import, or write occurred
- no production Worker deploy occurred
- no Apps Script mutation occurred
- no Google Drive mutation occurred
- no runtime code, tests, provider behavior, UI, routes, cache keys, or cache TTL changed in this documentation update
- no production cutover readiness is claimed
- M20 remains blocked and not started

## Next Action

M19 repository-owned remediation is closed. The next action is operator resolution and redacted evidence for the external blockers listed in the M19 closure ledger.

M20 remains blocked and not started. It may begin only after those external identity, data, bridge, migration, operations, rollback, and cutover gates are approved; M19 closure alone is not sufficient.

M20-P0 readiness gate scaffolding is added. Operators can run pnpm worker:m20:readiness for local repository-only checks, but production execution remains blocked until all external evidence and authority gates pass.

M16 goal: move the replacement system toward Cloudflare as the primary backend for all application data, while keeping Apps Script only as a Google Drive media-file bridge until final domain cutover.

M17 goal: build the Cloudflare Core Public Read API foundation, preserve existing `public-document-list`, implement D1-backed public read routes for home, content, search, programs, and visitor stats, and document remaining parity requirements.

M17 status: public read API foundation implemented for dev/preview Worker origins, with M17-C preview smoke and contract freeze passed through externally confirmed operator execution. The grouped routes no longer return M17 safe 501 skeleton responses in Worker tests, but Apps Script fallback remains available until final cutover gates are approved.

M15.2 real execute cutover remains deferred until the replacement system is complete, the production domain can be moved safely, explicit operator approval is recorded, and an approved production monitoring window exists.

M20 is only a future controlled production cutover preparation/gate after external M19 blockers are resolved. M20 is not started.

M16 architecture checkpoint: `docs/architecture/m16-cloudflare-first-backend-reset-2026-06-13.md`.

M17 architecture checkpoint: `docs/architecture/m17-cloudflare-core-public-read-batch-2026-06-13.md`.

M18 architecture checkpoint: `docs/architecture/m18-admin-d1-write-batch-migration-2026-06-16.md`.

M19 architecture checkpoint: `docs/architecture/m19-parity-gap-assessment-2026-06-19.md`.

## Safety

No production secrets, production URLs, D1 ids, tokens, full records, Google Drive URLs, Apps Script URLs, account ids, or Worker URLs are committed.

This documentation update did not change any Vercel environment. The post-M19 public provider environment configuration was performed externally and is recorded above without committing its values.

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
