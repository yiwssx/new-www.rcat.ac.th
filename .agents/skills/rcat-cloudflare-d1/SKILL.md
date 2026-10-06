---
name: rcat-cloudflare-d1
description: RCAT-specific Cloudflare Worker and D1 guidance. Use for Worker routes, D1 schema/repositories/migrations, Admin/Public structured data, RBAC, Wrangler bindings, production identity, release preflight, rollback, recovery, imports, or Cloudflare runtime safety.
metadata:
  owner: rcat
  version: "1.0.0"
---

# RCAT Cloudflare Worker + D1

Use this skill for any change that touches the Cloudflare Worker/D1 boundary.

Root `AGENTS.md`, current runtime-ownership docs, current workflows, and live repository state are authoritative. Generic Worker guidance must be adapted to these RCAT invariants.

## Trigger this skill when

- editing `cloudflare/public-api/`;
- adding/changing Worker routes, handlers, middleware, repositories, bindings, cron behavior, or rate limits;
- adding a D1 table, column, index, migration, query, import, or data repair;
- changing Admin structured read/write behavior or RBAC;
- changing Public structured data APIs;
- changing Wrangler configuration or production Worker/D1 release behavior;
- investigating D1 recovery, rollback, migration sequencing, or resource identity.

Also load `workers-best-practices` and `security-guidance` for implementation work.

## Canonical sources

Start with the files relevant to the change:

- `cloudflare/public-api/README.md`
- `cloudflare/public-api/wrangler.toml`
- `cloudflare/public-api/src/`
- `cloudflare/public-api/migrations/`
- `cloudflare/public-api/test/`
- `docs/architecture/current-runtime-ownership.md`
- `docs/deployment/runtime-deployment-guide.md`
- `.github/workflows/worker-production.yml`
- `.github/workflows/production-data-operations.yml`
- `.github/workflows/maintenance-recovery.yml`
- recovery/security operational docs referenced by root `AGENTS.md`

Historical migration notes do not override current runtime ownership.

## Runtime ownership invariants

Preserve these unless an explicitly approved architecture change says otherwise:

- Public structured reads and public structured application data are Worker + D1.
- Admin structured reads/writes are Worker + D1.
- Admin authorization data lives in D1; current user/RBAC ownership includes `app_admin_users`.
- Admin browser session/auth proxy ownership remains on the Vercel server-side boundary.
- Browser code must not restore direct Apps Script structured reads/writes.
- Media/file operations remain behind the approved Apps Script bridge and Google Drive storage boundary.
- Reuse `X-RCAT-Request-ID`; do not invent a second correlation identifier.

## Production resource identity

The canonical production runtime intentionally preserves historical physical names.

- tracked production Worker name: `rcat-public-api-preview`;
- tracked production D1 database name: `rcat-public-api-preview`;
- tracked production D1 ID remains `production-placeholder`;
- the real production D1 UUID is injected from the protected environment at release time;
- local development D1 uses `rcat-public-api-local`.

Never commit real Cloudflare account IDs, D1 UUIDs, tokens, secrets, Time Travel bookmarks, private endpoints, or production records.

Do not rename or replace the production Worker/D1 merely because the physical resource name contains `preview`. The role is production and the identity is preserved intentionally.

## D1 migration discipline

Migrations are append-only.

For a schema change:

1. inspect the latest migration filename and current schema assumptions;
2. create the next migration rather than editing an already-applied migration;
3. make the migration deterministic and safe for the existing data shape;
4. update TypeScript contracts/repositories/handlers that consume the schema;
5. add migration/repository/API tests that prove the new behavior and compatibility;
6. validate local migration behavior before considering production;
7. keep production apply separate and protected.

Do not:

- renumber historical migrations;
- rewrite an applied migration to make a test pass;
- run a remote migration from normal build/test flows;
- combine destructive data repair with a routine schema migration without an explicit approved plan.

## Query and repository rules

- Keep SQL ownership in the established repository/data-access layer rather than scattering raw D1 queries across UI-facing code.
- Bind values; do not construct SQL from untrusted string interpolation.
- Preserve revision/conflict behavior and authorization checks on Admin writes.
- Preserve route-level rate limits and authentication/step-up boundaries where applicable.
- Avoid per-request D1 writes for telemetry when the existing edge rate-limit/runtime design owns that concern.
- Treat D1 as the canonical structured-data store for the surfaces assigned to it.

## Production release procedure

A code change does not authorize a production mutation.

When production Worker/D1 release is explicitly requested:

1. confirm the exact reviewed `main` revision;
2. use the current production workflow and documented preflight;
3. preflight must remain non-mutating and verify production identity/migration state;
4. apply migrations/deploy only through the protected production release path;
5. preserve GitHub Environment approvals and confirmations;
6. record exact release/verification evidence in the active workstream tracker.

Never bypass the protected production environment with an ad-hoc local Wrangler command.

## Rollback and recovery

Keep these concepts separate:

- Worker rollback = deploy a prior compatible Worker revision while retaining current D1 state.
- D1 migration rollback = not an automatic reverse migration.
- D1 recovery = read-only readiness checks by default; destructive restore is incident-only.

The Worker rollback path must not silently run `d1 migrations apply` or Time Travel restore.

Do not create a persistent Cloudflare Preview tier or resurrect retired preview procedures unless a new approved architecture explicitly requires it.

## Verification

Use the current package scripts/workflows appropriate to the change. Typical local/CI evidence includes:

- Worker TypeScript checks;
- Worker unit/integration tests;
- repository tests covering migration/repository contracts;
- Worker dry-run/build validation;
- dependency/security/governance checks;
- normal repository CI.

Production preflight/release/verification is required only when production mutation is explicitly in scope.

## Failure handling

When a Worker/D1 test or production-preflight guard fails:

- inspect the exact resource identity, migration sequence, schema assumption, binding, and authorization path;
- fix the contract rather than deleting a guard;
- do not expose protected values in logs or tracker notes;
- do not substitute a new database/Worker just to avoid reconciling the existing resource.

## Related skills

- `rcat-workstream-governance` for phased execution and tracker state;
- `workers-best-practices` for generic Worker implementation quality;
- `security-guidance` for auth/input/network/data boundaries;
- `vitest` for test isolation and Worker test suites.
