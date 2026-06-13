# M14 Public Document List Production Worker Smoke

Status: direct production Worker smoke gate only. Production frontend cutover is not approved or executed.

## Purpose

M14 adds a direct production Worker smoke gate for `public-document-list`.

M14 verifies production Worker directly. It checks the Worker endpoint response contract without changing live frontend traffic.

Actual production Worker smoke: not executed in this commit.

## Scope

Scope is limited to `public-document-list`.

M14 does not switch frontend to Cloudflare, does not change any other endpoint, and does not migrate admin, auth, media uploads, search, home content, detail content, site view, or visitor stats.

## Required Approval

The smoke runner requires:

- `RCAT_PROD_WORKER_URL`
- `RCAT_PROD_WORKER_SMOKE_APPROVAL`
- exact approval phrase: `APPROVED_PRODUCTION_WORKER_SMOKE`

Without the required values, the runner returns `BLOCKED`, exits non-zero, and makes no network call.

## Required Environment Variables

Required:

- `RCAT_PROD_WORKER_URL`
- `RCAT_PROD_WORKER_SMOKE_APPROVAL`

Optional:

- `RCAT_PROD_WORKER_SMOKE_OPERATOR`
- `RCAT_PROD_EXPECTED_PUBLIC_DOCUMENT_COUNT`

The committed repository must not contain real Worker URLs, D1 ids, account ids, secrets, or tokens.

## Smoke Command

Default command:

```bash
pnpm worker:public-documents:worker-smoke
```

Optional arguments:

```bash
pnpm worker:public-documents:worker-smoke -- --timeout-ms 10000 --expected-min-count 1
pnpm worker:public-documents:worker-smoke -- --json
```

The runner calls only:

```text
GET <redacted-worker-origin>/api/public/documents
```

## Validation Gates

The smoke runner validates:

- environment gate
- exact approval phrase
- safe HTTPS Worker URL
- HTTP 2xx response
- JSON parsing
- `PublicDocumentListSnapshot` shape
- public item keys only
- timestamp, `order`, and `pinned` types
- pinned-first ordering
- `order` ascending
- `publishedAt` descending
- `updatedAt` descending
- no internal field leakage
- expected minimum item count

## Result Manifest / Audit Evidence

The safe result manifest records:

- checkpoint
- scope
- status
- redacted Worker host label
- endpoint path
- HTTP status and ok flag
- item count
- expected minimum count
- first 3 public item ids only
- snapshot `generatedAt`
- checks passed or blocked
- safety flags
- validation issue messages

It does not record full records, full file URLs, descriptions, full Worker URL, secrets, tokens, D1 ids, Google file-storage URLs, or Apps Script endpoint URLs.

## Output Redaction Rules

Text and JSON output may include:

- redacted Worker host label
- endpoint path
- HTTP status
- item count
- expected minimum count
- first 3 public item ids only
- snapshot `generatedAt`
- checks passed or blocked

Text and JSON output must not include:

- full Worker URL
- full records
- full file URLs
- descriptions
- secrets
- tokens
- D1 ids
- Google file-storage URLs
- Apps Script endpoint URLs

## No-Go Conditions

No-go conditions:

- missing Worker URL
- missing approval phrase
- incorrect approval phrase
- non-HTTPS Worker URL
- localhost Worker URL
- preview, staging, dev, test, or sandbox Worker URL
- Apps Script endpoint URL
- Google file-storage URL
- Vercel preview URL
- non-2xx Worker response
- invalid JSON
- invalid snapshot contract
- internal field leakage
- invalid ordering
- item count below expected minimum
- frontend provider change
- Vercel production environment change
- Apps Script change
- `src/services/googleApi.ts` change
- UI, route, cache key, or cache TTL change

## Production Safety Confirmation

M14 does not change Vercel production env.

M14 does not switch frontend to Cloudflare.

M14 does not deploy Worker.

M14 does not write D1.

M14 does not run production import.

M14 does not change Apps Script.

M14 does not change `src/services/googleApi.ts`.

M14 does not change UI/routes/cache.

Apps Script remains production source of truth for live frontend until M15 cutover.

Production frontend cutover remains not approved.

## Relationship To M15

M14 does not authorize M15.

M15 is a separate production frontend cutover decision.

M14 is only the direct production Worker smoke gate.
