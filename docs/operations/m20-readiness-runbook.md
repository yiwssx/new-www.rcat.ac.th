# M20 Readiness Runbook

Status: operator runbook for M20-P0 readiness preparation. This runbook does not authorize production execution.

## Preconditions

1. Work from a clean branch containing M19 closure and M20-P0 scaffolding.
2. Keep local environment values outside git.
3. Confirm the target is preview or readiness review unless a later approved checkpoint explicitly authorizes production.
4. Do not mutate Apps Script or Google Drive during M20-P0.
5. Do not commit endpoints, ids, tokens, secrets, record payloads, screenshots, or infrastructure identifiers.

## Local Repository Readiness

Run from the repository root:

    pnpm worker:m20:readiness
    pnpm worker:m19:readiness

Expected repository-only result:

- M19 remains closed.
- M20 remains blocked or readiness-only.
- Worker production placeholder safety remains intact.
- Apps Script remains fallback and rollback provider.
- Media binary operations remain Apps Script-backed.
- M20 readiness documents exist.
- No remote commands are run.

## Post-M19 Public-Read Preview Smoke

Purpose: prove the current preview Worker still satisfies public-read contracts after M19 closure.

Operator steps:

1. Confirm <preview-worker-origin> is a non-production Worker origin.
2. Confirm the origin is not the live school domain, Apps Script, Google Drive, or a production Worker origin.
3. Set local-only environment values outside git:

   RCAT_M17_PUBLIC_READ_SMOKE_APPROVAL=APPROVED_M17_PUBLIC_READ_PREVIEW_SMOKE
   RCAT_PREVIEW_WORKER_URL=<preview-worker-origin>

4. Run from the repository root:

   pnpm worker:public-read:preview-smoke

5. Record redacted evidence:

- result label
- endpoint labels only
- item counts if approved
- validation issue labels
- no endpoint values
- no record payloads

## Preview-Only Migration Verification

Purpose: prove pending migrations apply to a confirmed non-production D1 database before any production discussion.

Operator steps:

1. Confirm <preview-d1-database-name> is non-production.
2. Confirm no production D1 database id is present in git.
3. Apply migrations to preview only:

   pnpm wrangler d1 migrations apply <preview-d1-database-name> --remote --env preview --config cloudflare/public-api/wrangler.toml

4. Verify expected tables and triggers using preview-only inspection commands approved by the operator.
5. Record redacted evidence:

- migration batch label
- pass or fail
- expected table and trigger labels
- no D1 id
- no database dump

## Admin Write Preview Smoke

Purpose: verify the candidate preview Worker still supports structured admin writes behind the preview gate.

Operator steps:

1. Confirm Cloudflare Access and preview smoke-token paths remain separate.
2. Set local-only values outside git for the approved preview smoke.
3. Run from the repository root:

   pnpm worker:admin-write:preview-smoke

4. Confirm the smoke lifecycle cleans up its own records.
5. Record redacted evidence:

- result label
- lifecycle step labels
- cleanup result
- no smoke token value
- no record payload

## Full Structured Data Inventory

Purpose: establish the source-of-truth dataset before migration.

Operator steps:

1. Export or enumerate every structured dataset from the current approved source of truth.
2. Include documents, content, settings, menu, carousel, external services, events, media metadata, visitor settings, and admin-owned structured records.
3. Classify malformed, duplicate, draft, archived, and missing-reference records.
4. Record counts and policy decisions in redacted evidence.
5. Do not commit raw exports or record payloads.

## Cross-Provider Reconciliation

Purpose: prove Cloudflare D1 preview output matches the approved source inventory.

Operator steps:

1. Load sanitized or approved preview data into preview D1 only.
2. Read Cloudflare public and admin snapshots from preview.
3. Compare counts, required fields, slugs, ids, status handling, ordering policy, and reference integrity.
4. Record mismatches as blocker labels.
5. Do not commit source exports, response payloads, or endpoint values.

## Media Bridge Verification

Purpose: prove Apps Script remains a safe Google Drive media-file bridge.

Operator steps:

1. Confirm media binary upload and delete operations remain Apps Script-backed.
2. Confirm service identity, Drive folder ownership, permissions, quota, retry, and orphan-cleanup ownership.
3. Use an approved non-production Drive folder or already-approved operator sample for any destructive rehearsal.
4. Record only result labels and policy decisions.
5. Do not commit Google Drive URLs, file ids, screenshots, or file payloads.

## Identity/RBAC Approval

Purpose: ensure production admin access is approved before production execution.

Operator steps:

1. Identify production identity provider.
2. Approve MFA requirements.
3. Approve role mapping for admin, editor, viewer, and emergency access.
4. Approve revocation and session expiry policy.
5. Approve Cloudflare Access or successor boundary.
6. Record approval labels and owner roles only.

## Backup Rehearsal

Purpose: prove structured data can be backed up before cutover.

Operator steps:

1. Use a confirmed non-production D1 database.
2. Run the approved backup process outside git.
3. Verify backup artifact integrity.
4. Record artifact label, size class, checksum label, and owner role in redacted form.
5. Do not commit backup artifacts.

## Restore Rehearsal

Purpose: prove a backup can be restored to a separate non-production target.

Operator steps:

1. Restore the approved backup to <restore-rehearsal-d1-database-name>.
2. Run read-only public and admin snapshot checks.
3. Verify counts and required contract labels.
4. Record pass or fail and mismatch labels.
5. Do not commit restored data or database identifiers.

## Rollback Rehearsal

Purpose: prove Apps Script rollback remains available.

Operator steps:

1. Confirm Apps Script fallback provider is still configured and reachable by approved environment path.
2. Rehearse returning the frontend provider to Apps Script in a non-production or approved dry-run environment.
3. Verify public document list and public home load through fallback.
4. Verify no cache key or cache TTL change is required.
5. Record rollback command label and pass or fail outcome only.

## Monitoring And Alert Threshold Approval

Purpose: define support readiness before any future production execution.

Operator steps:

1. Approve public-read error-rate threshold.
2. Approve admin-write error-rate threshold.
3. Approve latency threshold.
4. Approve D1 query error threshold.
5. Approve fallback activation criteria.
6. Assign support owner and escalation path.
7. Record thresholds as labels or approved ranges only when safe.

## Final Cutover Approval

Purpose: prevent accidental production execution.

Operator steps:

1. Confirm every prior section has approved redacted evidence.
2. Confirm production domain strategy.
3. Confirm production Worker, D1, and Vercel resources outside git.
4. Confirm monitoring window and rollback owner.
5. Record explicit cutover authority for the future checkpoint.
6. Do not run production cutover from M20-P0.

M20 remains blocked until the final approval is separately recorded.
