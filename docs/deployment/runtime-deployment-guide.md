# Runtime Deployment Guide

Updated: 2026-09-28.

## Toolchain

Current checked-in contract:

- Node `24.x`
- pnpm `10.34.5`

Node 22 is no longer the current project requirement.

## Deployment Matrix

| Change type                                                 | Required deployment                          | Notes                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| React/Vite frontend (`src/**`)                              | Vercel                                       | Includes Public SSR hydration client plus Admin/Public/Auth UI.                        |
| Public SSR / Vercel functions (`api/**`, SSR runtime)       | Vercel                                       | Revalidate routing, HTTP semantics, cache headers, proxies, and crawler output.        |
| Vercel same-origin proxies/handlers (`server/**`, `api/**`) | Vercel                                       | Includes CMS/Admin, media, complaint, and B3 health-aggregation server behavior.       |
| Public API Worker (`cloudflare/public-api/src/**`)           | Cloudflare Worker                            | Release explicitly after tests/typecheck; a `main` merge alone does not deploy it.     |
| Image delivery Worker (`cloudflare/image-test/**`)           | Cloudflare Image Production Worker           | Deploys automatically from `main` when its tracked Worker path/workflow changes.       |
| Worker config                                               | Cloudflare Worker/config operation           | Production changes follow the owning workflow's explicit policy.                       |
| New D1 schema migration                                     | D1 migration + compatible Worker as required | Append-only; production release workflow applies pending migrations before Worker.     |
| Apps Script `.gs` media bridge                              | Apps Script                                  | Explicit media bridge deployment required.                                             |
| Dedicated Complaint Apps Script                             | Apps Script                                  | Separate endpoint/deployment from the main media bridge.                               |
| Documentation only                                          | No runtime deployment                        | Source-control only.                                                                   |
| Tests only                                                  | No runtime deployment                        | Unless accompanying runtime code.                                                      |

## Runtime Ownership

- Vercel: Public SSR presentation, React/Vite hydration client, Admin/Auth CSR fallback, same-origin proxies/functions, B3 `/api/health-aggregation`, runtime sitemap.
- Cloudflare Public API Worker: Public/Admin structured API behavior, B2 runtime-incident ingest/admin read, analytics abuse guard, scheduled analytics/incident retention.
- Cloudflare Image Production Worker: optimized public Google Drive image delivery for the explicitly enabled image intents.
- D1: structured persistence, analytics aggregates/raw-event retention tables, and B2 aggregated runtime incidents.
- Apps Script media bridge: Google Drive media/file operations only.
- Dedicated Complaint Apps Script: isolated complaint destination reached only through Vercel `/api/complaint`.
- Google Drive: file/media storage behind the main media bridge and source-of-truth image files used by the image-delivery Worker.

The Public API Worker and data-bearing D1 retain the historical physical name `rcat-public-api-preview` and are the canonical production runtime. Their historical physical labels are not environment semantics. See `docs/architecture/production-environment-convergence-2026-08-16.md` and `docs/architecture/current-runtime-ownership.md`.

The separate image-delivery Worker uses the production service name `rcat-image-production` and workers.dev endpoint `https://rcat-image-production.rcat-digital.workers.dev`. Its repository source remains under `cloudflare/image-test/**` for continuity; the runtime service identity is authoritative.

## Verified Live Environment Baseline

On 2026-09-11 the operator directly inspected the applicable live Vercel and Cloudflare environments and confirmed:

- Vercel Production uses server-only `COMPLAINT_API_URI`;
- retired `VITE_COMPLAINT_API_URI` is absent from the live Vercel environment;
- the CMS-auth observation follow-up is complete;
- legacy-only CMS-auth environment values governed by the final cutover are retired from the applicable Vercel and Cloudflare environments.

The evidence classification is operator-attested production state and is recorded in `docs/operations/environment-retirement-verification-2026-09-11.md`. Compatibility parsing that remains in server source does not mean a retired variable is still live configuration.

On 2026-09-28 the Vercel Production Branch and repository deployment policy were cut over to `main`, and the production image-delivery Worker identity was promoted to `rcat-image-production` before frontend routing was switched to the new endpoint.

## Vercel Production

`main` is the production deployment branch. Repository Vercel configuration disables non-main deployments.

Required server-side Public read configuration:

```text
CLOUDFLARE_PUBLIC_API_URL=<production Cloudflare Public API base URL>
```

The Public structured-data runtime is Cloudflare-only and has no provider selector. Browser code uses the public `VITE_CLOUDFLARE_PUBLIC_API_URL` alias. Server-side code prefers `CLOUDFLARE_PUBLIC_API_URL` and accepts `VITE_CLOUDFLARE_PUBLIC_API_URL` only as a compatibility fallback because the Worker origin itself is not secret.

If Vercel Production already points at the existing `rcat-public-api-preview` Worker endpoint, the environment convergence does not require changing `CLOUDFLARE_PUBLIC_API_URL`, `VITE_CLOUDFLARE_PUBLIC_API_URL`, or `CLOUDFLARE_ADMIN_API_URL`. A Vercel redeploy is required only when a Vercel value or consuming Vercel code actually changes.

