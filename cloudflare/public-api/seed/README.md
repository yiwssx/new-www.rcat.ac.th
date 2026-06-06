# M2 Local Seed Plan

This directory is a planning area for future local-only D1 seed and import work. M2 does not add a seed script, does not import real data, and does not change the production Apps Script source of truth.

## Current Contents

- `public-documents.sample.json` is fake row-shaped data for contract and safety tests only.
- Every external URL uses `example.test`.
- The sample is marked with `sampleOnly: true`.

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
