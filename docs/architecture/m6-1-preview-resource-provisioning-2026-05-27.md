# M6.1 Preview Resource Provisioning - 2026-05-27

> Historical note, 2026-07-04: This checkpoint describes an early preview resource planning state and is not the current runtime source of truth. Current runtime ownership has advanced: structured public/admin data uses Cloudflare Worker + D1, Apps Script is retained only for the Vercel-proxied Google Drive media/file bridge, cleanup is completed, preview field verification is in progress, and M20 production cutover remains gated.

Status: provisioning record only. M6 remains blocked until external non-production preview resources exist.

## Purpose

This checkpoint records the external resources required to run the actual M6 non-production Worker + D1 preview smoke for `public-document-list`.

It does not create resources, deploy Workers, configure Vercel, seed D1, or cut over production traffic.

## Cloudflare Account And Project Confirmation

Before M6 smoke can run, confirm outside git:

- The Cloudflare account is the intended non-production or preview-capable account.
- The Worker project is `rcat-public-api-preview` or an explicitly scoped non-production equivalent.
- The account has Wrangler access for preview D1 migration, preview seed, and preview Worker deploy.
- No production route, production custom domain, or production Worker environment is targeted.

Do not commit account ids, API tokens, account-specific URLs, or secrets.

## Non-Production D1 Database Name

Preferred preview database name:

```text
rcat-public-api-preview
```

The database must be non-production and used only for sanitized `public-document-list` preview smoke data.

## Non-Production D1 Database Id Handling

Committed placeholder:

```text
<preview-d1-database-id>
```

Keep the real preview D1 database id outside git unless a separate provisioning change explicitly approves committing it and proves it is non-production.

`cloudflare/public-api/wrangler.toml` must keep `database_id = "preview-placeholder"` until that separate approval exists.

Never commit production D1 ids.

## HTTPS Preview Worker URL

Required external value:

```text
<preview-worker-https-url>
```

The URL must point to the non-production preview Worker only. Keep the real value in deployment records or preview environment configuration outside git.

## Vercel Preview Frontend URL

Required external value:

```text
<vercel-preview-url>
```

Use only a Vercel preview deployment for M6 smoke. Do not configure production project environment variables for this checkpoint.

## Vercel Preview Env Vars

Set these in Vercel preview scope only:

```bash
VITE_PUBLIC_API_PROVIDER=cloudflare
VITE_CLOUDFLARE_PUBLIC_API_URL=<preview-worker-https-url>
```

The default provider remains Apps Script when `VITE_PUBLIC_API_PROVIDER` is missing, empty, unknown, or set to `apps-script`.

## Sanitized Preview Seed

Use only:

```text
cloudflare/public-api/seed/public-documents.preview.seed.sql
```

The preview seed must remain:

- fake data only
- documents-only
- `preview-*` ids only
- `example.test` URLs only
- no production data
- no real file storage URLs
- no admin, auth, user, media upload, public-home, content detail, search, program, site-view, or visitor-stats data

## M6 Smoke Run Inputs

Record these outside git before running M6:

```text
Cloudflare account/project: <confirmed-outside-git>
Preview D1 database name: rcat-public-api-preview
Preview D1 database id: <preview-d1-database-id>
Preview Worker URL: <preview-worker-https-url>
Vercel preview URL: <vercel-preview-url>
```

## M6 Smoke Checklist

Run these only after confirming every value is non-production:

1. Apply the existing public-read migration to the preview D1 database.
2. Execute the sanitized preview seed against the preview D1 database.
3. Deploy only the preview Worker environment.
4. Set only Vercel preview env vars.
5. Open `<vercel-preview-url>`.
6. Confirm the browser calls `<preview-worker-https-url>/api/public/documents`.
7. Confirm the response validates as `PublicDocumentListSnapshot`.
8. Confirm UI behavior is unchanged.
9. Confirm Apps Script remains production provider.

## Rollback

Rollback is Vercel preview env only:

```bash
VITE_PUBLIC_API_PROVIDER=apps-script
```

or remove `VITE_PUBLIC_API_PROVIDER`.

This returns `public-document-list` to Apps Script for the preview frontend. No Worker, D1, Apps Script, production env, UI route, cache key, or cache TTL change is required.

## Production Safety

- No production cutover.
- No production D1 id.
- No secrets or tokens.
- No real production data.
- No real file storage URLs.
- No Apps Script change.
- No `src/services/googleApi.ts` change.
- No UI, route, cache key, or cache TTL change.
- No production Vercel env or config change.
- No production Worker deploy.
- No endpoint switch except the existing explicit `public-document-list` preview path.

## Exit Criteria For Starting M6

M6 remains blocked until all of these are available outside git:

- confirmed non-production Cloudflare account/project
- confirmed non-production D1 database name and id
- confirmed HTTPS preview Worker URL
- confirmed Vercel preview frontend URL
- Vercel preview env values scoped to preview only
