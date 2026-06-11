# M6 Preview Worker D1 Smoke - 2026-05-27

Status: actual non-production preview smoke remains blocked. This is not a production cutover.

Preview Resource Status: Blocked

M6.4 correction: previous header incorrectly marked the checkpoint as Ready/pass while the detailed results still showed BLOCKED. The checkpoint remains blocked until actual preview smoke evidence is recorded.

## Purpose

M6 is the first checkpoint where the Cloudflare Worker should be connected to a real non-production D1 database, seeded with sanitized preview data, deployed to an HTTPS preview Worker URL, and tested from a Vercel preview or local frontend with `VITE_PUBLIC_API_PROVIDER=cloudflare`.

The only API in scope is `public-document-list`.

## Current Repository State

- `cloudflare/public-api/wrangler.toml` still uses placeholder D1 IDs only.
- `cloudflare/public-api/seed/public-documents.preview.seed.sql` contains fake `preview-*` document rows only.
- The frontend provider default remains Apps Script.
- Cloudflare is selected only by explicit `VITE_PUBLIC_API_PROVIDER=cloudflare`.
- No production D1 id, production data, secret, or production Vercel env is committed.

## M6.2 Attempt - 2026-06-10

M6.2 rechecked the actual preview smoke gate and stopped before any remote operation because required external non-production resources were still missing.

### Required External Input Check

Missing required inputs:

- non-production D1 database name and id
- HTTPS preview Worker URL
- Vercel preview frontend URL
- Vercel preview env access

Observed committed state:

- `cloudflare/public-api/wrangler.toml` still uses `database_id = "preview-placeholder"`.
- No relevant Cloudflare, D1, Wrangler, Vercel, or Cloudflare public API frontend env variable names were present in the local shell.
- No non-production preview values were provided in the M6.2 request.

### Remote Preview Commands

Skipped.

Reason: M6.2 requires stopping if any external input is missing. Running remote migration, seed, deploy, Vercel env, or browser smoke without the required non-production inputs would risk targeting the wrong environment.

Commands not run:

```bash
pnpm wrangler d1 migrations apply <preview-d1-database-name> --remote --env preview --config cloudflare/public-api/wrangler.toml
pnpm wrangler d1 execute <preview-d1-database-name> --remote --env preview --file cloudflare/public-api/seed/public-documents.preview.seed.sql --config cloudflare/public-api/wrangler.toml
pnpm wrangler deploy --env preview --config cloudflare/public-api/wrangler.toml
```

## M6.4 Attempt - 2026-06-10

M6.4 ran only the local preview smoke preflight gate and stopped before any remote operation.

### Preflight Result

BLOCKED.

Missing env vars:

- `RCAT_PREVIEW_D1_DATABASE_NAME`
- `RCAT_PREVIEW_D1_DATABASE_ID`
- `RCAT_PREVIEW_WORKER_URL`
- `RCAT_VERCEL_PREVIEW_URL`

### Remote Preview Commands

Not run.

Reason: the preflight result was `BLOCKED`, so running remote preview commands would risk targeting an unverified environment.

### Migration Result

Not run.

Reason: no confirmed non-production D1 database name or id was available through the required preflight env values.

### Preview Seed Result

Not run.

Reason: seeding requires a confirmed non-production D1 preview binding.

### Preview Worker Deploy Result

Not run.

Reason: no confirmed HTTPS preview Worker URL or non-production D1 binding was available.

### Vercel Preview Env Result

Not set.

Reason: no confirmed Vercel preview frontend URL or preview env access was available through the required preflight env values.

### Browser And Network Smoke Result

Not run.

Reason: no HTTPS preview Worker URL or Vercel preview frontend URL was available.

### Rollback Result

Not needed because no env changed.

### Production Safety Confirmation

- no production cutover
- no production D1 id
- no production data
- no secrets
- no Apps Script change
- no `src/services/googleApi.ts` change
- no UI, route, cache key, or cache TTL change

## Preview D1 Name And Id Handling

The intended non-production preview database name is:

```text
rcat-public-api-preview
```

The committed preview `database_id` remains:

```text
preview-placeholder
```

A real preview D1 id is not available in this repository or in the M6 request. Keep the real non-production id outside git unless a separate preview provisioning change explicitly approves committing it and proves that it is not production.

Never replace the placeholder with a production D1 id.

## Migration Result

Not run.

Reason: no real non-production preview D1 database name and id are available in the repo, request, or local shell.

When a real preview D1 exists, apply only the existing public-read migration to the preview environment:

```bash
pnpm wrangler d1 migrations apply rcat-public-api-preview --remote --env preview --config cloudflare/public-api/wrangler.toml
```

Before running the command, confirm that the `preview` environment is bound to a non-production D1 database.

## Preview Seed Result

Not run.

Reason: seeding requires the real non-production preview D1 binding above.

When the preview D1 is confirmed, seed only sanitized preview documents:

```bash
pnpm wrangler d1 execute rcat-public-api-preview --remote --env preview --file cloudflare/public-api/seed/public-documents.preview.seed.sql --config cloudflare/public-api/wrangler.toml
```

The seed must remain documents-only, fake-only, and limited to `example.test` URLs.

## Preview Worker URL

Not available.

The HTTPS preview Worker URL must be recorded outside git for the smoke run. Do not commit a real preview URL if it contains account, route, or deployment details that should remain environment-specific.

## Preview Worker Deploy Result

Not run.

Reason: no real non-production preview D1 binding or Worker URL is available.

When the preview binding is confirmed, deploy only the preview Worker environment:

```bash
pnpm wrangler deploy --env preview --config cloudflare/public-api/wrangler.toml
```

Do not deploy or route production traffic as part of M6.

## Vercel Preview Env Result

Not set.

Reason: no Vercel preview frontend URL or Vercel preview env access is available.

When a Vercel preview environment is ready, configure preview scope only:

```bash
VITE_PUBLIC_API_PROVIDER=cloudflare
VITE_CLOUDFLARE_PUBLIC_API_URL=<preview-worker-https-url>
```

Do not modify production Vercel environment variables or production project config.

## Browser And Network Smoke Result

Not run.

Reason: no HTTPS preview Worker URL and no Vercel preview frontend URL are available in this task.

When external resources exist, verify:

- The public document list frontend page still renders with unchanged UI.
- The browser network request goes to `<preview-worker-https-url>/api/public/documents`.
- The response status is `200`.
- The response validates as `PublicDocumentListSnapshot`.
- No public-home, content detail, search, program, site-view, visitor-stats, admin, auth, or media route uses Cloudflare.

## Rollback Result

Not run.

Reason: no Vercel preview env was changed, so no rollback action was needed.

## Rollback Procedure

Rollback is frontend preview env only:

```bash
VITE_PUBLIC_API_PROVIDER=apps-script
```

or remove `VITE_PUBLIC_API_PROVIDER`.

The frontend then returns to Apps Script for `public-document-list`. Apps Script remains the production provider and source of truth throughout M6.

## Production Safety Confirmation

- No production cutover.
- No production D1 id committed.
- No real production data committed.
- No real Google Drive URLs committed.
- No Apps Script changes.
- No `src/services/googleApi.ts` changes.
- No UI, route, cache key, or cache TTL changes.
- No provider switch beyond the existing explicit `public-document-list` path.
- No admin, auth, media upload, or Google Drive behavior migration.

## Next Step

Provide or configure the real non-production preview D1 database name/id, HTTPS Worker preview URL, Vercel preview frontend URL, and Vercel preview env access outside git, then rerun this M6 smoke checklist and update the result fields above in a preview-only follow-up.
