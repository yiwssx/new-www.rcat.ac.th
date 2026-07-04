# M20 Production Readiness Gate

Status: cleanup completed; preview field verification in progress. M20 production cutover remains gated. M20 preview-backed Cloudflare field cutover is `APPROVED_FOR_PREVIEW_BACKED_FIELD_VERIFICATION` by operator decision, but this document does not claim final production readiness.

## Current State After M19

M19 remains closed for repository-owned parity remediation. Repository readiness, M19 continuity, public-read preview smoke, preview migration verification, preview admin proxy/login verification, and preview admin write smoke have passed externally.

The operator has authorized the replacement site to use the existing preview Worker and preview D1 during real field verification. Production D1 and final production cutover are not authorized by this decision.

## Scope Of M20-P0

M20-P0 supplied the repository readiness scaffold. The current M20 operator decision advances that same milestone to a preview-backed field cutover without renaming it or claiming final production readiness.

## M20 Preview-Backed Field Cutover

- Admin structured data provider: Cloudflare.
- Public client data provider: Cloudflare.
- Media/attachment/file provider: Google Drive via Apps Script bridge.
- Database environment: preview D1 during field verification.
- Production D1 / final production cutover: explicitly deferred to operator decision after field verification.

The existing admin proxy/login path is mandatory for admin field verification. Existing authentication, authorization, CORS, session, proxy, admin-gate, preview-write, and smoke-token controls remain intact.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin CMS session/proxy: Vercel server-side proxy.
- Media/file bridge: Vercel `/api/apps-script-proxy` to Apps Script.
- File storage: Google Drive behind the Apps Script media/file bridge.

## Preview Field Verification Checklist

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

- no production D1 provisioning or migration
- no final production cutover or final production-readiness claim
- no movement of media, attachments, or binary files to Cloudflare
- no Apps Script or Google Drive mutation as part of this documentation change
- no weakening of auth, RBAC, CORS, sessions, proxies, admin gates, preview gates, or smoke-token separation
- no commitment of live endpoints, identifiers, tokens, secrets, payloads, screenshots, exact timestamps, exports, or backup artifacts

## Production Safety Boundaries

The committed production Worker configuration remains placeholder-safe. Production markers remain explicit, preview writes and smoke-token gates remain disabled in production configuration, and no production D1 identifier is committed.

This governance update performs no remote command, network request, D1 write, Worker deployment, Vercel mutation, Apps Script mutation, Google Drive mutation, or production cutover action.

## External Operator Blockers

There are no remaining external operator blockers for the approved preview-backed field-verification scope.

The following remain future production responsibilities rather than field-cutover blockers:

- final production identity and RBAC approval
- production-grade backup and restore policy
- production monitoring, alerting, support ownership, and acceptance thresholds
- production Worker, D1, and frontend resource decisions
- final production cutover authority

## Operator Decision Dispositions

| Gate                           | Field-cutover disposition                      |
| ------------------------------ | ---------------------------------------------- |
| Full structured data inventory | `NOT_APPLICABLE`                               |
| Cross-provider reconciliation  | `NOT_APPLICABLE`                               |
| Media bridge verification      | `EXCLUDED_FROM_CLOUDFLARE_CUTOVER`             |
| Identity/RBAC                  | `APPROVED_FOR_PREVIEW_FIELD_VERIFICATION_ONLY` |
| Backup/restore                 | `NOT_BLOCKING_PREVIEW_FIELD_VERIFICATION`      |
| Rollback to Apps Script        | `NOT_REQUIRED_FOR_FIELD_CUTOVER`               |
| Monitoring                     | `FIELD_VERIFICATION_OBSERVATION_ONLY`          |
| Cutover authority              | `APPROVED_FOR_PREVIEW_FIELD_VERIFICATION_ONLY` |

No legacy public structured dataset must be migrated or reconciled. Public structured content may be recreated in preview D1. Media/attachment/file handling remains on the existing Apps Script / Google Drive bridge.

## Required Evidence Format

Committed field-verification outcomes must use redacted labels and pass/fail observations only. They must not contain live URLs, D1 ids, account ids, deployment ids, run ids, tokens, secrets, exact timestamps, screenshots, Google Drive URLs, Apps Script URLs, raw exports, record payloads, backup artifacts, or infrastructure identifiers.

## Required Rehearsal Flow

For this field cutover, use the existing passed preview checks and follow the `M20 Preview-Backed Field Cutover` section in `docs/operations/m20-readiness-runbook.md`. Full legacy inventory, cross-provider reconciliation, production-grade backup/restore rehearsal, and rollback-to-Apps-Script rehearsal are not required.

## Backup / Restore / Rollback Expectations

Backup and restore are not blocking preview-backed field verification. Production-grade backup and restore remain future production responsibilities.

Rollback to Apps Script is not required for this operator-approved field cutover. This document does not prescribe a final production rollback strategy.

## Cutover Authority Requirements

The operator has granted cutover authority for preview-backed field verification only. The authority applies while public and admin structured data use Cloudflare with preview D1 and the existing admin proxy/login path, and while media remains on the Apps Script / Google Drive bridge.

Production D1, production resource migration, final production identity approval, and final production cutover require a later operator decision after field verification.

## Go / No-Go Checklist

Field verification may proceed when:

- M19 remains closed.
- `pnpm worker:m20:readiness` passes.
- `pnpm worker:m19:readiness` passes.
- public client data is configured for Cloudflare.
- admin structured data is configured for Cloudflare through the existing admin proxy/login path.
- the database target is the preview D1 environment.
- media, attachments, and files remain on the Apps Script / Google Drive bridge.
- production resources and identifiers remain uncommitted and untouched.

Stop field verification if provider boundaries or existing security gates are bypassed, or if media/file operations no longer use the existing bridge.

## Rollback Checklist

Rollback to Apps Script is `NOT_REQUIRED_FOR_FIELD_CUTOVER`. If field verification must stop, disable or pause the field-verification configuration through operator-controlled external configuration; do not weaken security controls, mutate production resources, or move media providers. A final production rollback design is deferred.

## Redacted Evidence Policy

Record only provider labels, environment class, verification outcome, and non-sensitive issue labels. All live endpoints, infrastructure identifiers, credentials, exact timestamps, screenshots, exports, payloads, and artifacts remain outside git.
