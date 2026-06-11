# M10 Public Document List Redacted Import Transformer - 2026-06-11

Status: redacted transformer and contract validator only. No production import or cutover is executed.

## Purpose

M10 validates transformation and contract parity for `public-document-list` using fake data only.

This checkpoint prepares local-only import shaping logic for a future approved production import. It does not fetch production data, mutate D1, deploy a Worker, set Vercel environment variables, or change the frontend provider.

## Data Safety

- Uses a fake fixture only.
- Commits no real production data.
- Commits no real file storage URLs.
- Commits no D1 ids, secrets, account ids, or tokens.
- Performs no Apps Script fetch.
- Performs no network calls.
- Runs no production write command.

The fixture lives at `cloudflare/public-api/test/fixtures/public-documents.import-source.redacted.json` and uses only `example.test` / `example.invalid` style file origins.

## Transformation Model

The local model is:

1. Source camelCase record.
2. D1 snake_case row.
3. Public snapshot camelCase response.

Source fields mirror the public document contract: `id`, `title`, `description`, `category`, `fileUrl`, `fileName`, `mediaId`, `publishedAt`, `order`, `pinned`, `updatedAt`, and internal `status`.

D1 import rows use `file_url`, `file_name`, `media_id`, `published_at`, `sort_order`, `pinned`, `updated_at`, and `status`.

`sort_order` maps to public `order`. `status` remains internal and is never included in the public snapshot.

## Validation Model

The validator checks:

- Required `id`.
- Required `title`.
- ISO `publishedAt` / `published_at`.
- ISO `updatedAt` / `updated_at`.
- Numeric `order` / `sort_order`.
- Boolean-compatible `pinned`.
- Forbidden URL hosts.
- D1 id-looking values.
- Sorting parity.
- Field leakage from internal or snake_case fields.

Only records with active internal status are included in the public snapshot. Draft or inactive records remain excluded.

## Contract Parity

The output must match `PublicDocumentListSnapshot`.

Top-level fields are only `items` and `generatedAt`. Public items contain only camelCase fields and must not expose `status`, `file_url`, `file_name`, `media_id`, `published_at`, `sort_order`, or `updated_at`.

Ordering is pinned first, then `sort_order` ascending, then `published_at` descending, then `updated_at` descending.

## No-Go Conditions

Any condition below blocks future production import work:

- Real production data in the fixture.
- Real Google Drive URL in the fixture or docs.
- D1 id, secret, account id, or token committed.
- Apps Script change.
- `src/services/googleApi.ts` change.
- UI, route, cache key, or cache TTL change.
- Network call in import tooling.
- Production import, migration, deploy, or seed command.
- Endpoint beyond `public-document-list`.
- Internal or snake_case field leakage in public output.

## Production Safety Confirmation

M10 does not:

- Run production import.
- Run production migration.
- Deploy production Worker.
- Set production environment variables.
- Cut over production.
- Commit real data.
- Fetch Apps Script, Sheets, or Drive data.
- Change Apps Script.
- Change `src/services/googleApi.ts`.
- Change UI, routes, cache keys, or cache TTL.

Apps Script remains the production source of truth and the default frontend provider. Cloudflare remains explicit env-only and scoped to `public-document-list`.
