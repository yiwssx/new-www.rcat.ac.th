# M3.1 Public Document List Parity - 2026-05-27

Status: parity fixtures and contract tests only. This checkpoint does not cut over the frontend or change production backend behavior.

## Purpose

M3.1 proves that the Cloudflare Worker `GET /api/public/documents` route preserves the existing Apps Script `public-document-list` response contract before any provider switch is designed.

Apps Script remains the production provider and source of truth. Google Drive remains file storage.

## Contract Sources Inspected

- `src/features/public-documents/types.ts`
- `src/features/public-documents/api.ts`
- `src/features/public-documents/publicDocumentListCache.ts`
- `src/services/googleApi.ts`
- `apps-script/Cms.Documents.gs`
- `apps-script/Code.gs`
- `cloudflare/public-api/src/contracts/publicDocuments.ts`
- `cloudflare/public-api/src/adapters/publicDocumentsAdapter.ts`
- `cloudflare/public-api/src/routes/publicDocuments.ts`
- `cloudflare/public-api/src/db/documentsRepository.ts`

The current public response contract is:

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

`src/features/public-documents/api.ts` re-exports `getPublicDocumentList` from `src/services/googleApi.ts`. `getPublicDocumentList()` calls the Apps Script `publicDocumentList` resource as a cache-friendly public GET. The public cache key remains `rcat.cms.public.document-list` and the TTL remains `15 * 60 * 1000`.

Apps Script builds the snapshot as `{ items: getPublicDocuments(), generatedAt: new Date().toISOString() }`. Public documents are published records with title and file URL, sorted by pinned first, then order ascending, then published date descending, and sanitized to the public item fields listed above.

## Files Added

| File                                                                                 | Responsibility                                                             |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `cloudflare/public-api/test/fixtures/publicDocuments/appsScriptSnapshot.sample.json` | Fake Apps Script-shaped public-document-list snapshot fixture              |
| `cloudflare/public-api/test/fixtures/publicDocuments/d1Rows.sample.json`             | Fake D1 `DocumentRow` fixture that maps exactly to the Apps Script fixture |
| `cloudflare/public-api/test/fixtures/publicDocuments/README.md`                      | Manual comparison guidance and sanitization warning                        |
| `cloudflare/public-api/test/helpers/publicDocumentsParity.ts`                        | Reusable parity, shape, internal-field, and forbidden-URL assertions       |
| `cloudflare/public-api/test/publicDocumentsParity.test.ts`                           | M3.1 adapter and Worker route parity tests                                 |
| `docs/architecture/m3-1-public-document-list-parity-2026-05-27.md`                   | This architecture checkpoint                                               |

`cloudflare/public-api/README.md` was updated to describe M3.1. No runtime source files changed.

## Fixture Strategy

`appsScriptSnapshot.sample.json` is shaped exactly like `PublicDocumentListSnapshot`:

- top-level keys are `items` and `generatedAt`
- item keys are the public camelCase contract keys only
- it contains one pinned item and one non-pinned item
- it uses a stable `generatedAt`
- it uses only fake `example.test` URLs
- it does not contain `sampleOnly`, real school data, Apps Script URLs, or Google Drive URLs

`d1Rows.sample.json` is Worker-local D1 row data:

- rows use snake_case `DocumentRow` fields
- rows include internal `status`
- rows include only published records for direct parity
- rows map exactly to `appsScriptSnapshot.sample.json` after adaptation
- rows use only fake `example.test` URLs

The fixtures are sample-only contract fixtures. Unit tests do not call live Apps Script.

## Parity Assertions

`test/helpers/publicDocumentsParity.ts` verifies:

- exact top-level keys: `items`, `generatedAt`
- exact item keys: `id`, `title`, `description`, `category`, `fileUrl`, `fileName`, `mediaId`, `publishedAt`, `order`, `pinned`, `updatedAt`
- `generatedAt` is an ISO string
- no snake_case D1 fields leak: `file_url`, `file_name`, `media_id`, `published_at`, `sort_order`, `updated_at`
- no internal fields leak: `status`, `sampleOnly`
- no forbidden production URLs appear: `rcat.ac.th`, `script.google.com`, `drive.google.com`

## What M3.1 Verifies

- Adapter output equals the Apps Script-shaped fixture with deterministic `generatedAt`.
- Worker route output has the same public item data as the Apps Script-shaped fixture.
- Dynamic Worker `generatedAt` remains an ISO string.
- Empty list still returns a valid `PublicDocumentListSnapshot`.
- Missing DB still returns HTTP `503` and is not treated as a parity response.
- D1 query failure still returns safe HTTP `500` and is not treated as a parity response.

## Intentionally Not Done

- No frontend provider switch.
- No React runtime behavior change.
- No `src/services/googleApi.ts` change.
- No Apps Script behavior or deployment change.
- No public cache key or TTL change.
- No public-home, content-list, content-detail, search, site-view, or visitor-stats route.
- No admin writes, auth/users, media uploads, UI, route, or cache behavior change.
- No production Worker deploy.
- No real production D1 `database_id`.
- No real production data or Google Drive links.

## Verification

Completed on 2026-06-08:

- `pnpm format:check` passed.
- `pnpm lint:report` passed.
- `pnpm lint:errors` passed.
- `pnpm test:unit` passed: 39 test files, 305 tests.
- `pnpm test:integration` passed: 2 test files, 10 tests.
- `pnpm build` passed: sitemap generation plus Vite production build completed.
- `pnpm quality` passed: format, lint, unit tests, integration tests, and build.
- `pnpm worker:typecheck` passed.
- `pnpm worker:d1:migrate:local` executed the local migration successfully in sandboxed mode, but Wrangler could not write its debug log outside the workspace.
- `pnpm worker:d1:seed:local` executed the fake local-only seed successfully in sandboxed mode, but Wrangler could not write its debug log outside the workspace.
- `pnpm worker:d1:list:local` returned `sample-public-document-001` and `sample-public-document-002` in sandboxed mode, but Wrangler could not write its debug log outside the workspace.

Follow-up rerun completed manually after Codex sandbox/usage-limit block:

- pnpm worker:deploy:dry passed.
- pnpm worker:dev started successfully.
- GET /health returned HTTP 200 with ok: true.
- GET /api/health returned HTTP 200 with ok: true.
- GET /api/public/documents returned HTTP 200 with PublicDocumentListSnapshot shape.
- OPTIONS /api/public/documents returned HTTP 204 with CORS headers.

M3.1 is now closed as preview-readiness parity checkpoint.

## Next Recommended Step

M4 should be a preview-only provider switch design, and only after parity tests pass, local D1 route smoke passes, and no forbidden URLs or shape drift are detected. Do not implement M4 in M3.1.
