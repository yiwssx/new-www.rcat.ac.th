# M15 Public Document List Production Frontend Cutover And Rollback

Status: production frontend cutover and rollback gate only. Cutover is not executed without explicit approval.

## Purpose

M15 defines the controlled production frontend cutover and rollback gate for `public-document-list`.

M15 is the only checkpoint that may switch frontend traffic for `public-document-list`.

Actual production frontend cutover: not executed in this commit.

## Scope

Scope is limited to `public-document-list`.

M15 does not authorize any endpoint beyond `public-document-list`.

M15 does not migrate public home, content detail, search, program, site view, visitor stats, admin, auth, media uploads, or any Apps Script write flow.

## Required Prior Evidence

Before real cutover execution, the operator must have:

- M13 production D1 import completed externally and safely, or confirmed not needed.
- M14 direct production Worker smoke passed externally and safely.
- Rollback command and environment ready.
- Production monitoring window approved.

## Required Approval

Cutover execution requires:

- `--cutover`
- `--execute`
- `RCAT_M15_CUTOVER_APPROVAL=APPROVED_PUBLIC_DOCUMENT_FRONTEND_CUTOVER`

Rollback execution requires:

- `--rollback`
- `--execute`
- `RCAT_M15_ROLLBACK_APPROVAL=APPROVED_PUBLIC_DOCUMENT_FRONTEND_ROLLBACK`

Without exact approval and execute mode, the runner must not change production frontend environment or trigger production deployment.

## Required Environment Variables

Required for execution-capable modes:

- `RCAT_PROD_FRONTEND_URL`
- `RCAT_PROD_WORKER_URL`

Required for cutover execution:

- `RCAT_M15_CUTOVER_APPROVAL`

Required for rollback execution:

- `RCAT_M15_ROLLBACK_APPROVAL`

Required when production frontend environment mutation is executed:

- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_ORG_ID`

Optional:

- `RCAT_M15_OPERATOR`
- `RCAT_PROD_EXPECTED_PUBLIC_DOCUMENT_COUNT`

The committed repository must not contain real production URLs, tokens, secrets, D1 ids, account ids, full records, Google file-storage URLs, or Apps Script endpoint URLs.

## Cutover Plan

Dry-run cutover:

```bash
pnpm worker:public-documents:cutover -- --cutover
```

Execute cutover:

```bash
pnpm worker:public-documents:cutover -- --cutover --execute
```

Execution may change Vercel production frontend env only with exact approval and execute mode.

The runner uses the existing provider env var names:

- `VITE_PUBLIC_API_PROVIDER=cloudflare`
- `VITE_CLOUDFLARE_PUBLIC_API_URL=<redacted-worker-origin>`

The runner verifies direct Worker smoke before production frontend mutation.

## Rollback Plan

Dry-run rollback:

```bash
pnpm worker:public-documents:cutover -- --rollback
```

Execute rollback:

```bash
pnpm worker:public-documents:cutover -- --rollback --execute
```

Rollback returns the production frontend provider to:

- `VITE_PUBLIC_API_PROVIDER=apps-script`

Apps Script remains rollback provider.

Rollback must remain available immediately after cutover.

## Verification Gates

The runner checks:

- environment gate
- exact approval phrase
- direct Worker smoke
- production frontend smoke
- provider config names and provider values
- production frontend environment mutation result
- rollback availability
- output redaction

Frontend verification only checks `public-document-list`.

If JSON is available, the runner validates the `PublicDocumentListSnapshot` shape, public keys only, item count, and ordering.

If HTML is returned, the runner checks only a safe public-document section marker and does not print HTML.

## Result Manifest / Audit Evidence

The safe result manifest records:

- checkpoint
- scope
- mode
- status
- redacted frontend host label
- redacted Worker host label
- provider before and provider target
- item count
- expected minimum count
- first 3 public item ids only
- snapshot `generatedAt`
- checks passed or blocked
- safety flags
- validation issue messages

M15 result evidence must be redacted.

## Output Redaction Rules

Output may include:

- redacted frontend host label
- redacted Worker host label
- provider target
- status
- mode
- endpoint/path label
- item count
- expected minimum count
- first 3 public item IDs only
- checks
- timestamp
- rollback availability status

Output must not include:

- full frontend URL
- full Worker URL
- full records
- full file URLs
- descriptions
- full HTML
- secrets
- tokens
- D1 ids
- Vercel project or org ids
- command environment values
- Google file-storage URLs
- Apps Script endpoint URLs

## No-Go Conditions

No-go conditions:

- missing `--execute` for production mutation
- missing exact approval phrase
- missing production frontend URL
- missing production Worker URL
- non-HTTPS URL
- localhost URL
- preview, staging, dev, test, or sandbox URL
- Apps Script endpoint URL as Worker target
- Google file-storage URL
- Vercel preview URL
- Worker smoke failure
- invalid production frontend smoke
- invalid `PublicDocumentListSnapshot`
- internal field leakage
- item count below expected minimum
- missing rollback path
- production D1 write, migration, import, or Worker deploy request

## Production Safety Confirmation

M15 does not change Apps Script.

M15 does not change `src/services/googleApi.ts`.

M15 does not change UI/routes/cache.

M15 does not write D1.

M15 does not deploy Worker.

M15 does not run production import.

M15 may change Vercel production frontend env only with exact approval and execute mode.

M15 does not commit real production URLs, tokens, secrets, D1 ids, account ids, full records, or Google file-storage URLs.

## Execution Runbook

1. Confirm M13 import evidence or written confirmation that import is not needed.
2. Confirm M14 direct Worker smoke evidence.
3. Confirm production monitoring window.
4. Confirm rollback command and env access.
5. Run dry-run cutover.
6. Run execute cutover only with exact approval.
7. Verify production frontend smoke.
8. Record only redacted result evidence.

## Rollback Runbook

1. Run dry-run rollback.
2. Run execute rollback only with exact rollback approval.
3. Verify production frontend uses Apps Script provider again.
4. Record only redacted result evidence.

## Migration Completion Criteria

Migration is not complete from this document alone.

Completion requires:

- approved execute cutover
- direct Worker smoke passed
- production frontend smoke passed
- rollback remained available
- rollback verification passed or rollback readiness was explicitly confirmed
- redacted result evidence recorded
- no production safety guardrail breach
