# M3 Public Document List Route - 2026-05-27

> Historical record — checkpoint 2026-05-27 at commit `f76d8533a2c942dc08297e1050736321a95786e5`. Measurements and runtime statements below are preserved as historical evidence, not current state. Current source of truth: [M20 cleanup runtime ownership](./m20-cleanup-runtime-ownership.md).

Status: local Worker D1 route only. This checkpoint does not cut over the frontend or change production backend behavior.

## Purpose

M3 implements the first public-read Cloudflare Worker route, `GET /api/public/documents`, against the local D1 `documents` table. The route preserves the existing Apps Script public-document-list response contract so future preview cutover work can compare providers without changing the React app.

Apps Script remains the production provider and source of truth. Google Drive remains file storage.

## Files Changed

| File                                                            | Responsibility                                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `cloudflare/public-api/src/index.ts`                            | Awaits async routing before applying CORS and error handling                       |
| `cloudflare/public-api/src/router.ts`                           | Dispatches the document route with Worker `Env`                                    |
| `cloudflare/public-api/src/routes/publicDocuments.ts`           | Implements M3 D1 route, missing-DB 503, and safe DB-error 500                      |
| `cloudflare/public-api/src/db/documentsRepository.ts`           | Queries explicit document columns with stable public ordering                      |
| `cloudflare/public-api/src/contracts/publicDocuments.ts`        | Worker-local copy of the public document list response shape                       |
| `cloudflare/public-api/src/adapters/publicDocumentsAdapter.ts`  | Maps snake_case D1 rows to camelCase public response fields                        |
| `cloudflare/public-api/test/publicDocumentsRoute.test.ts`       | Covers D1 route success, empty rows, missing DB, DB failure, and data-shape safety |
| `cloudflare/public-api/test/documentsRepository.test.ts`        | Covers SQL column selection, filtering, ordering, and bindings                     |
| `cloudflare/public-api/test/publicApiSmoke.test.ts`             | Updates Worker smoke expectations for M3 route behavior                            |
| `cloudflare/public-api/test/schemaContract.test.ts`             | Keeps schema safety and missing-DB route boundary aligned                          |
| `cloudflare/public-api/test/seedContract.test.ts`               | Keeps fake seed safety and missing-DB route boundary aligned                       |
| `cloudflare/public-api/README.md`                               | Documents current M3 route behavior and deferred work                              |
| `docs/architecture/m3-public-document-list-route-2026-05-27.md` | This architecture checkpoint                                                       |

`cloudflare/public-api/src/index.ts` changed only to await the now-async Worker router. It does not change frontend, Apps Script, Vercel, or production provider behavior.

## Route Behavior

| Method    | Route                   | M3 behavior                             |
| --------- | ----------------------- | --------------------------------------- |
| `GET`     | `/health`               | Existing Worker health payload          |
| `GET`     | `/api/health`           | Existing Worker health payload          |
| `GET`     | `/api/public/documents` | D1-backed public-document-list snapshot |
| `OPTIONS` | Any path                | HTTP `204` with GET-only CORS headers   |

If `DB` is not configured, `GET /api/public/documents` returns HTTP `503`:

```json
{
  "error": "D1 DB binding is not configured",
  "resource": "public-document-list",
  "phase": "M3"
}
```

This prevents accidental fake fallback data. Unexpected D1 failures return HTTP `500`:

```json
{
  "error": "Unable to load public-document-list",
  "resource": "public-document-list",
  "phase": "M3"
}
```

No stack trace, SQL internals, or D1 error text is returned to callers.

## Public Response Contract

The route returns the existing public document list snapshot shape:

```ts
interface PublicDocumentListSnapshot {
  items: PublicDocumentItem[];
  generatedAt: string;
}

interface PublicDocumentItem {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName: string;
  mediaId: string;
  publishedAt: string;
  order: number;
  pinned: boolean;
  updatedAt: string;
}
```

The Worker adapter maps:

- `file_url` to `fileUrl`
- `file_name` to `fileName`
- `media_id` to `mediaId`
- `published_at` to `publishedAt`
- `sort_order` to `order`
- `pinned` integer to `pinned` boolean
- `updated_at` to `updatedAt`

D1-only fields such as `status` are not exposed.

## D1 Query Boundary

`documentsRepository` selects only `DOCUMENT_ROW_COLUMNS`; it does not use `SELECT *`.

The route queries:

- `FROM documents`
- `WHERE status = ?` with binding `"published"`
- `ORDER BY pinned DESC, sort_order ASC, published_at DESC, updated_at DESC`

The local fake seed still uses only `sample-*` records and `example.test` URLs. No real production data, Google Drive URLs, Apps Script URLs, school records, auth data, admin data, or media upload data is imported.

## Production Impact

- Frontend provider remains Apps Script.
- `src/services/googleApi.ts` remains unchanged.
- Apps Script remains unchanged.
- Vercel and production environment configuration remain unchanged.
- No production D1 `database_id` is added.
- No real D1 data, schema rollout, import script, or seed script is added.
- No public-home, content-list, content-detail, search, site-view, visitor-stats, admin, auth, media, UI, route, or cache behavior is changed.

## Verification

Completed on 2026-06-08:

- `pnpm format:check` passed.
- `pnpm lint:report` passed.
- `pnpm lint:errors` passed.
- `pnpm test:unit` passed: 38 test files, 296 tests.
- `pnpm test:integration` passed: 2 test files, 10 tests.
- `pnpm build` passed: sitemap generation plus Vite production build completed.
- `pnpm quality` passed: format, lint, unit tests, integration tests, and build.
- `pnpm worker:typecheck` passed.
- `pnpm worker:deploy:dry` passed with the local `env.DB` D1 binding and no production deploy.
- `pnpm worker:d1:migrate:local` passed: `0001_public_read_schema.sql` applied locally.
- `pnpm worker:d1:seed:local` passed: fake local-only document seed executed.
- `pnpm worker:d1:list:local` passed: returned `sample-public-document-001` and `sample-public-document-002`.

Manual local Worker smoke with `pnpm worker:dev` on `127.0.0.1:8787`:

- `GET /health` returned HTTP `200` with `ok: true`.
- `GET /api/health` returned HTTP `200` with `ok: true`.
- `GET /api/public/documents` returned HTTP `200` with `sample-public-document-001` and `sample-public-document-002` as a `PublicDocumentListSnapshot`.
- `OPTIONS /api/public/documents` returned HTTP `204` with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, OPTIONS`, and `Access-Control-Allow-Headers: Content-Type`.

Unit tests also cover the missing-DB boundary: without `env.DB`, `GET /api/public/documents` returns the explicit M3 HTTP `503` payload instead of fake data.

## Next Recommended Step

Proceed to M3.1 parity fixtures or an M4 preview-only provider-switch design only after local D1 route behavior and Apps Script response parity are proven. Do not point the frontend to this Worker in M3.
