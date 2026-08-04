# Runtime Deployment Guide

Updated: 2026-08-04.

## Toolchain

Current checked-in contract:

- Node `24.x`
- pnpm `10.34.5`

Node 22 is no longer the current project requirement.

## Deployment Matrix

| Change type | Required deployment | Notes |
| --- | --- | --- |
| React/Vite frontend (`src/**`) | Vercel | Includes Public SSR hydration client plus Admin/Public/Auth UI. |
| Public SSR / Vercel functions (`api/**`, SSR runtime) | Vercel | Revalidate SSR routing, HTTP semantics, cache headers, and crawler output. |
| Vercel same-origin proxies (`server/**`, other `api/**`) | Vercel | Revalidate proxy/auth behavior when touched. |
| Cloudflare Worker runtime (`cloudflare/public-api/src/**`) | Cloudflare Worker | Run relevant Worker tests/typecheck first. |
| Worker config | Cloudflare Worker/config operation | Environment changes are explicit operations. |
| New D1 schema migration | D1 migration + compatible Worker as required | Append-only; do not rewrite historical migrations. |
| Apps Script `.gs` media bridge | Apps Script | Explicit deployment required. |
| Documentation only | No runtime deployment | Source-control only. |
| Tests only | No runtime deployment | Unless accompanying runtime code. |

## Runtime Ownership

- Vercel: Public SSR presentation, React/Vite hydration client, Admin/Auth CSR fallback, same-origin CMS/Admin/Apps Script proxies, runtime sitemap.
- Cloudflare Worker: Public/Admin structured API behavior.
- D1: structured persistence.
- Apps Script: Google Drive media/file bridge only.
- Google Drive: file/media storage behind that bridge.

## Public SSR Production Cutover

The completed SSR integration is designed to be promoted to `master` as one production unit. Do not deploy individual readiness/implementation phase branches directly to production.

Required Vercel runtime configuration for server-side Public reads:

```text
PUBLIC_API_PROVIDER=cloudflare
CLOUDFLARE_PUBLIC_API_URL=<production Cloudflare Public API base URL>
```

The existing `VITE_PUBLIC_API_PROVIDER` and `VITE_CLOUDFLARE_PUBLIC_API_URL` names remain supported, but server-only names are preferred for the Vercel SSR runtime so the backend origin does not need to be exposed merely to satisfy server rendering.

Phase 7 production build behavior:

1. Vite builds the browser client normally.
2. The client entry and global stylesheet are emitted as `/assets/rcat-client.js` and `/assets/rcat-client.css`; lazy chunks remain content-hashed.
3. `scripts/prepare-ssr-cutover-output.mjs` verifies those assets.
4. `dist/index.html` is renamed to `dist/csr.html`.
5. `dist/index.html` is intentionally absent so Vercel's filesystem precedence cannot serve the old SPA document at `/` before the SSR rewrite runs.
6. Login/Activation/Reset/Admin rewrite to `csr.html`; Public application routes rewrite to `api/ssr.ts`.

The Public SSR adapter supports GET/HEAD. Unexpected server-render exceptions return protected HTTP `503` rather than leaking implementation details.

### Public SSR cache policy

- Successful indexable Public pages: browser revalidation; Vercel CDN freshness 5 minutes with stale-while-revalidate for 24 hours.
- Search: `no-store`, `X-Robots-Tag: noindex, follow`.
- 4xx/5xx: `no-store` and noindex protection.
- Permanent legacy `/$slug` redirect: browser revalidation; Vercel CDN one-day freshness with seven-day stale-while-revalidate.
- `csr.html`: `no-store`, `noindex, nofollow`.

See `docs/operations/public-ssr-cutover.md` for live verification and rollback.

## CMS Session Deployment Rule

Deploy based on the actual diff:

- frontend auth/session code -> Vercel;
- `server/adminProxy/**` -> Vercel;
- `cloudflare/public-api/**` -> Worker;
- migration files -> D1 migration.

Do not deploy Worker/D1 merely because a feature relates to authentication or SSR presentation.

## Sitemap

Vercel rewrites `/sitemap.xml` to `/api/sitemap`, which reads live Public data from the Cloudflare API.

Verification:

```bash
pnpm test:sitemap
pnpm build
```

Do not restore a tracked build-generated `public/sitemap.xml`.

## Verification Strategy

Start with focused tests for the changed boundary, then broaden. For SSR production cutover, the release-scale gate should include:

```bash
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm format:check
pnpm lint:strict
pnpm test:unit
pnpm test:integration
pnpm build
pnpm perf:check
pnpm media:check
pnpm layout:check
pnpm design:check
pnpm worker:typecheck
pnpm worker:deploy:dry
pnpm exec playwright install --with-deps chromium
pnpm test:functional
```

Phase 7 additionally validates the cutover output (`csr.html` present, `index.html` absent, deterministic client assets present), the standalone SSR bundle, and a Vite bundle smoke of `api/ssr.ts`.

## Vercel Preview Limitation

A Phase 7 `preview-*` deployment attempt can be blocked by the Vercel Free-plan build-rate quota. The observed status `upgradeToPro=build-rate-limit` is a platform quota failure, not evidence of a source/build regression. When this occurs, retry live preview/crawler validation after deployment capacity is available; do not weaken SSR tests or routing merely to bypass the quota.

## Deployment Safety

Before deployment:

1. inspect the final integration diff and confirm no temporary validation workflow or preview-only branch change is part of the production diff;
2. ensure production Public API environment variables are present in Vercel;
3. verify the production Cloudflare Public API is healthy;
4. run focused SSR validation and release-scale gates;
5. promote the completed integration line to `master` only with explicit authorization;
6. watch the Vercel deployment result;
7. perform the live status/head/no-JavaScript/crawler checks in `docs/operations/public-ssr-cutover.md` immediately after deployment;
8. roll back if the cutover checklist fails materially.

Phase 7 does not change D1 schema, Cloudflare Worker source, or Apps Script. An SSR routing rollback therefore normally requires only a Vercel/frontend rollback, not a data-layer rollback.
