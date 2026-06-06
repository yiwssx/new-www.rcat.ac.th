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

The D1 binding block in `wrangler.toml` remains commented. No real `database_id`, schema application, seed script, import script, or production data is included.

## Intentionally Deferred

- D1 provisioning and real database binding
- Applying migrations to a local, preview, or production database
- Real public document queries or response-shape adapters
- Seed/import scripts and real data imports
- Apps Script sync or import jobs
- Frontend provider switching or cutover
- Admin writes, auth, users, media uploads, and Google Drive changes

The optional `DB` environment type lets health checks run without a database. Apps Script remains the production provider and source of truth.

## Local Commands

```bash
pnpm worker:typecheck
pnpm worker:deploy:dry
pnpm worker:dev
```

With the local Worker running:

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/api/health
curl -i http://127.0.0.1:8787/api/public/documents
curl -i -X OPTIONS http://127.0.0.1:8787/api/public/documents
```

## Next Phases

- M2.1: add local D1 provisioning and non-production seed tooling if that becomes the next readiness gap.
- M3: implement the first real public route, `public-document-list`, while preserving the existing Apps Script response shape.

No frontend cutover has happened. Apps Script remains the production provider and rollback path.