### Production image delivery

The current frontend production configuration is:

```text
VITE_PUBLIC_IMAGE_DELIVERY_BASE_URL=https://rcat-image-production.rcat-digital.workers.dev
VITE_PUBLIC_IMAGE_DELIVERY_INTENTS=portrait,carousel,intro-gate
```

The Worker is an optimized delivery layer only; Google Drive remains the source of truth. The documented direct-Drive retry/fallback behavior remains active. IntroGate remains mandatory when enabled: Worker failure retries the same Drive image, and failure of both delivery paths must not expose an entry bypass.

The image Worker is deployed by `.github/workflows/image-test-worker.yml`. A production deploy must pass lint, typecheck, Wrangler dry-run, deploy, and `/health` verification with `service: "rcat-image-production"` and `status: "ok"`.

### B3 health aggregation

`GET /api/health-aggregation` is Vercel-owned and server-side. The browser does not receive GitHub, Vercel, Cloudflare, or proxy credentials.

The handler reuses the existing CMS Session + server-only proxy boundary to read the authenticated B2 admin incident feed, preserving Worker-side `dashboard.read` enforcement. It then aggregates bounded public GitHub workflow/commit-status metadata for the repository's production verification and reliability controls. The response is `no-store` and is consumed only by the explicit-refresh `/admin/system-health` operator flow.

B3 does not require a Worker deployment or D1 migration unless a separate Worker/D1 change is included in the same release.

### Complaint proxy configuration

Canonical and verified live server-only Vercel Production configuration:

```text
COMPLAINT_API_URI=https://script.google.com/macros/s/<dedicated-complaint-deployment-id>/exec
```

The browser submits to same-origin `/api/complaint`; it does not call Apps Script directly. `VITE_COMPLAINT_API_URI` remains recognized by server source only as compatibility parsing for an old configured deployment, but it is not current Production configuration. Do not restore it merely because the compatibility fallback remains in code.

### Public SSR build behavior

1. Vite builds the browser client normally and emits content-hashed client assets.
2. `scripts/prepare-ssr-cutover-output.mjs` reads the Vite manifest and verifies the manifest-selected entry JavaScript and stylesheet files exist and are content-hashed.
3. The SSR build injects those manifest-selected public asset paths through `__RCAT_SSR_CLIENT_ENTRY_PATH__` and `__RCAT_SSR_CLIENT_STYLESHEET_PATHS__`.
4. `src/ssrAssets.ts` fails closed if the build-time manifest injection is unavailable; it does not fall back to fixed `/assets/rcat-client.*` names.
5. `dist/index.html` is renamed to `dist/csr.html`.
6. `dist/index.html` is intentionally absent so Vercel filesystem precedence cannot bypass Public SSR at `/`.
7. Login/Activation/Reset/Admin rewrite to `csr.html`; Public application routes rewrite to `api/ssr.ts`.

TanStack Router renders Public SSR through `renderRouterToStream`; the Emotion critical-CSS finalizer buffers the completed body before returning the final Vercel response. The Public SSR adapter supports GET/HEAD. Unexpected server-render exceptions return protected HTTP `503` rather than leaking implementation details.

### Public SSR cache policy

- Stable/index/list Public SSR surfaces: browser revalidation; bounded Vercel CDN freshness with stale-while-revalidate.
- Dynamic canonical content detail `/content/:slug`: `Cache-Control: no-store`; no shared Vercel CDN cache directive.
- Public Shell browser query: short client staleness window with refetch on focus/reconnect.
- Search: `no-store`, `X-Robots-Tag: noindex, follow`.
- 4xx/5xx: `no-store` and noindex protection where applicable.
- Permanent legacy `/$slug` redirect: longer redirect CDN policy.
- `csr.html`: `no-store`, `noindex, nofollow`.
- Client entry/styles and lazy chunks are manifest-selected content-hashed assets; do not restore fixed client asset names.

Dynamic content detail deliberately bypasses shared CDN caching so publish/delete verification and normal reads observe current Worker/D1 state rather than stale cached HTML.

See `docs/operations/public-ssr-cutover.md` for live verification and rollback.

## Cloudflare Public API Worker Production Release

A merge to `main` does **not** deploy the Public API Worker automatically.

### Canonical production runtime

The canonical production Public API Worker and D1 are the existing resources whose legacy physical Cloudflare name is `rcat-public-api-preview`. They are promoted in place. Do not create replacement resources merely to obtain production-looking physical names.

The legacy physical `preview` label must not be interpreted as a non-production environment. D1 release identity is the pair of:

- exact physical D1 resource name expected by the repository;
- protected UUID in `RCAT_PRODUCTION_D1_DATABASE_ID`.

Production migration inspection and production release are consolidated into the manual **Deploy / Worker** workflow:

```text
.github/workflows/worker-production.yml
```

Run operation `preflight` on `main` before a production Worker release after Worker/D1 changes. The preflight uses the dedicated read-only D1 credential, verifies exact production identity, validates migration filename sequencing, resolves a current Time Travel bookmark without printing it, and lists unapplied migrations. It does not apply migrations, execute SQL files, deploy a Worker, or restore Time Travel state.

