# M20 Readiness Runbook

Status: cleanup completed; preview field verification in progress. M20 production cutover remains gated. This is the operator runbook for the approved M20 preview-backed Cloudflare field cutover; it does not authorize final production resource migration or claim final production readiness.

## M20 Preview-Backed Field Cutover

### Provider Boundary

- Admin structured data provider: Cloudflare.
- Public client data provider: Cloudflare.
- Media/attachment/file provider: Google Drive via Apps Script bridge.
- Database environment: preview D1 during field verification.
- Production D1 / final production cutover: explicitly deferred to operator decision after field verification.

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
3. Confirm the configured Worker and D1 targets are the approved preview environment without recording their identifiers.
4. Confirm the existing admin proxy/login path is used for admin access.
5. Confirm auth, RBAC, CORS, session, proxy, admin-gate, preview-write, and smoke-token boundaries are unchanged.
6. Confirm media upload, deletion, attachments, and binary files still use the Apps Script / Google Drive bridge.

### Field-Cutover Steps

1. Select Cloudflare for public client data through the existing operator-controlled configuration.
2. Select Cloudflare for admin structured data through the existing admin proxy/login path.
3. Keep the structured database target on preview D1.
4. Leave all media, attachment, and file operations on the existing Apps Script / Google Drive bridge.
5. Verify public pages read recreated structured content from Cloudflare.
6. Verify an authorized admin can log in, read the admin snapshot, and perform the approved structured-data lifecycle through the proxy path.
7. Verify media and file operations continue to use the existing bridge.
8. Verify admin write feedback shows a blocking loading modal while pending and centered success/error modals requiring acknowledgment.
9. Verify urgent marquee speed is readable across desktop, tablet, and mobile, including reduced-motion behavior.
10. Record only redacted pass/fail observations and non-sensitive issue labels.

### Preview Field Verification Checklist

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

### Field Observation

Observe public-read availability, admin structured-data operations, authorization failures, and media-bridge continuity during field verification. Production monitoring thresholds, alert routing, and support policy are deferred to the later production decision.

Stop field verification and escalate to the operator if:

- a production D1 or production Worker resource would be required;
- the admin proxy/login or an existing security boundary is bypassed;
- structured data unexpectedly uses Apps Script instead of Cloudflare;
- media, attachments, or files unexpectedly use Cloudflare instead of the existing bridge;
- a live identifier, credential, payload, export, screenshot, or backup artifact would need to be committed.

### Operator-Decision Dispositions

- Full structured data inventory: `NOT_APPLICABLE` because no legacy public structured migration is required.
- Cross-provider reconciliation: `NOT_APPLICABLE` because no legacy structured dataset must be reconciled.
- Media bridge verification: `EXCLUDED_FROM_CLOUDFLARE_CUTOVER`; it `REMAINS_APPS_SCRIPT_GOOGLE_DRIVE`.
- Identity/RBAC: `APPROVED_FOR_PREVIEW_FIELD_VERIFICATION_ONLY` through the existing admin proxy/login path.
- Backup/restore: `NOT_BLOCKING_PREVIEW_FIELD_VERIFICATION`; production-grade capability remains future work.
- Rollback to Apps Script: `NOT_REQUIRED_FOR_FIELD_CUTOVER`.
- Monitoring: `FIELD_VERIFICATION_OBSERVATION_ONLY`; production monitoring remains future work.
- Final cutover authority: `APPROVED_FOR_PREVIEW_FIELD_VERIFICATION_ONLY`.

### After Field Verification

Report redacted field outcomes to the operator. Do not provision or migrate to production D1, change final production resources, or claim final production readiness. Production D1 and final production cutover remain explicitly controlled by a later operator decision.

## Redaction Rules

Do not commit live URLs, D1 ids, account ids, deployment ids, run ids, tokens, secrets, exact timestamps, screenshots, Google Drive URLs, Apps Script URLs, raw exports, record payloads, backup artifacts, or infrastructure identifiers.
