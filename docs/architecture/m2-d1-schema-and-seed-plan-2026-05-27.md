# M2 D1 Schema And Seed Plan - 2026-05-27

Status: schema and local seed plan only. This checkpoint does not change frontend or production backend behavior.

## Purpose

M2 prepares the isolated Cloudflare public API Worker for a future public-read D1 backend. It adds the first ordered SQL migration, Worker-local row contracts, dormant repositories, fake local sample data, and static safety tests without routing live requests to D1.

## Files Added

| File                                                           | Responsibility                                      |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `cloudflare/public-api/migrations/0001_public_read_schema.sql` | Ordered schema-only D1 migration                    |
| `cloudflare/public-api/src/db/schema.ts`                       | Worker-local snake_case D1 row interfaces           |
| `cloudflare/public-api/src/db/documentsRepository.ts`          | Dormant public document row repository              |
| `cloudflare/public-api/src/db/healthRepository.ts`             | Dormant DB binding status helper                    |
| `cloudflare/public-api/seed/README.md`                         | Local-only seed/import plan                         |
| `cloudflare/public-api/seed/public-documents.sample.json`      | Fake sample rows marked `sampleOnly: true`          |
| `cloudflare/public-api/test/schemaContract.test.ts`            | Static migration, contract, sample, and route tests |
| `docs/architecture/m2-d1-schema-and-seed-plan-2026-05-27.md`   | This architecture checkpoint                        |

`cloudflare/public-api/README.md` and `cloudflare/public-api/wrangler.toml` were updated to describe the M2 boundary and deferred D1 binding.

## Schema Scope

The migration defines public-read tables for:

- public documents, content, media metadata, site settings, homepage settings, display settings, menus, carousel slides, external services, and public events
- visitor and content-view event/stat rollups
- sync run tracking for future Apps Script to D1 import work

The migration is intentionally schema-only. It contains no `INSERT` statements, no real school data, no production D1 database ID, and no seed/import execution path.

## Document Contract

`DOCUMENT_ROW_COLUMNS` statically defines the selected columns for the future `public-document-list` repository:

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

The contract test verifies these columns match the `documents` migration table. This keeps the first M3 query explicit before any response-shape adapter is implemented.

## Route Boundary

`GET /api/public/documents` still returns HTTP `501` with the M1 not-implemented payload. The dormant `documentsRepository` is not imported by the router, and D1 is not queried by any Worker route in M2.

This is deliberate: M2 validates schema shape and safety rails, while M3 can implement `public-document-list` with the existing public response shape when that work is ready.

## Sample Safety

`seed/public-documents.sample.json` is fake, local-only, and marked `sampleOnly: true`. It uses `example.test` URLs and row-shaped snake_case keys. It is not a `PublicDocumentListSnapshot`, not production data, and not a seed script.

## Production Impact

- Frontend provider remains Apps Script.
- `src/services/googleApi.ts` remains unchanged.
- Apps Script remains the production source of truth.
- Google Drive remains file storage.
- No admin writes, auth/users, media uploads, UI routes, cache behavior, Vercel production config, or production environment variables changed.

## Next Recommended Step

Proceed to either:

- M2.1 local D1 provisioning and non-production seed tooling, if local database execution is the next readiness gap.
- M3 `public-document-list` implementation, if the response-shape adapter and comparison tests are ready.

Any M3 route implementation must preserve the current public API response contract before a preview provider switch is considered.