Run operation `release` on the same reviewed `main` revision to perform the protected production mutation. Both operations use the protected `production` GitHub environment and refuse to operate from another ref.

Required GitHub `production` environment/repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_READ_TOKEN
CLOUDFLARE_API_TOKEN
RCAT_PRODUCTION_D1_DATABASE_ID
```

`CLOUDFLARE_D1_READ_TOKEN` is used only by read-only inspection paths. `CLOUDFLARE_API_TOKEN` is reserved for the release and other explicitly protected production-write operations. `RCAT_PRODUCTION_D1_DATABASE_ID` must contain the UUID of the promoted data-bearing D1.

The tracked `cloudflare/public-api/wrangler.toml` must keep the in-place production identity/placeholder contract. Never commit the real D1 UUID. Temporary release configs use the protected UUID and are removed even on failure.

The mutating release helper performs:

1. pending D1 migrations against the existing data-bearing D1 using the temporary production config;
2. `wrangler deploy --env production` back onto the existing Worker physical resource `rcat-public-api-preview` only if migration succeeds;
3. removal of the temporary config even on failure.

The workflow fails closed when protected identity, fixture, migration, or deploy preconditions fail.

### Production data operations

`.github/workflows/production-data-operations.yml` owns the consolidated production-data operations. Push-triggered tooling validation is non-mutating. Manual fixture audit/cleanup and other explicitly supported operations retain their own production guards; mutating modes require the documented confirmations and `main` branch restrictions.

### Recovery readiness

`.github/workflows/maintenance-recovery.yml` operation `d1-recovery-drill` is the read-only production Time Travel readiness drill. It verifies the protected D1 identity and resolves Time Travel metadata/bookmark only. The workflow intentionally contains no restore command.

### Analytics and runtime-incident migration/retention

The production release operation applies pending migrations before deployment. Production Worker cron performs the repository-defined bounded retention for rate-limit, visitor-presence, raw analytics-event, and runtime-incident data. Daily analytics aggregate tables are not removed by that retention job.

## CMS Session Deployment Rule

Deploy based on the actual diff:

- frontend auth/session code -> Vercel;
- `server/adminProxy/**` -> Vercel;
- `cloudflare/public-api/**` -> Public API Worker;
- `cloudflare/image-test/**` -> Image Production Worker;
- migration files -> D1 migration via the protected Public API Worker release path.

Do not deploy Public API Worker/D1 merely because a feature relates to authentication, SSR presentation, image delivery, or B3 server aggregation.

The CMS-auth observation window and legacy-only environment retirement are already complete. Do not reintroduce retired environment values as a deployment prerequisite; preserve the current CMS Session/MFA/proxy boundary documented by `docs/cms-auth-project-closure.md`.

## Sitemap

Vercel rewrites `/sitemap.xml` to `/api/sitemap`, which reads live Public data from the Cloudflare API.

The sitemap function emits the known indexable static Public routes and canonical published content routes. Search and legacy duplicate routes are not emitted as canonical sitemap content.

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
pnpm deps:check -- --skip-documentation-freshness
pnpm deps:docs:audit -- --skip-status-hashes
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

Blocking PR/push CI validates the committed dependency artifact. Live registry movement is handled by Renovate and the **Dependencies** workflow; the committed dependency-status snapshot is refreshed only through deliberate maintenance/repair.

## Deployment Safety

Before a Vercel deployment:

1. inspect the final diff and confirm no temporary validation workflow is included;
2. ensure required production Vercel server variables are present;
3. verify required Cloudflare production services are healthy;
4. run release-scale gates;
5. merge to `main` only after the integration line is fully green;
6. require Vercel Production to build the exact `main` SHA when the change is runtime-impacting;
7. require **Production Verification** to pass the matching deployment/status gate and browser smoke when applicable;
8. roll back to a known-good `main` production deployment if the cutover fails materially.

Before a Public API Worker deployment:

1. merge validated Worker/D1 release changes to `main`;
2. keep `RCAT_PRODUCTION_D1_DATABASE_ID` mapped to the existing data-bearing D1 UUID in the protected GitHub `production` environment;
3. invoke **Deploy / Worker** operation `preflight` manually on `main` and inspect the pending migration set;
4. confirm exact promoted-D1 identity and Time Travel readiness;
5. invoke **Deploy / Worker** operation `release` on the same reviewed `main` revision;
6. require successful fixture gates, migration apply, and in-place Worker deploy output;
7. verify Worker health, Public API, Admin/Auth, analytics/runtime-incidents, and representative SSR pages immediately after release.

Before an Image Production Worker/frontend cutover:

1. deploy `rcat-image-production` and verify `/health` before changing frontend routing;
2. keep the old frontend endpoint active until the new Worker health contract passes;
3. update `.env.production` and image-delivery regression fixtures together;
4. preserve Worker-to-Drive fallback and the mandatory IntroGate no-bypass contract;
5. require full CI and production Vercel verification before considering the cutover complete.
