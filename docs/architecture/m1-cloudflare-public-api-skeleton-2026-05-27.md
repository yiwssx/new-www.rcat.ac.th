# M1 Cloudflare Public API Skeleton - 2026-05-27

> Historical record — checkpoint 2026-05-27 at commit `3d956c8e54b8ccd1ffdd4fdedd5eed223f5a574f`. Measurements and runtime statements below are preserved as historical evidence, not current state. Current source of truth: [M20 cleanup runtime ownership](./m20-cleanup-runtime-ownership.md).

Status: isolated Worker skeleton only. This checkpoint does not change production runtime behavior.

## Purpose

The backend migration readiness audit recommends a public-read-first migration to Cloudflare Workers + D1 while Apps Script remains the production provider and temporary source of truth. M1 adds the deployable Worker boundary without moving traffic or data.

## Files Added

| File                                                  | Responsibility                                            |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `cloudflare/public-api/.gitignore`                    | Keeps Wrangler temp output out of version control         |
| `cloudflare/public-api/src/index.ts`                  | Worker fetch entrypoint and unexpected-error boundary     |
| `cloudflare/public-api/src/router.ts`                 | M1 GET and OPTIONS route dispatch                         |
| `cloudflare/public-api/src/responses.ts`              | JSON, error, status, and CORS response helpers            |
| `cloudflare/public-api/src/cors.ts`                   | Configured-origin or local wildcard GET-only CORS headers |
| `cloudflare/public-api/src/env.ts`                    | Optional Worker environment bindings                      |
| `cloudflare/public-api/src/routes/health.ts`          | Health payload                                            |
| `cloudflare/public-api/src/routes/publicDocuments.ts` | Explicit document-list placeholder                        |
| `cloudflare/public-api/test/publicApiSmoke.test.ts`   | Worker route smoke coverage                               |
| `cloudflare/public-api/wrangler.toml`                 | Local Worker configuration with deferred D1 placeholder   |
| `cloudflare/public-api/tsconfig.json`                 | Strict Worker-only TypeScript configuration               |
| `cloudflare/public-api/README.md`                     | Scope, commands, and next-phase notes                     |

Root `package.json` adds local Worker commands and dev-only Worker tooling. `pnpm-lock.yaml` records those development dependencies.

## Route Skeletons

| Method    | Route                   | M1 behavior                                                    |
| --------- | ----------------------- | -------------------------------------------------------------- |
| `GET`     | `/health`               | Returns the Worker service health payload                      |
| `GET`     | `/api/health`           | Returns the Worker service health payload                      |
| `GET`     | `/api/public/documents` | Returns HTTP `501` with an explicit M1 not-implemented payload |
| `OPTIONS` | Any path                | Returns HTTP `204` with GET-only CORS headers                  |

`/api/public/documents` returns `501` because M1 must prove routing, CORS, deployment, and Worker execution without returning fake production data. It deliberately does not resemble `PublicDocumentListSnapshot`.

## Deferred Work

- D1 is not queried.
- No D1 database ID, schema, migration, real data, or seed script exists.
- No import or sync process exists.
- No frontend provider switch exists.
- Apps Script remains the frontend's production provider.
- Apps Script behavior, Google Drive behavior, admin writes, auth, users, media uploads, public React routes, UI, cache keys, and cache TTLs remain unchanged.
- Vercel production configuration and production environment variables remain unchanged.

## CORS Boundary

M1 supports only `GET` and `OPTIONS`. When `PUBLIC_API_ALLOWED_ORIGINS` is configured, matching comma-separated origins receive `Access-Control-Allow-Origin`. When it is unset for local skeleton use, GET-only routes return `Access-Control-Allow-Origin: *`. Future write routes require a separately scoped security review.

## Next Recommended Step

Choose M2 D1 schema plus a local-only seed/import approach or M3 `public-document-list` implementation based on readiness. Either phase must preserve the current public response contract before any preview provider switch.
