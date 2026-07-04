# RCAT Public API Worker

This isolated Cloudflare Worker is the D1-backed public-read, public analytics, and structured-admin API. Apps Script remains only for the server-side media/file bridge to Google Drive. No production mutation or cutover is authorized by this directory.

Current status: cleanup completed; preview field verification in progress. M20 production cutover remains gated.

## M19 Current Surface

Public GET routes:

- `/health`
- `/api/health`
- `/api/public/documents`
- `/api/public/home`
- `/api/public/content?kind=<news|announcements|blog>`
- `/api/public/content/:identifier`
- `/api/public/search`
- `/api/public/programs`
- `/api/public/visitor-stats`

Public responses preserve the current React snapshot shapes. M17 compatibility fields remain where earlier smoke contracts used them. Public routes remain GET/OPTIONS-only and never receive credentialed wildcard CORS.

Structured admin routes include:

- snapshot, content, documents, home sections, and visitor daily stats from M18
- site, homepage, and display settings
- menu
- carousel slides
- external services
- calendar events

All admin routes use the existing authentication, allowlisted-origin CORS, and production-context safety checks.

## Provider Behavior

The frontend runtime paths are:

- Public structured reads: Cloudflare Worker and D1.
- Public analytics: Cloudflare Worker and D1.
- Admin structured reads/writes: Cloudflare Worker and D1, reached directly in Access mode or through the Vercel admin proxy.
- Media upload/delete bytes and Google Drive file operations: Apps Script behind the Vercel media/file bridge.

The frontend no longer uses direct browser Apps Script structured-data reads or writes. The Worker reads and writes D1 media metadata references but does not perform Google Drive binary operations.

## D1 Migrations

Ordered migrations are in `migrations/`:

- `0001`: base public-read and shared metadata schema
- `0002`: grouped public-read foundation
- `0003`: M18 write metadata and audit table
- `0004`: M18 parser-safe lifecycle audit triggers
- `0005`: M19 settings/menu/carousel/service/event actor, revision, and audit hardening
- `0006`: M20 visitor presence schema
- `0007`: M20 admin user profile metadata

Migrations remain append-only. No production migration or binding mutation is included in repository validation.

## Safety Boundary

- Do not commit real D1 identifiers, account identifiers, credentials, live endpoints, or real records.
- Do not apply migrations, seed data, or imports to production from normal test/build flows.
- Do not deploy the Worker or mutate Vercel as part of repository validation.
- Keep Apps Script scoped to the approved media/file bridge.
- Keep Google Drive binary operations in the approved Apps Script bridge.
- M20 preview field verification may proceed only within the approved preview boundary; final production cutover remains gated.

## Local Validation

```bash
pnpm worker:typecheck
pnpm worker:deploy:dry
pnpm worker:m19:readiness
pnpm test:unit
pnpm test:integration
pnpm build
pnpm quality
```

`pnpm worker:m19:readiness` reads repository files only. `REPOSITORY_READY` means repository-owned M19 remediation is present; it does not prove production data parity, production identity approval, external migration, deployment, monitoring, rollback, or cutover readiness.

## M19 And M20

M19 is closed for repository-owned parity remediation. The remaining blockers are external operator decisions and evidence for identity/RBAC, sanitized data reconciliation, media bridge recovery, production resources, monitoring, rollback, and cutover authority.

M20 cleanup is completed enough for preview field verification. Do not close M20, claim production approval, or mutate production resources until a later operator decision approves final production cutover.
