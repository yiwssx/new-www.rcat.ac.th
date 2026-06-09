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

## M3.1 Scope

M3.1 adds parity fixtures and assertions for the existing Apps Script public-document-list contract:

- `test/fixtures/publicDocuments/appsScriptSnapshot.sample.json` is a fake Apps Script-shaped `PublicDocumentListSnapshot`.
- `test/fixtures/publicDocuments/d1Rows.sample.json` is fake D1 `DocumentRow` data that maps exactly to the Apps Script-shaped fixture.
- `test/helpers/publicDocumentsParity.ts` validates exact top-level keys, exact item keys, ISO `generatedAt`, no snake_case D1 fields, no `status` or `sampleOnly`, and no forbidden production URLs.
- `test/publicDocumentsParity.test.ts` proves adapter output and Worker route output match the public contract while preserving missing-DB `503` and safe D1-error `500` behavior.

The fixtures are sanitized sample-only contract fixtures. They must not be replaced with committed live Apps Script captures unless every real URL and record is removed or converted to fake `example.test` values.

## M4 Preview Frontend Provider

M4 adds a frontend-only, preview-scoped provider switch for `public-document-list`. Local or preview frontend builds can set:

```bash
VITE_PUBLIC_API_PROVIDER=cloudflare
VITE_CLOUDFLARE_PUBLIC_API_URL=http://127.0.0.1:8787
```

The default remains Apps Script when the provider env is missing, empty, unknown, or explicitly set to `apps-script`. This Worker README does not define production frontend env, production D1 IDs, or a production cutover.

## M5 Non-Production D1 Preview

M5 adds a preview-only Worker environment placeholder and a sanitized fake preview seed path:

- `wrangler.toml` includes `[env.preview]` with `database_id = "preview-placeholder"`.
- `seed/public-documents.preview.seed.sql` inserts only fake `preview-*` public document rows.
- Preview seed URLs use `example.test` only.
- No real preview database id, production database id, production data, Google Drive URL, or secret is committed.

After a real non-production D1 preview database is created outside git, apply the existing migration and sanitized preview seed with Wrangler preview commands documented in `docs/architecture/m5-non-production-d1-preview-2026-05-27.md`.

## M6 Preview Smoke Status

M6 is the actual non-production Worker + D1 preview smoke checkpoint. The repository is still blocked from running the remote smoke because no real non-production D1 database id, HTTPS preview Worker URL, or Vercel preview URL has been provided in git or in the M6 request.

The checkpoint document is `docs/architecture/m6-preview-worker-d1-smoke-2026-05-27.md`.
The external provisioning checklist is `docs/architecture/m6-1-preview-resource-provisioning-2026-05-27.md`.

When external preview resources are available, run the preview migration, sanitized preview seed, preview Worker deploy, Vercel preview env configuration, and browser/network smoke from that document. Keep real preview identifiers and URLs outside git unless a separate preview-only provisioning change explicitly approves them.

## Intentionally Deferred

- Production D1 provisioning and real production database binding
- Applying migrations to production databases
- Real import scripts and real data imports
- Apps Script sync or import jobs
- Production frontend cutover
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

- M6 follow-up: run the actual non-production preview smoke after the M6.1 external resource checklist has a real non-production preview D1 database, HTTPS Worker URL, and Vercel preview URL available outside git.

Do not point production frontend traffic at this Worker until a separate production cutover phase is explicitly scoped.
