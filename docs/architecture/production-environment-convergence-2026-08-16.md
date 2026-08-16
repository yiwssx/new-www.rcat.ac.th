# Production Environment Convergence

Updated: 2026-08-16.

Status: current architecture decision.

## Decision

RCAT Cloudflare runtime uses two operational tiers only:

- local development: `rcat-public-api-local`;
- production: the existing Worker and data-bearing D1 that were originally provisioned with the physical Cloudflare name `rcat-public-api-preview`.

There is no persistent Preview runtime after this convergence. The word `preview` in the Cloudflare physical resource names is historical only; operationally those resources are Production.

Both live resources are promoted in place. No Worker URL migration, D1 export/import, data copy, rebuild, reseed, or data transfer is part of this decision. The previous empty D1 and unused Worker named `rcat-public-api-production` never became the live source and were manually deleted on 2026-08-16. They are not recreated.

## Naming Contract

Canonical role and historical physical resource labels are intentionally separated:

```text
Canonical role       production
Wrangler environment env.production
Worker physical name rcat-public-api-preview  (legacy label)
D1 binding           DB
D1 physical name     rcat-public-api-preview  (legacy label)
D1 identity          protected UUID in RCAT_PRODUCTION_D1_DATABASE_ID
```

The legacy physical name must not be interpreted as a Preview environment. The protected D1 UUID is authoritative for database release identity. Production workflows verify the exact account-scoped D1 resource and UUID before any migration or Worker deployment.

The repository keeps `production-placeholder` in `wrangler.toml`; the real UUID is injected only by the protected GitHub `Production` environment.

## Runtime Model

```text
Local
  Vite / Wrangler local
  -> rcat-public-api-local

Production
  www.rcat.ac.th / Vercel
  -> existing rcat-public-api-preview Worker
       canonical role = production
  -> DB binding
  -> existing rcat-public-api-preview D1
       canonical role = production
```

There is no separate Cloudflare Preview Worker, Preview D1 tier, or replacement Worker URL in the current architecture.

## Release Rules

Production release remains manual and protected:

1. run `Worker Production Preflight` from `master`;
2. verify exact production D1 physical resource + protected UUID;
3. verify a current Time Travel bookmark;
4. review unapplied migrations;
5. run fixture integrity gates;
6. only then run `Worker Production Release`;
7. apply pending migrations to the existing data-bearing D1 if any;
8. deploy the `env.production` configuration in place to the existing Worker physical name `rcat-public-api-preview`.

The preflight is read-only. A production release updates the existing Worker; it does not create a replacement `rcat-public-api-production` Worker.

Wrangler is configured with `keep_vars = true` so dashboard-managed non-secret variables that are not represented in the tracked config are preserved during the in-place deployment. Cloudflare encrypted secrets are preserved by Wrangler deploy unless explicitly deleted.

## Vercel Boundary

The existing Worker endpoint remains unchanged. If Vercel Production already points to that Worker, `CLOUDFLARE_PUBLIC_API_URL`, `VITE_CLOUDFLARE_PUBLIC_API_URL`, and `CLOUDFLARE_ADMIN_API_URL` do not need to change solely because of this convergence.

A Vercel redeploy is required only when a Vercel environment value or frontend/server code that consumes it actually changes.

## Retirement

Completed on 2026-08-16:

- the unused empty D1 previously named `rcat-public-api-production` was deleted manually;
- the unused Worker previously named `rcat-public-api-production` was deleted manually;
- the existing `rcat-public-api-preview` Worker and D1 were designated as the sole Production runtime without renaming or data movement.

Historical M5/M6 Preview documents remain audit history and must be read as historical, not as current architecture.

Never delete the existing Worker or D1 merely because their physical names still contain `preview`.

## Source Of Truth

For current runtime interpretation use, in order:

1. `docs/architecture/current-runtime-ownership.md`;
2. this document;
3. `docs/deployment/runtime-deployment-guide.md`.

Earlier Preview milestone documents are historical evidence only.
