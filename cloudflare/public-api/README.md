# RCAT Public API Worker

This directory contains the isolated Cloudflare Worker for the future public-read API. The current React frontend and production backend still use Google Apps Script.

## Current M3 Routes

| Method    | Route                   | Behavior                                                                                        |
| --------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `GET`     | `/health`               | Returns the Worker service health payload                                                       |
| `GET`     | `/api/health`           | Returns the Worker service health payload                                                       |
| `GET`     | `/api/public/documents` | Reads local D1 `documents` rows and returns the existing public document list snapshot contract |
| `OPTIONS` | Any path                | Returns HTTP `204` with GET-only CORS headers                                                   |

`GET /api/public/documents` requires the optional `DB` binding. If the binding is missing, it returns HTTP `503` with:

```json
{
  "error": "D1 DB binding is not configured",
  "resource": "public-document-list",
  "phase": "M3"
}
```

The route does not return fake fallback data when D1 is unavailable. Unexpected D1 failures return a safe HTTP `500` payload without stack traces or internal database details.

## Public Document Contract

The M3 route preserves the existing Apps Script public-document-list response shape:

```ts
interface PublicDocumentListSnapshot {
  items: PublicDocumentItem[];
  generatedAt: string;
}
```

Each item exposes only camelCase public fields: `id`, `title`, `description`, `category`, `fileUrl`, `fileName`, `mediaId`, `publishedAt`, `order`, `pinned`, and `updatedAt`.

Worker-local D1 rows stay snake_case inside `src/db/schema.ts` and `src/db/documentsRepository.ts`. `src/adapters/publicDocumentsAdapter.ts` maps rows back to the public response contract and intentionally omits D1-only fields such as `status`.

## M1 Scope

M1 proved Worker routing, JSON responses, GET-only CORS behavior, local execution, and dry-run deployment. At that checkpoint, `GET /api/public/documents` returned an explicit `501` skeleton response and did not resemble `PublicDocumentListSnapshot`.

## M2 Scope

M2 added the schema and local-only seed plan without exposing D1 through runtime routes:

- `migrations/0001_public_read_schema.sql` defines the ordered public-read D1 schema.
- `src/db/schema.ts` defines Worker-local snake_case row interfaces.
- `src/db/documentsRepository.ts` defines the explicit public document query.
- `src/db/healthRepository.ts` is dormant and only reports whether an optional `DB` binding exists.
- `seed/public-documents.sample.json` contains fake row-shaped sample data with `sampleOnly: true` and `example.test` URLs.
- `seed/public-documents.seed.sql` repeatably inserts only fake `sample-*` rows in local D1.
- Static tests verify schema, sample, seed, and local-only safety rules.

The active D1 binding in `wrangler.toml` uses the local-only `local-placeholder` database ID. No real preview or production `database_id`, real import script, or production data is included.

## M3 Scope

M3 wires only `GET /api/public/documents` to local D1:

- The route queries `documents` rows with explicit `DOCUMENT_ROW_COLUMNS`.
- SQL filters `status = "published"`.
- SQL order is `pinned DESC, sort_order ASC, published_at DESC, updated_at DESC`.
- The adapter converts snake_case D1 rows to the existing camelCase public API contract.
- Missing D1 binding returns HTTP `503` instead of fake data.
- D1 query failures return a safe HTTP `500`.

No other public route is implemented in M3.

## Intentionally Deferred

- Preview/production D1 provisioning and real database binding
- Applying migrations to preview or production databases
- Real import scripts and real data imports
- Apps Script sync or import jobs
- Frontend provider switching or cutover
- Public home, content list, content detail, search, site view, or visitor stats routes
- Admin writes, auth, users, media uploads, and Google Drive changes

Apps Script remains the production provider and source of truth. Google Drive remains file storage.

## Local Commands

```bash
pnpm worker:typecheck
pnpm worker:deploy:dry
pnpm worker:d1:migrate:local
pnpm worker:d1:seed:local
pnpm worker:d1:list:local
pnpm worker:dev
```

With the local Worker running:

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/api/health
curl -i http://127.0.0.1:8787/api/public/documents
curl -i -X OPTIONS http://127.0.0.1:8787/api/public/documents
```

After `pnpm worker:d1:migrate:local` and `pnpm worker:d1:seed:local`, `GET /api/public/documents` should return the fake local-only sample rows as a `PublicDocumentListSnapshot`. Without a configured `DB` binding, the route returns the M3 `503` payload shown above.

## Cutover And Rollback

No frontend cutover has happened. The React app still calls Apps Script through the existing provider path. This Worker can be disabled or ignored without changing current production behavior.

## Next Phases

- M3.1: add parity comparison fixtures against Apps Script sample output if needed.
- M4: design a preview-only provider switch after contract parity is proven.

Do not point the frontend at this Worker until a separate preview cutover phase is explicitly scoped.
