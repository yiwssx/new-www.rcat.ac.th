# M2 D1 Schema And Seed Plan - 2026-05-27

> Historical note, 2026-07-04: This checkpoint describes an early D1 planning state and is not the current runtime source of truth. Current runtime ownership has advanced: structured public/admin data uses Cloudflare Worker + D1, Apps Script is retained only for the Vercel-proxied Google Drive media/file bridge, cleanup is completed, preview field verification is in progress, and M20 production cutover remains gated.

Status: schema, local D1 provisioning, and fake local seed tooling only. This checkpoint does not change frontend or production backend behavior.

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
| `cloudflare/public-api/seed/public-documents.seed.sql`         | Repeatable fake local D1 document seed              |
| `cloudflare/public-api/test/schemaContract.test.ts`            | Static migration, contract, sample, and route tests |
| `cloudflare/public-api/test/seedContract.test.ts`              | Static M2.2 seed safety and local tooling tests     |
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

## M2.1 Schema Alignment

M2.1 revises `cloudflare/public-api/migrations/0001_public_read_schema.sql` instead of adding `0002` because no real local, preview, or production D1 database is configured in `wrangler.toml`, and there is no evidence that M2 was applied to a tracked D1 database. The schema is still a planning checkpoint, not an applied production migration.

The alignment is compatibility-first:

- `contents` now maps directly toward `ContentItem` fields with `type`, `body_snapshot`, `category`, `tags_json`, `seo_title`, `seo_description`, `canonical_url`, `body_doc_id`, `body_doc_url`, `featured_media_id`, `media_ids_json`, `view_count`, `last_viewed_at`, and `publish_at`.
- `media_assets` now maps toward `MediaAsset` fields with `type`, `size`, `owner`, `drive_url`, `file_id`, `mime_type`, `preview_url`, `embed_url`, `thumbnail_url`, and `updated_at`.
- `menu_items`, `carousel_slides`, `external_services`, and `events` use names that are closer to the current public contracts.
- visitor and content-view tables use `created_at`, `day`, `total_views`, `online_users`, and `slug` fields that better fit the current public-home and view-count semantics.
- `sync_runs` now carries row counts and `metadata_json` for future import observability.

`site_settings`, `homepage_settings`, and `display_settings` use `settings_json` in phase 1. This preserves the current `SiteSettings`, `HomepageSettings`, and `DisplaySettings` shapes without forcing an early normalization redesign before public route adapters exist.

M2.1 still does not implement real routes. M3 remains responsible for querying D1, adapting rows back to the existing Apps Script-compatible response shapes, and proving `public-document-list` before any provider switch.

## M2.2 Local D1 Provisioning

M2.2 adds a local-only D1 execution path without creating a production database:

- `cloudflare/public-api/wrangler.toml` now declares `binding = "DB"`, `database_name = "rcat-public-api-local"`, and `database_id = "local-placeholder"`.
- The placeholder database ID is intentionally not a real Cloudflare D1 ID and must not be replaced with preview or production credentials until that environment is explicitly scoped.
- `pnpm worker:d1:migrate:local` applies `0001_public_read_schema.sql` to the local Wrangler D1 store.
- `pnpm worker:d1:seed:local` runs `seed/public-documents.seed.sql`.
- `pnpm worker:d1:list:local` inspects local fake document rows in the future public order.

The fake seed tooling is documents-only. It deletes `sample-%` rows from `documents`, inserts fake `sample-*` rows, uses `example.test` URLs, and contains no real school data, Apps Script URLs, Google Drive URLs, private records, auth data, admin data, or media upload data.

`GET /api/public/documents` remains an explicit `501` skeleton response. The dormant repository is still not imported by the router, and no Worker route queries D1 in M2.2.

## Route Boundary

`GET /api/public/documents` still returns HTTP `501` with the M1 not-implemented payload. The dormant `documentsRepository` is not imported by the router, and D1 is not queried by any Worker route in M2.2.

This is deliberate: M2 validates schema shape and safety rails, while M3 can implement `public-document-list` with the existing public response shape when that work is ready.

## Sample Safety

`seed/public-documents.sample.json` is fake, local-only, and marked `sampleOnly: true`. It uses `example.test` URLs and row-shaped snake_case keys. It is not a `PublicDocumentListSnapshot` and not production data.

`seed/public-documents.seed.sql` is also fake and local-only. It exists to prove the M2.1 schema can be applied and populated locally before M3 route work.

## Production Impact

- Frontend provider remains Apps Script.
- `src/services/googleApi.ts` remains unchanged.
- Apps Script remains the production source of truth.
- Google Drive remains file storage.
- No admin writes, auth/users, media uploads, UI routes, cache behavior, Vercel production config, or production environment variables changed.

## Next Recommended Step

After M2.2, proceed to M3 `public-document-list` implementation if the local migration and seed commands pass and the response-shape adapter/comparison tests are ready.

Any M3 route implementation must preserve the current public API response contract before a preview provider switch is considered.
