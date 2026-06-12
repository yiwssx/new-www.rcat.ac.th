# M13 Public Document List Controlled Production Import

Status: controlled production D1 import checkpoint only. Production frontend cutover is not approved or executed.

## Purpose

M13 adds an approval-gated production import runner for validated `public-document-list` rows.

M13 may write validated `public-document-list` rows into production D1 only after explicit approval. It creates a safe operational path for a future controlled import without changing the current production frontend provider.

Actual production import: not executed in this commit.

## Scope

Scope is limited to `public-document-list`.

M13 does not switch frontend to Cloudflare, does not modify any other public endpoint, and does not migrate admin, auth, media uploads, search, home content, detail content, site view, or visitor stats.

## Required Approval

Execution requires:

- `--execute`
- production D1 environment variables
- exact approval phrase: `APPROVED_PRODUCTION_D1_IMPORT`

Without all gates, the runner returns `BLOCKED` and performs no D1 writes.

## Required Environment Variables

Execute mode requires:

- `RCAT_PROD_D1_DATABASE_NAME`
- `RCAT_PROD_D1_DATABASE_ID`
- `RCAT_PROD_IMPORT_APPROVAL`

Optional:

- `RCAT_PROD_IMPORT_BATCH_SIZE`
- `RCAT_PROD_WORKER_URL` for external direct Worker smoke notes only
- `RCAT_PROD_IMPORT_OPERATOR` for external audit metadata

The committed repository must not contain real D1 ids, account ids, secrets, tokens, or production Worker URLs.

## Input Data Handling

Production export input is created outside git and supplied as a local file with:

```bash
pnpm worker:public-documents:import:prod -- --input <local-secure-export-path>
```

Execute mode:

```bash
pnpm worker:public-documents:import:prod -- --input <local-secure-export-path> --execute
```

JSON or manifest output:

```bash
pnpm worker:public-documents:import:prod -- --input <local-secure-export-path> --json
```

Input requirements:

- local file only
- no Apps Script, Sheets, Drive, or network fetches
- no committed production export
- repository-local input is blocked unless it is under an ignored temp path
- validation happens before any write-capable command

## Import Validation Gates

The runner blocks before execute if any gate fails:

- source record validation
- D1 row validation
- public snapshot contract validation
- sorting validation
- field leakage validation
- production D1 environment validation
- exact approval phrase validation

Sorting remains:

- pinned first
- `sort_order` ascending
- `published_at` descending
- `updated_at` descending

## Execution Mode

Default mode is dry-run and performs no writes.

Execute mode builds a temporary SQL file outside git, runs remote D1 execution only after approval and environment gates pass, and deletes the temporary SQL file after execution.

The selected import strategy is:

- transaction
- clear/replace the `documents` table for this endpoint data set
- insert validated rows
- no schema migration
- no destructive schema change

M13 does not deploy production Worker.

## Result Manifest / Audit Evidence

The safe result object records:

- checkpoint
- scope
- dry-run or execute mode
- status
- input basename/path label
- input SHA-256
- source count
- validation status
- safe target database label
- redacted D1 id
- row count
- batch count
- executed timestamp when imported
- first public item ids
- safety flags
- indexed validation issue messages

It does not record full records, full SQL, full D1 id, secrets, tokens, full file URLs, or document descriptions.

## Output Redaction Rules

Text and JSON output must not include:

- full records
- full file URLs
- document descriptions
- full SQL
- secrets
- tokens
- full D1 database id
- production Worker URL
- Google file-storage URLs
- Apps Script endpoint URLs

Output may include:

- checksum
- counts
- first 3 public item ids if non-sensitive
- redacted D1 id
- safe database name label
- status
- executed timestamp
- approval gate status

## Rollback Position

Rollback at M13 is simply: do not point frontend at production D1/Worker; Apps Script continues serving production frontend.

If import content is wrong, re-run the controlled import with corrected external input, or keep D1 unused until corrected.

## No-Go Conditions

No-go conditions:

- no exact approval phrase
- missing production D1 env
- non-production D1 database name
- placeholder or malformed D1 id
- production export committed to git
- full file URLs in output
- unsafe URLs
- D1 id-looking values in input
- unknown fields
- invalid status
- invalid dates
- invalid order or pinned values
- unsafe filenames or media ids
- public snapshot leakage
- frontend provider change
- Vercel production environment change
- Apps Script change
- `src/services/googleApi.ts` change
- UI, route, cache key, or cache TTL change

## Production Safety Confirmation

M13 does not change Vercel production env.

M13 does not deploy production Worker.

M13 does not change Apps Script.

M13 does not change `src/services/googleApi.ts`.

M13 does not change UI/routes/cache.

Apps Script remains production source of truth for live frontend until M15 cutover.

Production frontend cutover remains not approved.

## Relationship To M14 And M15

M13 does not authorize M14/M15.

M14 may separately verify production Worker direct smoke if approved.

M15 may separately consider production frontend cutover if approved.

M13 is only the controlled production D1 import checkpoint.
