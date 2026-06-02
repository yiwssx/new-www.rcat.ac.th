# RCAT Public API Worker

This directory contains the isolated M1 Cloudflare Worker skeleton for a future public-read API. The current frontend and production backend still use Google Apps Script.

## M1 Scope

The skeleton proves Worker routing, JSON responses, GET-only CORS behavior, local execution, and dry-run deployment:

- `GET /health`
- `GET /api/health`
- `GET /api/public/documents`
- `OPTIONS` preflight handling

`GET /api/public/documents` intentionally returns HTTP `501`. It does not return fake CMS data or a `PublicDocumentListSnapshot`-shaped payload.

## Intentionally Deferred

- D1 provisioning, binding, schema, migrations, and seed data
- Real public document queries
- Apps Script sync or import jobs
- Frontend provider switching or cutover
- Admin writes, auth, users, media uploads, and Google Drive changes

The commented D1 block in `wrangler.toml` is only a placeholder for the M2 schema phase. The optional `DB` environment type lets health checks run without a database.

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

- M2: define the D1 schema and local-only seed/import approach when explicitly scoped.
- M3: implement the first real public route, `public-document-list`, while preserving the existing Apps Script response shape.

No frontend cutover has happened. Apps Script remains the production provider and rollback path.
