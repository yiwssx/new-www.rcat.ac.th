# M8 Production Cutover Preflight - 2026-06-11

Status: production cutover preflight only. Production cutover is not executed or approved by this checkpoint.

## Purpose

M8 verifies local readiness inputs for a future controlled production cutover of `public-document-list`.

Apps Script remains the production source of truth. The default frontend provider remains Apps Script, and Cloudflare remains explicit env-only for `public-document-list`.

This checkpoint does not deploy production Worker code, run production D1 migration, import production data, set production Vercel env, or replace Apps Script as the production provider.

## Required Local Env Vars

The local preflight reads these environment variables:

- `RCAT_PROD_D1_DATABASE_NAME`
- `RCAT_PROD_D1_DATABASE_ID`
- `RCAT_PROD_WORKER_URL`
- `RCAT_PROD_FRONTEND_URL`
- `RCAT_PROD_CUTOVER_APPROVAL`

Do not commit real values. Keep production D1 ids, account details, tokens, and URLs outside git.

## Approval Value

`RCAT_PROD_CUTOVER_APPROVAL` must equal exactly:

```text
APPROVED_MANUAL_CUTOVER
```

This approval value only lets the local preflight report `READY` when all inputs are valid. It still does not execute cutover, mutate production resources, or approve production changes by itself.

## Preflight Command

Run from the repository root:

```bash
pnpm worker:production:preflight
```

## Possible Results

`BLOCKED` means one or more required local inputs are missing or unsafe. The script lists missing variable names or validation issues and prints `No production commands were run.`

`READY` means local inputs are valid for a future manually approved cutover checklist. It does not mean production was changed, deployed, migrated, seeded, or cut over.

## Production Cutover Evidence Template

Use this redacted template for a future approved production cutover record:

- Approval reference:
- Production D1 database name:
- Redacted production D1 database id:
- Production Worker origin:
- Production frontend origin:
- Production migration result:
- Production data import/seed result:
- Direct Worker smoke result:
- Browser/network smoke result:
- Response contract validation result:
- Rollback verification result:
- Production safety confirmation:

Do not include full D1 ids, tokens, account ids, secrets, query strings, real Google Drive URLs, or sensitive production data.

## Future Manual Cutover Steps

Draft only. Do not execute in M8.

Future cutover steps after separate approval:

- Confirm production D1.
- Apply production migration.
- Import approved production data.
- Deploy production Worker.
- Smoke test direct Worker.
- Set Vercel production env only after approval.
- Redeploy production frontend.
- Run browser/network smoke.
- Run rollback test.

Only `public-document-list` may be considered for this future cutover. No public-home, content detail, search, program, site-view, visitor-stats, admin, auth, media, upload, or Google Drive behavior is in scope.

## No-Go Conditions

Any condition below blocks production cutover:

- Missing approval.
- Missing production D1 id.
- Production D1 name looks preview, local, test, dev, staging, or sandbox.
- Worker URL looks preview or local.
- Frontend URL looks preview or local.
- Response contract unverified.
- Rollback unverified.
- Any secret, id, or URL committed.
- Any Apps Script change.
- Any `src/services/googleApi.ts` change.
- Any route, cache, or UI change.
- Any endpoint beyond `public-document-list`.
- Any admin, auth, or media migration.

## Production Safety Confirmation

M8 does not:

- Cut over production.
- Deploy production Worker.
- Run production D1 migration.
- Run production seed/import.
- Set Vercel production env.
- Commit production identifiers.
- Commit secrets.
- Modify Apps Script.
- Modify `src/services/googleApi.ts`.
- Modify UI, routes, cache keys, or cache TTL.
- Include endpoints beyond `public-document-list`.

The committed repository remains placeholder-safe. Production readiness evidence stays redacted, and real production identifiers remain outside git.
