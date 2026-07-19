# M5 Non-Production D1 Preview - 2026-05-27

> Historical record — checkpoint 2026-05-27 at commit `fb4bb63482cd795c4495e574d25ddb1b9b22a170`. Measurements and runtime statements below are preserved as historical evidence, not current state. Current source of truth: [M20 cleanup runtime ownership](./m20-cleanup-runtime-ownership.md).

Status: preview/non-production setup path and sanitized preview seed only. This is not a production cutover.

## Purpose

M5 defines a safe Cloudflare Worker + D1 preview path for testing the M4 frontend provider switch against an HTTPS Worker API. The only frontend flow in scope is `public-document-list`.

Apps Script remains the default provider and production source of truth. Google Drive remains file storage.

## Scope

- Non-production Cloudflare Worker preview environment only.
- Non-production D1 preview database only.
- Sanitized fake public document rows only.
- `GET /api/public/documents` only.
- Frontend preview/local builds may opt in with explicit env.

## Files Added Or Changed

| File                                                           | Responsibility                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `cloudflare/public-api/wrangler.toml`                          | Adds `[env.preview]` and `[[env.preview.d1_databases]]` placeholder only |
| `cloudflare/public-api/seed/public-documents.preview.seed.sql` | Fake preview-only D1 seed rows for `documents`                           |
| `cloudflare/public-api/seed/README.md`                         | Documents local versus preview seed usage                                |
| `cloudflare/public-api/test/previewSafety.test.ts`             | Guards preview binding, seed safety, and Worker route contract           |
| `cloudflare/public-api/README.md`                              | Documents M5 preview usage and rollback                                  |
| `src/features/public-documents/apiProviderSwitch.test.ts`      | Strengthens default-provider test isolation from local preview env       |
| `src/features/public-documents/cloudflareApi.test.ts`          | Strengthens missing-URL test isolation from local preview env            |

## Cloudflare Preview Binding

`wrangler.toml` now includes:

```toml
[env.preview]
name = "rcat-public-api-preview"

[[env.preview.d1_databases]]
binding = "DB"
database_name = "rcat-public-api-preview"
database_id = "preview-placeholder"
```

`preview-placeholder` is not a real D1 database id. A real non-production preview database id must be configured outside git or added only in a separately approved preview provisioning task. No production D1 id is committed.

The default local binding remains:

```toml
database_name = "rcat-public-api-local"
database_id = "local-placeholder"
```

## Sanitized Preview Data

`cloudflare/public-api/seed/public-documents.preview.seed.sql`:

- deletes only rows with IDs matching `preview-%`
- inserts only fake `preview-*` document rows
- inserts into `documents` only
- uses `example.test` URLs only
- contains no `rcat.ac.th`, `script.google.com`, or `drive.google.com`
- contains no real names, real files, secrets, auth data, users, admin data, or media upload records

## Frontend Preview Env

For Vercel preview or local frontend testing:

```bash
VITE_PUBLIC_API_PROVIDER=cloudflare
VITE_CLOUDFLARE_PUBLIC_API_URL=<preview-worker-https-url>
```

The provider remains Apps Script when `VITE_PUBLIC_API_PROVIDER` is missing, empty, unknown, or set to `apps-script`.

No production Vercel env or config is changed in M5.

## Preview Setup Checklist

Only perform these steps when a real non-production Cloudflare preview D1 database exists outside git:

1. Create a non-production D1 database in Cloudflare.
2. Configure the preview Worker environment with the preview database id outside committed source, or replace the placeholder in a separately approved preview-only change.
3. Apply the migration remotely:

```bash
pnpm wrangler d1 migrations apply <preview-d1-database-name> --remote --env preview --config cloudflare/public-api/wrangler.toml
```

4. Seed sanitized preview rows:

```bash
pnpm wrangler d1 execute <preview-d1-database-name> --remote --env preview --file cloudflare/public-api/seed/public-documents.preview.seed.sql --config cloudflare/public-api/wrangler.toml
```

5. Deploy the Worker preview environment:

```bash
pnpm wrangler deploy --env preview --config cloudflare/public-api/wrangler.toml
```

6. Configure Vercel preview env only:

```bash
VITE_PUBLIC_API_PROVIDER=cloudflare
VITE_CLOUDFLARE_PUBLIC_API_URL=<preview-worker-https-url>
```

7. Open the preview frontend path that loads public documents.
8. Confirm the network call goes to `<preview-worker-https-url>/api/public/documents`.
9. Confirm the response shape is `PublicDocumentListSnapshot`.
10. Confirm no UI behavior changes.

## Rollback

Rollback is frontend configuration only:

```bash
VITE_PUBLIC_API_PROVIDER=apps-script
```

or remove `VITE_PUBLIC_API_PROVIDER`.

The frontend then uses the existing Apps Script provider path. No Worker or D1 deletion is required to roll back the app.

## Intentionally Not Changed

- No production cutover.
- No production D1 database id.
- No real production data.
- No Google Drive URLs.
- No Apps Script changes.
- No `src/services/googleApi.ts` changes.
- No cache key or TTL changes.
- No UI or route changes.
- No public-home, content-list, content-detail, search, program-list, site-view, or visitor-stats switch.
- No admin/auth/media migration.
- No production Vercel env/config change.

## Verification Expectations

Required local verification for M5:

- `pnpm format:check`
- `pnpm lint:report`
- `pnpm lint:errors`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm build`
- `pnpm quality`
- `pnpm worker:typecheck`
- `pnpm worker:deploy:dry`

Preview remote migration, seed, deploy, Vercel env, and browser smoke are deferred until a real non-production preview D1 database and Worker URL are available.
