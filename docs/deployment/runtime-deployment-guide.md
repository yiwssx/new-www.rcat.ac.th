# Runtime Deployment Guide

Updated: 2026-08-16.

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
| Worker config                                              | Cloudflare Worker/config operation           | Production changes are explicit operations.                                        |
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

Cloudflare has only local development plus one canonical remote production role. There is no persistent Preview deployment tier. The data-bearing D1 originally provisioned with the physical name `rcat-public-api-preview` is promoted in place and is the canonical production database. See `docs/architecture/production-environment-convergence-2026-08-16.md` and `docs/architecture/current-runtime-ownership.md`.

## Vercel Production

`master` is the production deployment branch. Repository Vercel configuration disables non-master deployments.

Required server-side Public read configuration:

```text
CLOUDFLARE_PUBLIC_API_URL=<production Cloudflare Public API base URL>
```

The Public structured-data runtime is Cloudflare-only and has no provider selector. Browser code uses the public `VITE_CLOUDFLARE_PUBLIC_API_URL` alias. Server-side code prefers `CLOUDFLARE_PUBLIC_API_URL` and accepts `VITE_CLOUDFLARE_PUBLIC_API_URL` only as a compatibility fallback because the Worker origin itself is not secret.

Vercel production configuration must point to the canonical production Worker endpoint after Cloudflare cutover. Vercel configuration is managed separately from Worker/D1 repository convergence.

### Complaint proxy configuration

Canonical server-only Vercel configuration:

```text
COMPLAINT_API_URI=https://script.google.com/macros/s/<dedicated-complaint-deployment-id>/exec
```

The browser submits to same-origin `/api/complaint`; it does not call Apps Script directly. `VITE_COMPLAINT_API_URI` is a server-side compatibility fallback only for an already-configured deployment. After `COMPLAINT_API_URI` is configured and a production redeploy succeeds, remove the old `VITE_COMPLAINT_API_URI` value from Vercel.

The complaint proxy validates fields, normalizes phone numbers, checks attachment size/type/extension/signature, enforces same-origin requests and endpoint allowlisting, and applies an upstream timeout before forwarding the existing text/plain Apps Script contract.

### Public SSR build behavior

1. Vite builds the browser client normally and emits content-hashed client assets.
2. `scripts/prepare-ssr-cutover-output.mjs` reads the Vite manifest and verifies the manifest-selected entry JavaScript and stylesheet files exist and are content-hashed.
3. The SSR build injects those manifest-selected public asset paths through `__RCAT_SSR_CLIENT_ENTRY_PATH__` and `__RCAT_SSR_CLIENT_STYLESHEET_PATHS__`.
4. `src/ssrAssets.ts` fails closed if the build-time manifest injection is unavailable; it does not fall back to fixed `/assets/rcat-client.*` names.
5. `dist/index.html` is renamed to `dist/csr.html`.
6. `dist/index.html` is intentionally absent so Vercel filesystem precedence cannot bypass Public SSR at `/`.
7. Login/Activation/Reset/Admin rewrite to `csr.html`; Public application routes rewrite to `api/ssr.ts`.

The Public SSR adapter supports GET/HEAD. Unexpected server-render exceptions return protected HTTP `503` rather than leaking implementation details.

### Public SSR cache policy

- Successful indexable Public pages: browser revalidation; Vercel CDN freshness 2 minutes with stale-while-revalidate for 1 hour.
- Public Shell browser query: stale after 2 minutes; refetch on focus/reconnect.
- Search: `no-store`, `X-Robots-Tag: noindex, follow`.
- 4xx/5xx: `no-store` and noindex protection where applicable.
- Permanent legacy `/$slug` redirect: browser revalidation; Vercel CDN one-day freshness with seven-day stale-while-revalidate.
- `csr.html`: `no-store`, `noindex, nofollow`.
- Client entry/styles and lazy chunks are manifest-selected content-hashed assets; do not restore fixed client asset names.

See `docs/operations/public-ssr-cutover.md` for live verification and rollback.

## Cloudflare Worker Production Release

A merge to `master` does **not** deploy the Cloudflare Worker automatically.

### Canonical production database

