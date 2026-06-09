# M6 Preview Worker D1 Smoke - 2026-05-27

Status: actual non-production preview smoke is blocked by missing external preview resources. This is not a production cutover.

Preview Resource Status: Blocked

## Purpose

M6 is the first checkpoint where the Cloudflare Worker should be connected to a real non-production D1 database, seeded with sanitized preview data, deployed to an HTTPS preview Worker URL, and tested from a Vercel preview or local frontend with `VITE_PUBLIC_API_PROVIDER=cloudflare`.

The only API in scope is `public-document-list`.

## Current Repository State

- `cloudflare/public-api/wrangler.toml` still uses placeholder D1 IDs only.
- `cloudflare/public-api/seed/public-documents.preview.seed.sql` contains fake `preview-*` document rows only.
- The frontend provider default remains Apps Script.
- Cloudflare is selected only by explicit `VITE_PUBLIC_API_PROVIDER=cloudflare`.
- No production D1 id, production data, secret, or production Vercel env is committed.

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

Reason: no real non-production preview D1 database id is available in the repo or request.

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

## Preview Worker Deploy

Not run.

Reason: no real non-production preview D1 binding or Worker URL is available.

When the preview binding is confirmed, deploy only the preview Worker environment:

```bash
pnpm wrangler deploy --env preview --config cloudflare/public-api/wrangler.toml
```

Do not deploy or route production traffic as part of M6.

## Vercel Preview Env

Not set.

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

## Rollback

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

Provide or configure the real non-production preview D1 database and HTTPS Worker preview URL outside git, then rerun this M6 smoke checklist and update the result fields above in a preview-only follow-up.
