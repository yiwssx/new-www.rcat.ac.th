# Production Environment Convergence

Updated: 2026-08-16.

Status: current architecture decision.

## Decision

RCAT Cloudflare structured data uses two operational tiers only:

- local development: `rcat-public-api-local`;
- production: the existing data-bearing D1 that was originally provisioned with the physical Cloudflare name `rcat-public-api-preview`.

There is no persistent Preview runtime after this convergence.

The existing data-bearing D1 is promoted in place. No D1 export/import, copy, rebuild, reseed, or data transfer is part of this decision. The previous D1 named `rcat-public-api-production` is not the canonical production database because it never became the live data source.

## Naming Contract

The canonical role and the historical physical resource label are intentionally separated:

```text
Canonical role       production
Worker environment   env.production
Worker service       rcat-public-api-production
D1 binding           DB
D1 physical name     rcat-public-api-preview  (legacy resource label)
D1 identity          protected UUID in RCAT_PRODUCTION_D1_DATABASE_ID
```

The legacy D1 physical name must not be interpreted as a Preview environment. The protected D1 UUID is authoritative for release identity. Production workflows must verify that the exact legacy physical resource and the protected UUID refer to the same account-scoped D1 before any migration or Worker deployment.

The repository must keep `production-placeholder` in `wrangler.toml`; the real UUID is injected only by the protected GitHub `Production` environment.

## Runtime Model

```text
Local
  Vite / Wrangler local
  -> rcat-public-api-local

Production
  www.rcat.ac.th / Vercel
  -> rcat-public-api-production Worker
  -> DB binding
  -> promoted data-bearing D1 (legacy physical name rcat-public-api-preview)
```

No permanent Cloudflare Preview Worker or Preview D1 tier is part of the current runtime architecture.

## Release Rules

Production release remains manual and protected:

1. run `Worker Production Preflight` from `master`;
2. verify exact production D1 physical resource + protected UUID;
3. verify a current Time Travel bookmark;
4. review unapplied migrations;
5. run fixture integrity gates;
6. only then run `Worker Production Release`;
7. apply pending migrations to the promoted D1;
8. deploy the `env.production` Worker.

The preflight is read-only. A production release is the only normal path that may apply D1 migrations and deploy Worker code.

## Vercel Boundary

Vercel production configuration must point at the canonical production Worker endpoint after the Worker cutover. Vercel configuration is managed separately from this repository convergence.

## Retirement

After production smoke validation succeeds:

- the unused empty D1 previously named `rcat-public-api-production` may be retired manually after an independent empty-data check;
- any obsolete Preview Worker deployment may be retired after confirming Vercel no longer references it;
- historical M5/M6 Preview documents remain audit history and must be read as historical, not as current architecture.

Never delete the promoted data-bearing D1 merely because its physical name still contains `preview`.

## Source Of Truth

For current runtime interpretation use, in order:

1. `docs/architecture/current-runtime-ownership.md`;
2. this document;
3. `docs/deployment/runtime-deployment-guide.md`.

Earlier Preview milestone documents are historical evidence only.
