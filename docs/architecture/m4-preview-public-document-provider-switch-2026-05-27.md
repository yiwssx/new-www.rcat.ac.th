# M4 Preview Public Document Provider Switch - 2026-05-27

Status: preview-only provider switch for `public-document-list`.

## Purpose

M4 allows local and preview frontend builds to read the public document list from the Cloudflare Worker public API while keeping Apps Script as the default provider. This phase does not cut over production and does not change the Apps Script backend.

The switch is intentionally scoped to `public-document-list` only. Public home, content lists, content detail, search, program lists, site views, visitor stats, admin writes, auth/users, media uploads, routes, and UI remain on the existing runtime paths.

## Files Added Or Changed

| File                                             | Responsibility                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `src/config/publicApiProvider.ts`                | Resolves `VITE_PUBLIC_API_PROVIDER`, normalizes the Worker base URL, and builds Worker public API URLs         |
| `src/vite-env.d.ts`                              | Adds Vite env typing for the preview provider variables                                                        |
| `src/features/public-documents/contract.ts`      | Validates `PublicDocumentListSnapshot` responses before frontend use                                           |
| `src/features/public-documents/cloudflareApi.ts` | Fetches `GET /api/public/documents` from the configured Worker URL                                             |
| `src/features/public-documents/api.ts`           | Preserves `getPublicDocumentList()` while selecting Apps Script or Cloudflare                                  |
| `src/features/public-documents/*.test.ts`        | Covers provider resolution, Cloudflare fetch behavior, contract validation, API switching, and cache constants |
| `cloudflare/public-api/README.md`                | Notes that M4 can point preview frontend builds at the Worker                                                  |

## Provider Configuration

The provider is controlled by Vite env variables:

```bash
VITE_PUBLIC_API_PROVIDER=apps-script|cloudflare
VITE_CLOUDFLARE_PUBLIC_API_URL=http://127.0.0.1:8787
```

Rules:

- Missing, empty, or unknown `VITE_PUBLIC_API_PROVIDER` resolves to `apps-script`.
- `apps-script` does not require `VITE_CLOUDFLARE_PUBLIC_API_URL`.
- `cloudflare` requires `VITE_CLOUDFLARE_PUBLIC_API_URL`.
- The Worker base URL is trimmed and trailing slashes are removed before joining `/api/public/documents`.
- No production Cloudflare URL, secret, or production D1 ID is committed.

## Runtime Flow

Existing consumers still call:

```ts
getPublicDocumentList(): Promise<PublicDocumentListSnapshot>
```

When the provider is `apps-script`, M4 calls the existing `getPublicDocumentList` function from `src/services/googleApi.ts`.

When the provider is `cloudflare`, M4 calls:

```txt
GET {VITE_CLOUDFLARE_PUBLIC_API_URL}/api/public/documents
```

The Cloudflare path does not silently fall back to Apps Script. A missing Worker URL, non-2xx Worker response, invalid JSON response, or invalid response shape throws a public-document-list provider error so preview misconfiguration is visible.

## Response Validation

`src/features/public-documents/contract.ts` validates the Worker response before returning it to existing consumers.

The accepted contract is exactly:

```ts
interface PublicDocumentListSnapshot {
  items: PublicDocumentItem[];
  generatedAt: string;
}
```

Each item must expose only:

```txt
id, title, description, category, fileUrl, fileName, mediaId, publishedAt, order, pinned, updatedAt
```

The validator rejects obvious D1/internal fields such as `file_url`, `file_name`, `media_id`, `published_at`, `sort_order`, `updated_at`, and `status`. A raw D1 row shape is not accepted by the frontend.

## Cache Preservation

The public document cache is unchanged:

- key: `rcat.cms.public.document-list`
- TTL: `15 * 60 * 1000`

M4 does not change stale/cache semantics. The cache continues to store `PublicDocumentListSnapshot`.

## Manual Preview Smoke

Local Cloudflare preview smoke:

1. `pnpm worker:d1:migrate:local`
2. `pnpm worker:d1:seed:local`
3. `pnpm worker:d1:list:local`
4. `pnpm worker:dev`
5. Start the frontend locally with:

```bash
VITE_PUBLIC_API_PROVIDER=cloudflare
VITE_CLOUDFLARE_PUBLIC_API_URL=http://127.0.0.1:8787
pnpm dev
```

6. Open the public documents caller path, or the nearest page that loads the public document list cache.
7. Confirm the frontend calls `http://127.0.0.1:8787/api/public/documents`.
8. Confirm the response is a `PublicDocumentListSnapshot` and UI behavior is unchanged.
9. Remove `VITE_PUBLIC_API_PROVIDER` or set `VITE_PUBLIC_API_PROVIDER=apps-script` and confirm the Apps Script path is used again.

If no dedicated public documents page is available in the current routing surface, the unit-level smoke is the provider switch test in `src/features/public-documents/apiProviderSwitch.test.ts`.

## Rollback

Rollback is configuration-only:

```bash
VITE_PUBLIC_API_PROVIDER=apps-script
```

or remove `VITE_PUBLIC_API_PROVIDER` entirely. The default provider remains Apps Script.

## Intentionally Not Changed

- No production cutover.
- No `src/services/googleApi.ts` implementation change.
- No Apps Script change.
- No Vercel production config or production env change.
- No real production D1 `database_id`.
- No real production data.
- No public cache key or TTL change.
- No public home, content list, content detail, search, program list, site-view, or visitor-stats switch.
- No admin/auth/media/provider-wide migration.
- No UI or route change.

## Next Recommended Step

M5 should be a controlled preview environment exercise: provision a non-production D1 binding, import sanitized preview data through an explicitly scoped path, and run browser/network smoke against the preview provider before any production cutover discussion.
