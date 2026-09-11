# D1 Local Seed Plan

Updated: 2026-09-11.

This directory contains local-only D1 seed planning and fake seed fixtures. It does not import real data and must not change the canonical production D1.

Project-state note: the M2/M5/M20 migration narrative associated with some fixture names is historical. Current production ownership is Cloudflare Worker + D1 for structured public/admin data, with Apps Script retained only for the media/file bridge and Google Drive operations. Current project status is defined by `docs/architecture/post-p5h-current-project-state.md`.

Cloudflare currently has local development plus one canonical remote production role. There is no persistent remote Preview environment and the tracked `wrangler.toml` has no `[env.preview]` contract. Do not use old M5 preview commands as current operational instructions.

## Current Contents

- `public-documents.sample.json` is fake row-shaped data for contract and safety tests only.
- `public-documents.seed.sql` is a repeatable fake local D1 seed for the `documents` table only.
- `public-documents.preview.seed.sql` is a historical preview-era fake fixture retained for repository/test history; it is not a current remote deployment seed.
- `public-read-core.seed.sql` is a fake local/dev seed for broader public-read coverage.
- Every external URL uses `example.test`.
- The sample is marked with `sampleOnly: true`.

## Local Public Document Seed

`public-documents.seed.sql` is intentionally narrow:

- deletes only `documents` rows with IDs matching `sample-%`;
- inserts fake `sample-*` rows into `documents`;
- does not touch users, auth, admin, media upload, or other public-read tables;
- uses `example.test` URLs only;
- contains no production domain URLs, Apps Script endpoint URLs, or Google Drive file URLs.

Run it only against local D1:

```bash
pnpm worker:d1:migrate:local
pnpm worker:d1:seed:local
pnpm worker:d1:list:local
```

## Local Public Read Core Seed

`public-read-core.seed.sql` is intentionally fake and narrow:

- deletes only `sample-public-read-*` rows plus the documented fake visitor-stat sample days;
- inserts fake rows for home sections, public documents, content, programs, and visitor stats;
- uses `example.test` URLs only;
- contains no real school data, Apps Script URLs, Google Drive URLs, production records, users, auth records, or admin data;
- supports local verification of the public-read route contract without changing production behavior.

Apply it only to the local D1 after required migrations:

```bash
pnpm wrangler d1 migrations apply rcat-public-api-local --local --config cloudflare/public-api/wrangler.toml
pnpm wrangler d1 execute rcat-public-api-local --local --file cloudflare/public-api/seed/public-read-core.seed.sql --config cloudflare/public-api/wrangler.toml
```

## Historical Preview Fixture

`public-documents.preview.seed.sql` was created for the former M5 Preview verification strategy. It is retained as historical fake fixture data because migration/test history is append-only where practical.

Do not run it remotely with `--env preview`. The repository no longer defines a persistent Preview environment. If a new non-production remote environment is ever explicitly approved, its resource names, configuration, safety gates, and seed procedure require a new scoped design rather than reviving the old commands.

## Future Import Sources

Any future import work must be explicitly scoped and must keep production credentials and real private data out of these fixtures. Suitable local inputs may include:

- sanitized public document metadata exports;
- sanitized Google Drive metadata already exposed through approved interfaces;
- manually prepared local fixtures generated from non-production data.

No admin records, auth records, user accounts, private Drive links, or media-upload credentials belong in these samples.

## Mapping Target

The original mapping target is the `documents` table in `migrations/0001_public_read_schema.sql`:

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

Future import work should preserve the current public API response shape at the route boundary. These seed files remain fake local fixtures and must not be treated as a production data source.
