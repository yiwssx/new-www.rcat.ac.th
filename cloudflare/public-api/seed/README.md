# M2 Local Seed Plan

This directory contains local-only D1 seed planning and fake seed fixtures. It does not import real data and does not change the production Apps Script source of truth.

## Current Contents

- `public-documents.sample.json` is fake row-shaped data for contract and safety tests only.
- `public-documents.seed.sql` is a repeatable fake local D1 seed for the `documents` table only.
- `public-documents.preview.seed.sql` is a repeatable fake preview-only D1 seed for non-production Worker smoke tests.
- `public-read-core.seed.sql` is a fake local/dev seed for the M17-B public read route batch.
- Every external URL uses `example.test`.
- The sample is marked with `sampleOnly: true`.

## M2.2 Fake Seed Strategy

`public-documents.seed.sql` is intentionally narrow:

- deletes only `documents` rows with IDs matching `sample-%`
- inserts fake `sample-*` rows into `documents`
- does not touch users, auth, admin, media upload, or other public-read tables
- uses `example.test` URLs only
- contains no production domain URLs, Apps Script endpoint URLs, or Google Drive file URLs

Run it after applying the local migration:

```bash
pnpm worker:d1:migrate:local
pnpm worker:d1:seed:local
pnpm worker:d1:list:local
```

The seed is for local D1 development and M3 preparation only. M17-B routes use the later `public-read-core.seed.sql` for broader local/dev coverage.

## M17-B Public Read Core Seed

`public-read-core.seed.sql` is intentionally fake and narrow:

- deletes only `sample-public-read-*` rows plus two fake visitor-stat sample days
- inserts fake rows for home sections, public documents, content, programs, and visitor stats
- uses `example.test` URLs only
- contains no real school data, Apps Script URLs, Google Drive URLs, production records, users, auth records, or admin data
- supports local/dev verification of the M17-B public read route batch without changing production behavior

Apply it only after the additive M17-B migration:

```bash
pnpm wrangler d1 migrations apply <local-d1-database-name> --local --config cloudflare/public-api/wrangler.toml
pnpm wrangler d1 execute <local-d1-database-name> --local --file cloudflare/public-api/seed/public-read-core.seed.sql --config cloudflare/public-api/wrangler.toml
```

## M5 Fake Preview Seed Strategy

`public-documents.preview.seed.sql` is intentionally separate from the local seed:

- deletes only `documents` rows with IDs matching `preview-%`
- inserts fake `preview-*` rows into `documents`
- uses `example.test` URLs only
- contains no real school data, Apps Script URLs, Google Drive URLs, or production records
- is intended only for a separately provisioned non-production D1 preview database

When a real preview D1 database is explicitly provisioned outside git, apply the existing migration and preview seed with Wrangler using the preview environment:

```bash
pnpm wrangler d1 migrations apply <preview-d1-database-name> --remote --env preview --config cloudflare/public-api/wrangler.toml
pnpm wrangler d1 execute <preview-d1-database-name> --remote --env preview --file cloudflare/public-api/seed/public-documents.preview.seed.sql --config cloudflare/public-api/wrangler.toml
```

Do not add package scripts for remote preview operations until a real preview database name, account, and deployment workflow are explicitly scoped.

## Future Import Sources

When M3/M4 work is explicitly scoped, the first import should focus on `public-document-list` rows:

- Apps Script public document metadata response
- Google Drive file metadata already exposed through Apps Script
- Manual local fixture exports generated from non-production data

No admin records, auth records, user accounts, private Drive links, or media upload workflows should enter these samples.

## Mapping Target

The first mapping target is the `documents` table in `migrations/0001_public_read_schema.sql`:

- `id`
- `title`
- `description`
- `category`
- `file_url`
- `file_name`
- `media_id`
- `published_at`
- `status`
- `sort_order`
- `pinned`
- `updated_at`

Future import work should preserve the current public API response shape at the route boundary, but this sample is intentionally not a `PublicDocumentListSnapshot`.

D1 public data remains a snapshot until a separate admin-write migration exists. Apps Script remains the production source of truth.
