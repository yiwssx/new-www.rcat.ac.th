# M6 Preview Worker D1 Smoke - 2026-05-27

> Historical note, 2026-07-04: This checkpoint describes an early preview Worker/D1 smoke state and is not the current runtime source of truth. Current runtime ownership has advanced: structured public/admin data uses Cloudflare Worker + D1, Apps Script is retained only for the Vercel-proxied Google Drive media/file bridge, cleanup is completed, preview field verification is in progress, and M20 production cutover remains gated.

Status: actual non-production preview smoke completed successfully using external non-committed preview resources. This is not a production cutover.

Preview Resource Status: Completed

Committed Repository State: Safe placeholder state

M6 completion is based on recorded external smoke evidence from non-production local/env values. The committed repository intentionally keeps the preview D1 binding as `database_id = "preview-placeholder"` so preview infrastructure identifiers do not leak into git.

## Purpose

M6 is the first checkpoint where the Cloudflare Worker should be connected to a real non-production D1 database, seeded with sanitized preview data, deployed to an HTTPS preview Worker URL, and tested from a Vercel preview or local frontend with `VITE_PUBLIC_API_PROVIDER=cloudflare`.

The only API in scope is `public-document-list`.

## Current Repository State

- `cloudflare/public-api/wrangler.toml` still uses placeholder D1 IDs only, including `database_id = "preview-placeholder"` for `[env.preview]`.
- `cloudflare/public-api/seed/public-documents.preview.seed.sql` contains fake `preview-*` document rows only.
- The frontend provider default remains Apps Script.
- Cloudflare is selected only by explicit `VITE_PUBLIC_API_PROVIDER=cloudflare`.
- No production D1 id, production data, secret, or production Vercel env is committed.
- The real preview D1 id was used only outside git through local Wrangler configuration/env during smoke.
- The committed Worker config was intentionally reverted to `preview-placeholder` before commit.

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

M6.4 completed the actual non-production preview smoke using external preview resources that were provided outside git. The committed repository remains in the safe placeholder state after the smoke.

### Preflight Result

READY.

Required env vars were provided outside git:

- `RCAT_PREVIEW_D1_DATABASE_NAME`
- `RCAT_PREVIEW_D1_DATABASE_ID`
- `RCAT_PREVIEW_WORKER_URL`
- `RCAT_VERCEL_PREVIEW_URL`

Actual IDs and sensitive preview URLs are not printed in this document.

### Remote Preview Commands

Run against confirmed non-production preview only.

The real preview D1 id was used only outside git through local Wrangler configuration/env. It was not committed.

### Migration Result

Passed.

Migration applied to confirmed non-production preview D1.

### Preview Seed Result

Passed.

Only sanitized preview document seed data was applied.

### Preview Worker Deploy Result

Passed.

Preview Worker deployed using the non-production binding.

### Vercel Preview Env Result

Passed.

Preview scope only:

- `VITE_PUBLIC_API_PROVIDER=cloudflare`
- `VITE_CLOUDFLARE_PUBLIC_API_URL=<redacted-preview-worker-origin>`

Production Vercel env was not changed.

### Browser And Network Smoke Result

Passed.

- Preview frontend loaded.
- Browser/network request went to preview Worker `/api/public/documents`.
- `/api/public/documents` returned HTTP `200`.
- Response matched `PublicDocumentListSnapshot`.
- UI remained unchanged.
- No public-home, content detail, search, program, site-view, visitor-stats, admin, auth, or media endpoint was switched to Cloudflare.

### Rollback Result

Passed.

Preview frontend was returned to Apps Script by removing the preview provider env or setting:

- `VITE_PUBLIC_API_PROVIDER=apps-script`

### Committed Repository Safety Confirmation

Passed.

- Committed `cloudflare/public-api/wrangler.toml` uses `database_id = "preview-placeholder"`.
- No real D1 id committed.
- No secrets or tokens committed.
- No production D1 id committed.
- No production data committed.
- No real Google Drive URLs committed.
- No Apps Script changes.
- No `src/services/googleApi.ts` changes.
- No UI, route, cache key, or cache TTL changes.
- No admin, auth, media upload, or Google Drive behavior migration.

## Preview D1 Name And Id Handling

The intended non-production preview database name is:

```text
rcat-public-api-preview
```

The committed preview `database_id` remains:

```text
preview-placeholder
```

A real preview D1 id was used only outside git for the completed smoke. Keep the real non-production id outside git unless a separate preview provisioning change explicitly approves committing it and proves that it is not production.

Never replace the placeholder with a production D1 id.

## Migration Result

Passed.

The migration was applied to the confirmed non-production preview D1 using local/env values that were not committed.

For future reruns, apply only the existing public-read migration to the preview environment:

```bash
pnpm wrangler d1 migrations apply rcat-public-api-preview --remote --env preview --config cloudflare/public-api/wrangler.toml
```

Before running the command, confirm that the `preview` environment is bound to a non-production D1 database through local/env values and that no real id is staged for commit.

## Preview Seed Result

Passed.

Only sanitized preview documents from `cloudflare/public-api/seed/public-documents.preview.seed.sql` were applied.

For future reruns, seed only sanitized preview documents:

```bash
pnpm wrangler d1 execute rcat-public-api-preview --remote --env preview --file cloudflare/public-api/seed/public-documents.preview.seed.sql --config cloudflare/public-api/wrangler.toml
```

The seed must remain documents-only, fake-only, and limited to `example.test` URLs.

## Preview Worker URL

Verified outside git and redacted from this document.

The HTTPS preview Worker URL was used for the smoke run but is not committed because it may contain account, route, or deployment details that should remain environment-specific.

## Preview Worker Deploy Result

Passed.

The preview Worker was deployed using a non-production D1 binding supplied outside git.

For future reruns, deploy only the preview Worker environment:

```bash
pnpm wrangler deploy --env preview --config cloudflare/public-api/wrangler.toml
```

Do not deploy or route production traffic as part of M6.

## Vercel Preview Env Result

Passed.

Vercel preview scope only:

```bash
VITE_PUBLIC_API_PROVIDER=cloudflare
VITE_CLOUDFLARE_PUBLIC_API_URL=<redacted-preview-worker-origin>
```

Do not modify production Vercel environment variables or production project config.

## Browser And Network Smoke Result

Passed.

- The public document list frontend page rendered with unchanged UI.
- The browser network request went to the preview Worker `/api/public/documents`.
- The response status is `200`.
- The response validated as `PublicDocumentListSnapshot`.
- No public-home, content detail, search, program, site-view, visitor-stats, admin, auth, or media route uses Cloudflare.

## Rollback Result

Passed.

The preview frontend was returned to Apps Script by removing the explicit Cloudflare provider env or setting `VITE_PUBLIC_API_PROVIDER=apps-script`.

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

Keep the committed repository in placeholder-safe state. Future work can proceed to the next preview-only migration checkpoint while preserving Apps Script as the default and production provider.
