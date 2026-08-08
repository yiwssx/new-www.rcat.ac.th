# Runtime Deployment Guide

Updated: 2026-08-08.

## Toolchain

Current checked-in contract:

- Node `24.x`
- pnpm `10.34.5`

Node 22 is no longer the current project requirement.

## Deployment Matrix

| Change type                                                | Required deployment                          | Notes                                                                              |
| ---------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- |
| React/Vite frontend (`src/**`)                             | Vercel                                       | Includes Public SSR hydration client plus Admin/Public/Auth UI.                    |
| Public SSR / Vercel functions (`api/**`, SSR runtime)      | Vercel                                       | Revalidate routing, HTTP semantics, cache headers, proxies, and crawler output.    |
| Vercel same-origin proxies (`server/**`, other `api/**`)   | Vercel                                       | Includes CMS/Admin, media, and isolated complaint proxy behavior.                  |
| Cloudflare Worker runtime (`cloudflare/public-api/src/**`) | Cloudflare Worker                            | Release explicitly after tests/typecheck; `master` merge alone does not deploy it. |
| Worker config                                              | Cloudflare Worker/config operation           | Environment changes are explicit operations.                                       |
| New D1 schema migration                                    | D1 migration + compatible Worker as required | Append-only; production release workflow applies pending migrations before Worker. |
| Apps Script `.gs` media bridge                             | Apps Script                                  | Explicit media bridge deployment required.                                         |
| Dedicated Complaint Apps Script                            | Apps Script                                  | Separate endpoint/deployment from the main media bridge.                           |
| Documentation only                                         | No runtime deployment                        | Source-control only.                                                               |
| Tests only                                                 | No runtime deployment                        | Unless accompanying runtime code.                                                  |

## Runtime Ownership

- Vercel: Public SSR presentation, React/Vite hydration client, Admin/Auth CSR fallback, same-origin proxies, runtime sitemap.
- Cloudflare Worker: Public/Admin structured API behavior, analytics abuse guard, scheduled analytics retention.
- D1: structured persistence and analytics aggregates/raw-event retention tables.
- Apps Script media bridge: Google Drive media/file operations only.
- Dedicated Complaint Apps Script: isolated complaint destination reached only through Vercel `/api/complaint`.
- Google Drive: file/media storage behind the main media bridge.

See `docs/architecture/current-runtime-ownership.md` for the canonical ownership map.

## Vercel Production

`master` is the production deployment branch. Repository Vercel configuration disables non-master deployments.

Required server-side Public read configuration:

```text
PUBLIC_API_PROVIDER=cloudflare
CLOUDFLARE_PUBLIC_API_URL=<production Cloudflare Public API base URL>
```

The existing `VITE_PUBLIC_API_PROVIDER` and `VITE_CLOUDFLARE_PUBLIC_API_URL` names remain supported for compatibility, but server-only names are preferred for SSR.

### Complaint proxy configuration

Canonical server-only Vercel configuration:

```text
COMPLAINT_API_URI=https://script.google.com/macros/s/<dedicated-complaint-deployment-id>/exec
```

The browser submits to same-origin `/api/complaint`; it does not call Apps Script directly. `VITE_COMPLAINT_API_URI` is a server-side compatibility fallback only for an already-configured deployment. After `COMPLAINT_API_URI` is configured and a production redeploy succeeds, remove the old `VITE_COMPLAINT_API_URI` value from Vercel.

The complaint proxy validates fields, normalizes phone numbers, checks attachment size/type/extension/signature, enforces same-origin requests and endpoint allowlisting, and applies an upstream timeout before forwarding the existing text/plain Apps Script contract.

### Public SSR build behavior

1. Vite builds the browser client normally.
2. The client entry and global stylesheet are emitted as deterministic `/assets/rcat-client.js` and `/assets/rcat-client.css`; lazy chunks remain content-hashed.
3. `scripts/prepare-ssr-cutover-output.mjs` verifies those assets.
4. `dist/index.html` is renamed to `dist/csr.html`.
5. `dist/index.html` is intentionally absent so Vercel filesystem precedence cannot bypass Public SSR at `/`.
6. Login/Activation/Reset/Admin rewrite to `csr.html`; Public application routes rewrite to `api/ssr.ts`.

The Public SSR adapter supports GET/HEAD. Unexpected server-render exceptions return protected HTTP `503` rather than leaking implementation details.

### Public SSR cache policy

- Successful indexable Public pages: browser revalidation; Vercel CDN freshness 2 minutes with stale-while-revalidate for 1 hour.
- Public Shell browser query: stale after 2 minutes; refetch on focus/reconnect.
- Search: `no-store`, `X-Robots-Tag: noindex, follow`.
- 4xx/5xx: `no-store` and noindex protection where applicable.
- Permanent legacy `/$slug` redirect: browser revalidation; Vercel CDN one-day freshness with seven-day stale-while-revalidate.
- `csr.html`: `no-store`, `noindex, nofollow`.

See `docs/operations/public-ssr-cutover.md` for live verification and rollback.

## Cloudflare Worker Production Release

A merge to `master` does **not** deploy the Cloudflare Worker automatically.

Production Worker release is intentionally manual through:

```text
.github/workflows/worker-production.yml
```

The workflow is `workflow_dispatch` only and refuses to release from a ref other than `master`.

Required GitHub `production` environment/repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
RCAT_PRODUCTION_D1_DATABASE_ID
```

The tracked `cloudflare/public-api/wrangler.toml` must keep:

```toml
database_id = "production-placeholder"
```

Never commit the real production D1 ID. `worker-production-deploy.mjs` validates `RCAT_PRODUCTION_D1_DATABASE_ID`, creates a temporary production config next to `wrangler.toml`, then performs:

1. production Worker typecheck in the workflow;
2. `wrangler d1 migrations apply ... --remote --env production`;
3. `wrangler deploy --env production` only if migration succeeds;
4. removal of the temporary config even on failure.

The workflow therefore fails closed when the production D1 UUID is missing/malformed or tracked configuration no longer contains the placeholder contract.

### Analytics migration and retention

Before Worker code with the public analytics abuse guard can serve production traffic, D1 must contain migration:

```text
0007_public_analytics_abuse_guard.sql
```

The production release workflow applies pending migrations before deployment.

Production Worker cron runs daily and prunes:

- expired rate-limit buckets;
- visitor presence older than 2 days;
- raw site-view events older than 90 days;
- raw content-view events older than 90 days.

Daily aggregate tables are not removed by this retention job.

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

Start with focused tests for the changed boundary, then broaden. Release-scale validation includes:

```bash
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm deps:status:check
pnpm deps:check
pnpm deps:docs:audit
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

The dependency status check validates the committed generated report; it must not silently regenerate a stale report in blocking PR/push CI.

## Deployment Safety

Before a Vercel deployment:

1. inspect the final diff and confirm no temporary validation workflow is included;
2. ensure required production Vercel server variables are present;
3. verify the production Cloudflare Public API is healthy;
4. run release-scale gates;
5. merge to `master` only after the integration line is fully green;
6. watch the Vercel production result;
7. perform live status/head/no-JavaScript/crawler checks when Public SSR changes;
8. roll back if the cutover checklist fails materially.

Before a Worker deployment:

1. merge the validated Worker/D1 changes to `master`;
2. confirm the three production release secrets are configured;
3. invoke `Worker Production Release` manually on `master`;
4. require successful migration and Worker deploy output;
5. verify Worker health/Public API behavior immediately after release.
