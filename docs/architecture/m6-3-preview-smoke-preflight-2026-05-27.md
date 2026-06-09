# M6.3 Preview Smoke Preflight - 2026-05-27

Status: local safety automation only. M6 actual non-production preview smoke remains blocked until preflight reports `READY` and the external preview resources exist outside git.

## Purpose

M6.3 adds a local preflight checker for the future actual non-production Worker + D1 preview smoke. It verifies whether the required preview resource values are present and look safe enough to proceed to the next manual checkpoint.

The preflight does not apply D1 migrations, seed D1, deploy Workers, configure Vercel, open browsers, or cut over production traffic.

The only API path in scope remains `public-document-list`.

## Required Env Vars

Set these in the local shell before running the preflight:

```text
RCAT_PREVIEW_D1_DATABASE_NAME
RCAT_PREVIEW_D1_DATABASE_ID
RCAT_PREVIEW_WORKER_URL
RCAT_VERCEL_PREVIEW_URL
```

Keep real values outside git. Do not commit account ids, tokens, production identifiers, production URLs, or environment files.

## Safe Example

Use fake/example values for local command-shape checks only:

```powershell
$env:RCAT_PREVIEW_D1_DATABASE_NAME = "rcat-public-api-preview"
$env:RCAT_PREVIEW_D1_DATABASE_ID = "preview-d1-id-example"
$env:RCAT_PREVIEW_WORKER_URL = "https://preview-worker.example.test"
$env:RCAT_VERCEL_PREVIEW_URL = "https://preview-frontend.example.test"
pnpm worker:preview:preflight
```

The script redacts the D1 database id in output and prints only safe hostnames for URLs.

## READY And BLOCKED

`BLOCKED` means at least one required value is missing or unsafe. The script exits `0` so it can be used as a local gate without breaking ordinary quality runs when external resources have not been provisioned.

`READY` means all required values are present and pass local safety checks:

- D1 database name is not production-like.
- D1 database name includes a non-production marker such as `preview`, `staging`, `dev`, `test`, `uat`, `smoke`, or `sandbox`.
- D1 database id is not `preview-placeholder`.
- Worker URL is valid HTTPS.
- Vercel preview URL is valid HTTPS.
- URLs do not include forbidden production or file-storage domains.

`READY` is not permission to target production. It only means the M6.4 actual preview smoke can be started with the separately verified non-production resources.

## Command

```bash
pnpm worker:preview:preflight
```

This command runs only:

```bash
node cloudflare/public-api/scripts/preview-smoke-preflight.mjs
```

It does not execute remote Cloudflare, D1, Vercel, network, or browser commands.

## Next Step

After `READY`, proceed to M6.4 actual non-production preview smoke:

1. Apply the existing public-read migration to the confirmed preview D1 database.
2. Execute only the sanitized preview document seed.
3. Deploy only the preview Worker environment.
4. Configure only Vercel preview env values:

```bash
VITE_PUBLIC_API_PROVIDER=cloudflare
VITE_CLOUDFLARE_PUBLIC_API_URL=<preview-worker-https-url>
```

5. Verify the preview frontend calls the Worker `public-document-list` route and receives a `PublicDocumentListSnapshot`.

Do not switch production frontend traffic.

## Rollback

Rollback remains preview frontend env only:

```bash
VITE_PUBLIC_API_PROVIDER=apps-script
```

or remove `VITE_PUBLIC_API_PROVIDER`.

The default frontend provider remains Apps Script when the env is missing, empty, unknown, or explicitly set to `apps-script`.

## Production Safety Confirmation

- No production cutover.
- No production D1 id.
- No secrets or tokens.
- No real production data.
- No real file-storage URLs.
- No Apps Script changes.
- No `src/services/googleApi.ts` changes.
- No UI, route, cache key, or cache TTL changes.
- No production Vercel env or config changes.
- No Worker deploy or remote D1 command is run by the preflight.
- No endpoint switch beyond the existing explicit `public-document-list` preview path.
