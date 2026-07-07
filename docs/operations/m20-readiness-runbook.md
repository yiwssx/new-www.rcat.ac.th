# M20 Readiness Runbook

Status: M20 migration/runtime/domain-cutover scope is closed.

M20 is closed for migration/runtime ownership. M21 owns remaining UI/UX and logic stabilization.

M20 closure is limited to migration, runtime ownership, and domain cutover scope. It does not mean the UI/UX is complete, the system is defect-free, or all business workflows are final.

## M20 Closure Runbook

### Provider Boundary

- Admin structured data provider: Cloudflare.
- Public client data provider: Cloudflare.
- Media/attachment/file provider: Google Drive via Apps Script bridge.
- Structured database provider: D1.
- Production custom domain: `www.rcat.ac.th` connected to Vercel production.

### Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin CMS session/proxy: Vercel server-side proxy.
- Media/file bridge: Vercel `/api/apps-script-proxy` to Apps Script.
- File storage: Google Drive behind the Apps Script media/file bridge.

### Preconditions

1. Confirm `pnpm worker:m20:readiness` passes.
2. Confirm `pnpm worker:m19:readiness` passes.
3. Confirm the configured Worker allowed origins include the production custom domain without recording private identifiers.
4. Confirm the existing admin proxy/login path is used for admin access.
5. Confirm auth, RBAC, CORS, session, proxy, admin-gate, preview-write, and smoke-token boundaries are unchanged.
6. Confirm media upload, deletion, attachments, and binary files still use the Apps Script / Google Drive bridge.

### Closure Steps

1. Confirm Cloudflare owns public client structured data through the existing operator-controlled configuration.
2. Confirm Cloudflare owns admin structured data through the existing admin proxy/login path.
3. Confirm `www.rcat.ac.th` reaches the Vercel production deployment without a Cloudflare/Vercel redirect loop.
4. Leave all media, attachment, and file operations on the existing Apps Script / Google Drive bridge.
5. Confirm no D1 migration blocker remains.
6. Confirm no Apps Script structured-data blocker remains.
7. Confirm no runtime ownership blocker remains.
8. Move remaining UI/UX, business logic, workflow, usability, validation, layout, content-presentation, Thai wording, and user-facing error issues to M21.
9. Record only redacted pass/fail observations and non-sensitive issue labels.

### M21 Stabilization Handoff Checklist

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

### Post-Closure Observation

Observe public-read availability, admin structured-data operations, authorization failures, UI/UX issues, workflow defects, and media-bridge continuity after M20 closure. M21 owns stabilization of user-facing behavior and logic.

Escalate to the operator if:

- a production D1 or production Worker resource would be required;
- the admin proxy/login or an existing security boundary is bypassed;
- structured data unexpectedly uses Apps Script instead of Cloudflare;
- media, attachments, or files unexpectedly use Cloudflare instead of the existing bridge;
- a live identifier, credential, payload, export, screenshot, or backup artifact would need to be committed.

### Operator-Decision Dispositions

- Full structured data inventory: `NOT_APPLICABLE` because no legacy public structured migration is required.
- Cross-provider reconciliation: `NOT_APPLICABLE` because no legacy structured dataset must be reconciled.
- Media bridge verification: `EXCLUDED_FROM_CLOUDFLARE_CUTOVER`; it `REMAINS_APPS_SCRIPT_GOOGLE_DRIVE`.
- Identity/RBAC: `KEPT_ON_EXISTING_ADMIN_PROXY_AND_RBAC_PATH`.
- Backup/restore: `MOVED_TO_POST_CUTOVER_OPERATIONS`; production-grade capability remains future work.
- Rollback to Apps Script: `NOT_REQUIRED_FOR_FIELD_CUTOVER`.
- Monitoring: `MOVED_TO_POST_CUTOVER_OPERATIONS`; production monitoring remains future work.
- Final cutover authority: `CLOSED_FOR_MIGRATION_RUNTIME_DOMAIN_SCOPE`.

### After M20 Closure

Report redacted closure outcomes to the operator. Do not claim UI/UX completion, business workflow completion, or defect-free production behavior. Use `docs/architecture/m21-ui-ux-logic-stabilization.md` for the next stabilization milestone.

## Redaction Rules

Do not commit live URLs, D1 ids, account ids, deployment ids, run ids, tokens, secrets, exact timestamps, screenshots, Google Drive URLs, Apps Script URLs, raw exports, record payloads, backup artifacts, or infrastructure identifiers.