The canonical production D1 is the existing data-bearing database whose legacy physical Cloudflare name is `rcat-public-api-preview`. It is promoted in place; do not export/import, copy, rebuild, or reseed it merely to obtain a production-looking physical name.

The old D1 physically named `rcat-public-api-production` never became the live structured-data source and is not a release target. It may be retired separately only after an independent check confirms it contains no required data.

The legacy physical `preview` label must not be interpreted as a non-production environment. Release identity is the pair of:

- exact physical D1 resource name expected by the repository;
- protected UUID in `RCAT_PRODUCTION_D1_DATABASE_ID`.

Production migration inspection is intentionally separate and read-only through:

```text
.github/workflows/worker-production-preflight.yml
```

Run this workflow on `master` before a production Worker release after Worker/D1 changes. It verifies that the promoted data-bearing D1 physical resource matches the protected production UUID, validates migration filename sequencing, resolves a current Time Travel bookmark without printing it, and runs `wrangler d1 migrations list ... --remote`. The preflight does not apply migrations, execute SQL files, deploy a Worker, or restore Time Travel state.

Production Worker release is intentionally manual through:

```text
.github/workflows/worker-production.yml
```

Both workflows are `workflow_dispatch` only, use the protected `production` GitHub environment, and refuse to operate from a ref other than `master`.

Required GitHub `production` environment/repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
RCAT_PRODUCTION_D1_DATABASE_ID
```

`RCAT_PRODUCTION_D1_DATABASE_ID` must contain the UUID of the promoted data-bearing D1, not the unused empty D1.

The tracked `cloudflare/public-api/wrangler.toml` must keep:

```toml
[env.production]
name = "rcat-public-api-production"

[[env.production.d1_databases]]
binding = "DB"
database_name = "rcat-public-api-preview"
database_id = "production-placeholder"
```

Never commit the real D1 UUID. The `env.production` Worker service name is production-facing; the D1 `database_name` retains the legacy physical label only because the existing data-bearing database is promoted without data movement.

`worker-production-preflight.mjs` and `worker-production-deploy.mjs` create temporary production configs next to `wrangler.toml` using the protected D1 UUID. The release workflow verifies exact D1 identity, captures a fresh pre-release Time Travel bookmark, lists unapplied migrations, rechecks the production fixture sentinel, and only then allows the mutating release step.

The mutating release helper performs:

1. `wrangler d1 migrations apply` against the promoted data-bearing D1 using the temporary `env.production` config;
2. `wrangler deploy --env production` only if migration succeeds;
3. removal of the temporary config even on failure.

The workflow therefore fails closed when the production D1 UUID is missing/malformed, does not match the promoted account-scoped resource, the tracked configuration no longer contains the placeholder contract, fixture sentinels are not clean, or migration application fails.

### Production data integrity

`.github/workflows/production-data-integrity.yml` uses the same promoted D1 identity contract. Audit mode is read-only. Cleanup mode remains separately guarded and may delete only the explicitly recognized local/dev fixture rows.

### Recovery readiness

`.github/workflows/d1-recovery-drill.yml` is now a read-only **production** Time Travel readiness drill. It verifies the same protected D1 identity and resolves current Time Travel metadata/bookmark only. The workflow intentionally contains no restore command.

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

The sitemap function emits the known indexable static Public routes and canonical published content routes from News, Announcements (including published Public page items), and Blog. Program records are not emitted as content-detail URLs because the current Public programs surface has the `/departments` listing route but no canonical program detail route.

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

1. merge the validated Worker/D1 convergence/release changes to `master`;
2. set `RCAT_PRODUCTION_D1_DATABASE_ID` to the promoted data-bearing D1 UUID in the protected GitHub `Production` environment;
3. invoke `Worker Production Preflight` manually on `master` and inspect the unapplied-migration list;
4. confirm exact promoted-D1 identity, Time Travel readiness, and the pending migration set;
5. invoke `Worker Production Release` manually on the same `master` revision;
6. require successful fixture gates, migration apply, and Worker deploy output;
7. update/verify Vercel production Worker URL separately;
8. verify Worker health, Public API, Admin/Auth, analytics, and representative SSR pages immediately after release;
9. retire obsolete empty/Preview-era Cloudflare resources only after the new production path is verified.
