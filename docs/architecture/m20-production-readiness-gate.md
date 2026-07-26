# M20 Production Readiness Gate

Status: M20 migration/runtime/domain-cutover scope is closed.

M20 is closed for migration/runtime ownership. M21 owns remaining UI/UX and logic stabilization.

M20 closure is limited to migration, runtime ownership, and domain cutover scope. It does not mean the UI/UX is complete, the system is defect-free, or all business workflows are final.

This is an archived M20 readiness record. For the current CMS-only authentication boundary and deployment procedure, use `docs/cms-auth-final-cutover.md`.

## Current State After M19

M19 remains closed for repository-owned parity remediation. Repository readiness, M19 continuity, public-read preview smoke, preview migration verification, preview admin proxy/login verification, and preview admin write smoke have passed externally.

The production custom domain is now connected to the Vercel production deployment. Structured public and admin data are owned by Cloudflare Worker and D1. Apps Script remains only for the media/file bridge and Google Drive file operations.

## Scope Of M20-P0

M20-P0 supplied the repository readiness scaffold. M20 now closes the migration, runtime ownership, and domain cutover scope without claiming UI/UX completion or defect-free production behavior.

## M20 Closure Note

- Admin structured data provider: Cloudflare.
- Public client data provider: Cloudflare.
- Media/attachment/file provider: Google Drive via Apps Script bridge.
- The custom domain `www.rcat.ac.th` is connected to the Vercel production deployment.
- The Cloudflare/Vercel redirect loop was resolved at the provider configuration layer.
- Cloudflare Worker allowed origins include the production custom domain.
- Cloudflare Worker and D1 own structured public and admin data.
- Apps Script remains only the media/file bridge for Google Drive file operations.
- No D1 migration blocker remains.
- No Apps Script structured-data blocker remains.
- No runtime ownership blocker remains.
- Remaining UI/UX, business logic, workflow, usability, validation, layout, content-presentation, Thai wording, and user-facing error issues move to M21.

At M20 closure, the same-origin Admin Proxy remained mandatory for browser Admin access. Phase 8 later made that proxy CMS-only while preserving authorization, CORS, CSRF, Session, and admin-gate controls.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin CMS session/proxy: Vercel server-side proxy.
- Media/file bridge: Vercel `/api/apps-script-proxy` to Apps Script.
- File storage: Google Drive behind the Apps Script media/file bridge.

## M21 Stabilization Handoff Checklist

- [ ] public home
- [ ] marquee
- [ ] carousel
- [ ] menu
- [ ] content/news/announcements
- [ ] documents
- [ ] E-Service
- [ ] calendar
- [ ] media upload/delete
- [ ] admin content save/publish/delete
- [ ] settings save
- [ ] mourning mode
- [ ] visitor stats / Who's Online
- [ ] user management
- [ ] Apps Script media bridge status
- [ ] Cloudflare public/admin structured status

## Non-goals

- no claim that UI/UX, workflows, validation, or content presentation are complete
- no claim that the system is defect-free
- no movement of media, attachments, or binary files to Cloudflare
- no Apps Script or Google Drive mutation as part of this documentation change
- no weakening of auth, RBAC, CORS, sessions, proxies, admin gates, preview gates, or smoke-token separation
- no commitment of live endpoints, identifiers, tokens, secrets, payloads, screenshots, exact timestamps, exports, or backup artifacts

## Production Safety Boundaries

The committed production Worker configuration remains placeholder-safe. Production markers remain explicit, preview writes and smoke-token gates remain disabled in production configuration, and no production D1 identifier is committed.

This governance update performs no remote command, network request, D1 write, Worker deployment, Vercel mutation, Apps Script mutation, Google Drive mutation, or production cutover action.

## External Operator Blockers

There are no remaining external operator blockers for the M20 migration/runtime/domain-cutover scope.

The following remain future production responsibilities rather than M20 migration/runtime/domain blockers:

- final production identity and RBAC approval
- production-grade backup and restore policy
- production monitoring, alerting, support ownership, and acceptance thresholds
- production Worker, D1, and frontend resource decisions
- final production cutover authority

## Operator Decision Dispositions

| Gate                           | M20 disposition                              |
| ------------------------------ | -------------------------------------------- |
| Full structured data inventory | `NOT_APPLICABLE`                             |
| Cross-provider reconciliation  | `NOT_APPLICABLE`                             |
| Media bridge verification      | `EXCLUDED_FROM_CLOUDFLARE_CUTOVER`           |
| Identity/RBAC                  | `KEPT_ON_EXISTING_ADMIN_PROXY_AND_RBAC_PATH` |
| Backup/restore                 | `MOVED_TO_POST_CUTOVER_OPERATIONS`           |
| Rollback to Apps Script        | `NOT_REQUIRED_FOR_FIELD_CUTOVER`             |
| Monitoring                     | `MOVED_TO_POST_CUTOVER_OPERATIONS`           |
| Cutover authority              | `CLOSED_FOR_MIGRATION_RUNTIME_DOMAIN_SCOPE`  |

No legacy public structured dataset must be migrated or reconciled. Cloudflare Worker and D1 own structured public and admin data. Media/attachment/file handling remains on the existing Apps Script / Google Drive bridge.

## Required Evidence Format

Committed closure outcomes must use redacted labels and pass/fail observations only. They must not contain live URLs, D1 ids, account ids, deployment ids, run ids, tokens, secrets, exact timestamps, screenshots, Google Drive URLs, Apps Script URLs, raw exports, record payloads, backup artifacts, or infrastructure identifiers.

## Required Verification Flow

For M20 closure, use the existing passed readiness checks and the closure evidence recorded in `docs/operations/m20-readiness-runbook.md`. Full legacy inventory, cross-provider reconciliation, production-grade backup/restore rehearsal, and rollback-to-Apps-Script rehearsal are not required for the closed migration/runtime/domain-cutover scope.

## Backup / Restore / Rollback Expectations

Backup and restore are not blocking M20 migration/runtime/domain closure. Production-grade backup and restore remain future production responsibilities.

Rollback to Apps Script structured data is not required for the closed M20 migration/runtime/domain scope. This document does not prescribe a final production rollback strategy.

## Cutover Authority Requirements

M20 migration/runtime/domain cutover is closed. Any later production identity, support, backup, monitoring, or UI/UX acceptance decision is outside M20 and must not be represented as already complete.

## Go / No-Go Checklist

M20 closure is valid when:

- M19 remains closed.
- `pnpm worker:m20:readiness` passes.
- `pnpm worker:m19:readiness` passes.
- public client data is configured for Cloudflare.
- admin structured data is configured for Cloudflare through the existing admin proxy/login path.
- Cloudflare Worker allowed origins include the production custom domain.
- `www.rcat.ac.th` is connected to Vercel production without a Cloudflare/Vercel redirect loop.
- media, attachments, and files remain on the Apps Script / Google Drive bridge.
- production resources and identifiers remain uncommitted and untouched.

Escalate if provider boundaries or existing security gates are bypassed, or if media/file operations no longer use the existing bridge.

## Rollback Checklist

Rollback to Apps Script is `NOT_REQUIRED_FOR_FIELD_CUTOVER`. If the M20 runtime ownership boundary must change, use operator-controlled external configuration; do not weaken security controls, mutate production resources, or move media providers. A final production rollback design is deferred.

## Redacted Evidence Policy

Record only provider labels, environment class, verification outcome, and non-sensitive issue labels. All live endpoints, infrastructure identifiers, credentials, exact timestamps, screenshots, exports, payloads, and artifacts remain outside git.
