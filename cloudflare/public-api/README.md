# RCAT Public API Worker

Updated: 2026-08-16.

This Cloudflare Worker is the D1-backed public-read, public analytics, structured-admin, and CMS authentication API. Apps Script remains only for the server-side media/file bridge to Google Drive. The dedicated complaint Apps Script is a separate isolated endpoint behind the Vercel complaint proxy.

M20 migration/runtime/domain-cutover scope is closed. Current work is stabilization and maintenance; repository validation does not authorize production mutation.

## Current Environment Model

Cloudflare remote runtime is production-only. Local development uses `rcat-public-api-local`; there is no persistent Preview environment.

The canonical production D1 is the existing data-bearing database originally provisioned under the physical Cloudflare name `rcat-public-api-preview`. That physical name is retained only to avoid moving live data. The protected UUID in `RCAT_PRODUCTION_D1_DATABASE_ID` is the authoritative release identity, and production workflows verify that UUID against the exact account-scoped physical resource before migration or deployment. Do not interpret the legacy `preview` substring as a non-production runtime.

See `docs/architecture/production-environment-convergence-2026-08-16.md`.

## Current Public Surface

Public GET routes include:

- `/health`
- `/api/health`
- `/api/public/documents`
- `/api/public/home`
- `/api/public/shell`
- `/api/public/content?kind=<news|announcements|blog>`
- `/api/public/content?kind=<news|announcements|blog>&page=<n>&pageSize=<1-100>`
- `/api/public/content/:identifier`
- `/api/public/search?q=<query>`
- `/api/public/search?q=<query>&page=<n>&pageSize=<1-100>`
- `/api/public/programs`
- `/api/public/visitor-stats`

Public write routes include site-view, content-view, and presence analytics. They are unauthenticated by design but use Worker-side abuse protection, D1-backed rate-limit buckets, and an explicit browser-origin allowlist.

Public list, program, home, and search responses use summary content records and omit full body fields; full bodies remain on content detail. Content detail returns only media rows referenced by that item. Paginated content/search requests use D1 `COUNT(*)` plus `LIMIT/OFFSET`, so one requested page does not require reading the complete matching dataset into Worker memory. Legacy unpaginated content-list URLs remain for archive surfaces that have not yet migrated to route-owned server pagination.

## CORS And Browser Analytics Writes

Public-read and public-write CORS are intentionally separate:

- public GET routes use `PUBLIC_API_ALLOWED_ORIGINS` when configured and retain the wildcard fallback when it is omitted;
- public analytics POST routes use `PUBLIC_ANALYTICS_ALLOWED_ORIGINS` and fail closed for browser requests when that allowlist is missing or the request origin is not listed;
- production permits browser analytics from the canonical `www.rcat.ac.th` origin;
- requests without an `Origin` remain available to server-to-server tooling and are still subject to the analytics abuse guard;
- Admin routes remain credentialed and fail closed through `ADMIN_WRITE_ALLOWED_ORIGINS`.

CORS is not the analytics abuse boundary by itself. Keep the D1-backed rate limits enabled even when the origin allowlist is correct.

## Structured Admin and CMS Auth

Structured admin routes cover:

- snapshot, content, documents, and home sections;
- site, homepage, and display settings;
- menu;
- carousel slides;
- external services;
- calendar events;
- visitor statistics;
- CMS users, sessions, lifecycle, MFA, CSRF, and step-up operations.

The browser reaches privileged Admin APIs through the same-origin Vercel admin/session proxies. The Worker remains authoritative for Session validity, active-user state, RBAC/capabilities, MFA, CSRF, step-up assurance, audit actor, and D1 persistence.

## Provider Behavior

Current runtime ownership:

- Public structured reads: Cloudflare Worker + D1.
- Public analytics and live visitor statistics: Cloudflare Worker + D1.
- Admin structured reads/writes: Cloudflare Worker + D1 through same-origin Vercel proxies.
- CMS authentication/session state: Cloudflare Worker + D1 through Vercel proxies.
- Media upload/delete bytes and Google Drive file operations: Apps Script behind the Vercel media/file bridge.

There is no Public runtime provider selector. Do not restore browser Apps Script structured-data reads/writes or `VITE_PUBLIC_API_PROVIDER`.

## D1 Migrations

Ordered migration files currently committed in `migrations/` are:

- `0001_public_read_schema.sql`
- `0002_public_read_core_batch.sql`
- `0003_admin_write_batch.sql`
- `0004_admin_write_hardening.sql`
- `0005_m19_structured_admin_parity.sql`
- `0006_m20_visitor_presence.sql`
- `0007_admin_user_profiles.sql`
- `0007_public_analytics_abuse_guard.sql`
- `0008_content_slug_tombstones.sql`
- `0009_carousel_responsive_image_contract.sql`
- `0010_event_media_attachments.sql`
- `0011_cms_auth_foundation.sql`
- `0012_cms_auth_identity_constraints.sql`
- `0013_cms_mfa_and_reauthentication.sql`

The duplicate numeric prefix `0007` is a legacy repository fact. Do not rename already-applied migration files. New migrations remain append-only and should use a unique new numeric prefix.

Production release tooling applies pending migrations before deploying a compatible Worker.

## Analytics Retention

Production scheduled cleanup runs daily and removes:

- expired public rate-limit buckets;
- visitor presence older than 2 days;
- raw site-view events older than 90 days;
- raw content-view events older than 90 days.

Daily aggregate statistics are retained.

## Safety Boundary

- Do not commit real D1 identifiers, Cloudflare account identifiers, credentials, private live endpoints, or real records.
- Do not apply migrations, seed data, imports, or production deploys from normal test/build flows.
- Keep tracked `wrangler.toml` production `database_id` as `production-placeholder`.
- Keep Apps Script scoped to the approved media/file bridge.
- Keep Google Drive binary operations in the approved Apps Script bridge.
- Production Worker release remains an explicit manual operation through `.github/workflows/worker-production.yml` from `master`.

## Local Validation

```bash
pnpm worker:typecheck
pnpm worker:deploy:dry
pnpm test:unit
pnpm test:integration
pnpm build
pnpm quality
```

Historical M19/M20 readiness scripts remain useful as repository/evidence guards but must not be treated as the current runtime ownership source. Historical M4-M6 Preview documents record earlier migration work only. Use `docs/architecture/current-runtime-ownership.md`, `docs/architecture/production-environment-convergence-2026-08-16.md`, and `docs/deployment/runtime-deployment-guide.md` for current production boundaries.
