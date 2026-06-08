# RCAT Public API Worker

This directory contains the isolated Cloudflare Worker skeleton for a future public-read API. The current frontend and production backend still use Google Apps Script.

## M1 Scope

The skeleton proves Worker routing, JSON responses, GET-only CORS behavior, local execution, and dry-run deployment:

- `GET /health`
- `GET /api/health`
- `GET /api/public/documents`
- `OPTIONS` preflight handling

`GET /api/public/documents` intentionally returns HTTP `501`. It does not return fake CMS data or a `PublicDocumentListSnapshot`-shaped payload.

## M2 Scope

M2 adds a schema and seed-plan checkpoint without wiring D1 into runtime routes:

- `migrations/0001_public_read_schema.sql` defines the ordered public-read D1 schema.
- `src/db/schema.ts` defines Worker-local snake_case row interfaces.
- `src/db/documentsRepository.ts` is dormant and is not imported by the router.
- `src/db/healthRepository.ts` is dormant and only reports whether an optional `DB` binding exists.
- `seed/public-documents.sample.json` contains fake row-shaped sample data with `sampleOnly: true` and `example.test` URLs.
- `test/schemaContract.test.ts` verifies the schema, document row column contract, sample safety, and unchanged 501 route boundary.

The active D1 binding in `wrangler.toml` uses the local-only `local-placeholder` database ID. No real preview/production `database_id`, real import script, or production data is included.

## M2.1 Scope

M2.1 aligns the same `0001` schema checkpoint with the existing public and CMS TypeScript contracts before M3 route work:

- `contents` now uses compatibility-first fields such as `type`, `body_snapshot`, `tags_json`, `body_doc_id`, `featured_media_id`, `media_ids_json`, and `publish_at`.
- `media_assets` now mirrors metadata fields such as `type`, `size`, `drive_url`, `file_id`, `preview_url`, `embed_url`, and `thumbnail_url`.
- Settings tables use `settings_json` snapshots for phase 1 instead of early normalized columns.
- Route behavior remains unchanged; `GET /api/public/documents` still returns `501`.

## M2.2 Scope

M2.2 makes the compatibility-first schema executable in local development only:

- `wrangler.toml` includes a `DB` binding named `rcat-public-api-local` with `database_id = "local-placeholder"`.
- `seed/public-documents.seed.sql` repeatably deletes and inserts only `sample-%` rows in the `documents` table.
- Local D1 scripts apply the migration, seed fake public document rows, and inspect the local document order.
- `test/seedContract.test.ts` verifies seed safety, fake URLs, document-only writes, local-only config, and unchanged route behavior.

The binding is not a production database. Do not replace the placeholder with a real preview or production `database_id` until that environment is explicitly scoped.

## Intentionally Deferred

- Preview/production D1 provisioning and real database binding
- Applying migrations to preview or production databases
- Real public document queries or response-shape adapters
- Real import scripts and real data imports
- Apps Script sync or import jobs
- Frontend provider switching or cutover
- Admin writes, auth, users, media uploads, and Google Drive changes

The optional `DB` environment type still lets health checks run without real data. Apps Script remains the production provider and source of truth.

## Local Commands

```bash
pnpm worker:typecheck
pnpm worker:deploy:dry
pnpm worker:dev
pnpm worker:d1:migrate:local
pnpm worker:d1:seed:local
pnpm worker:d1:list:local
```

With the local Worker running:

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/api/health
curl -i http://127.0.0.1:8787/api/public/documents
curl -i -X OPTIONS http://127.0.0.1:8787/api/public/documents
```

To reset the local fake document snapshot:

```bash
pnpm worker:d1:migrate:local
pnpm worker:d1:seed:local
pnpm worker:d1:list:local
```

`GET /api/public/documents` still returns `501`; the local D1 data is not exposed through any route in M2.2.

## Next Phases

- M3: implement the first real public route, `public-document-list`, while preserving the existing Apps Script response shape.

No frontend cutover has happened. Apps Script remains the production provider and rollback path.
