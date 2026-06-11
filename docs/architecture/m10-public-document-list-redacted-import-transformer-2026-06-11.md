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

## M10.1 Validator Hardening

M10.1 keeps this checkpoint local-only and fake-data-only while tightening the import validator before any future import pipeline work.

Allowed internal statuses are `published`, `draft`, and `inactive`. Invalid statuses fail validation and are not silently remapped. Public snapshots include only `published` rows; `draft` and `inactive` remain valid internal states but are excluded from public output.

Source records reject unknown fields outside `id`, `title`, `description`, `category`, `fileUrl`, `fileName`, `mediaId`, `publishedAt`, `order`, `pinned`, `updatedAt`, and `status`. D1 import rows reject unknown fields outside `id`, `title`, `description`, `category`, `file_url`, `file_name`, `media_id`, `published_at`, `sort_order`, `pinned`, `updated_at`, and `status`.

Required string fields must be non-empty. File URLs must be valid HTTPS URLs, must not use localhost, must not use forbidden production hosts, and must not include token-like query parameters such as `token`, `key`, `secret`, `signature`, `sig`, or `auth`.

File names must be non-empty, must not include path separators, traversal, or query strings, and must use a safe document-like extension: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, or `.txt`.

Media ids must be non-empty, must not be URL-like, must not include forbidden hosts, and must not contain D1 id-looking values.

`order` and `sort_order` must be finite non-negative integers. Source `pinned` accepts only booleans or `0` / `1`; D1 `pinned` accepts only `0` / `1`. Dates remain strict ISO strings where `new Date(value).toISOString() === value`.

Invalid source records fail before transformation with safe validation details that do not print full record contents. Invalid D1 rows fail before snapshot creation, so no partial public snapshot is emitted from invalid rows.

M10.1 does not run production import, migration, seed, deploy, Vercel environment changes, or cutover.

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
