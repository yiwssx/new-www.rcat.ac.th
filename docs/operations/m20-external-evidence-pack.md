# M20 External Evidence Pack

Status: M20 migration/runtime/domain-cutover scope is closed.

M20 is closed for migration/runtime ownership. M21 owns remaining UI/UX and logic stabilization.

M20 closure is limited to migration, runtime ownership, and domain cutover scope. It does not mean the UI/UX is complete, the system is defect-free, or all business workflows are final.

This is an archived M20 evidence record. For the current CMS-only authentication boundary, use `docs/cms-auth-final-cutover.md`.

## Closed Field-Cutover Boundary

- Admin structured data provider: Cloudflare.
- Public client data provider: Cloudflare.
- Media/attachment/file provider: Google Drive via Apps Script bridge.
- Structured database provider: D1.
- Production custom domain: `www.rcat.ac.th` connected to Vercel production.

At M20 closure, the same-origin Admin Proxy remained the browser boundary. Phase 8 later replaced its authentication mechanism with CMS Sessions while preserving RBAC, CORS, CSRF, proxy, and admin-route protections.

No live URL, D1 id, account id, deployment id, run id, token, secret, exact timestamp, screenshot, Google Drive URL, Apps Script URL, raw export, record payload, backup artifact, or infrastructure identifier is recorded here.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin CMS session/proxy: Vercel server-side proxy.
- Media/file bridge: Vercel `/api/apps-script-proxy` to Apps Script.
- File storage: Google Drive behind the Apps Script media/file bridge.

## M20 Closure Note

- The custom domain `www.rcat.ac.th` is connected to the Vercel production deployment.
- The Cloudflare/Vercel redirect loop was resolved at the provider configuration layer.
- Cloudflare Worker allowed origins include the production custom domain.
- Cloudflare Worker and D1 own structured public and admin data.
- Apps Script remains only the media/file bridge for Google Drive file operations.
- No D1 migration blocker remains.
- No Apps Script structured-data blocker remains.
- No runtime ownership blocker remains.
- Remaining UI/UX, business logic, workflow, usability, validation, layout, content-presentation, Thai wording, and user-facing error issues move to M21.

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

## Status Summary

| Evidence section               | M20 closure status                           |
| ------------------------------ | -------------------------------------------- |
| Full structured data inventory | `NOT_APPLICABLE`                             |
| Cross-provider reconciliation  | `NOT_APPLICABLE`                             |
| Media bridge verification      | `EXCLUDED_FROM_CLOUDFLARE_CUTOVER`           |
| Identity/RBAC approval         | `KEPT_ON_EXISTING_ADMIN_PROXY_AND_RBAC_PATH` |
| Backup rehearsal               | `MOVED_TO_POST_CUTOVER_OPERATIONS`           |
| Restore rehearsal              | `MOVED_TO_POST_CUTOVER_OPERATIONS`           |
| Rollback rehearsal             | `NOT_REQUIRED_FOR_FIELD_CUTOVER`             |
| Monitoring threshold approval  | `MOVED_TO_POST_CUTOVER_OPERATIONS`           |
| Final cutover authority        | `CLOSED_FOR_MIGRATION_RUNTIME_DOMAIN_SCOPE`  |

## 1. Full Structured Data Inventory

- **Status:** `NOT_APPLICABLE`
- **Operator decision:** There is no legacy public structured data that must be migrated before this field cutover. Cloudflare Worker and D1 own structured public and admin data.
- **Future production boundary:** This disposition does not approve any later production resource migration.

## 2. Cross-Provider Reconciliation

- **Status:** `NOT_APPLICABLE`
- **Operator decision:** There is no required legacy structured dataset to reconcile across providers for this field cutover.
- **Future production boundary:** Any later production data assurance requirement is a separate operator decision.

## 3. Media Bridge Verification

- **Status:** `EXCLUDED_FROM_CLOUDFLARE_CUTOVER`
- **Provider disposition:** `REMAINS_APPS_SCRIPT_GOOGLE_DRIVE`
- **Operator decision:** Media, attachments, and binary file operations continue through the existing Google Drive / Apps Script media bridge. They are not moved to Cloudflare by M20.

## 4. Identity/RBAC Approval

- **Status:** `KEPT_ON_EXISTING_ADMIN_PROXY_AND_RBAC_PATH`
- **Operator decision:** Admin access remains on the existing admin proxy/login path and its existing authorization controls.
- **Limitation:** No auth, CORS, session, proxy, admin gate, or smoke-token boundary is weakened.

## 5. Backup Rehearsal

- **Status:** `MOVED_TO_POST_CUTOVER_OPERATIONS`
- **Operator decision:** Production-grade backup planning is not part of M20 migration/runtime/domain closure.
- **Future production boundary:** Production-grade backup policy and evidence remain a future production responsibility.

## 6. Restore Rehearsal

- **Status:** `MOVED_TO_POST_CUTOVER_OPERATIONS`
- **Operator decision:** Production-grade restore rehearsal is not part of M20 migration/runtime/domain closure.
- **Future production boundary:** Production-grade restore policy and evidence remain a future production responsibility.

## 7. Rollback Rehearsal

- **Status:** `NOT_REQUIRED_FOR_FIELD_CUTOVER`
- **Operator decision:** Rollback to Apps Script is not required for this operator-approved field cutover.
- **Limitation:** This disposition does not define or approve a future production rollback strategy.

## 8. Monitoring Threshold Approval

- **Status:** `MOVED_TO_POST_CUTOVER_OPERATIONS`
- **Operator decision:** Operators observe public reads, admin structured-data operations, UI/UX issues, and the unchanged media bridge after M20 closure.
- **Future production boundary:** Production monitoring, alerting, thresholds, ownership, and support coverage remain a future production responsibility.

## 9. Final Cutover Authority

- **Status:** `CLOSED_FOR_MIGRATION_RUNTIME_DOMAIN_SCOPE`
- **Operator decision:** M20 migration/runtime/domain cutover is closed. Cloudflare owns public client data and admin structured data backed by D1, and `www.rcat.ac.th` is connected to Vercel production.
- **Limitation:** This does not claim UI/UX completion, business workflow completion, or defect-free production behavior.

## Governance Decision

M20 migration/runtime/domain-cutover scope is closed. Closure removes legacy inventory, cross-provider reconciliation, Apps Script rollback rehearsal, D1 migration blockers, Apps Script structured-data blockers, and runtime ownership blockers from M20.

UI/UX completion, business workflow completion, and defect-free production behavior are not claimed. Remaining issues move to M21.
