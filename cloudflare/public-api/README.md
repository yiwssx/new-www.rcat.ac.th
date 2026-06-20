# RCAT Public API Worker

This isolated Cloudflare Worker is the replacement system's D1-backed public-read and preview structured-admin API. Apps Script remains the production provider and the Google Drive media-file bridge. No production cutover is authorized by this directory.

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

Preview-gated structured admin routes include:

- snapshot, content, documents, home sections, and visitor daily stats from M18
- site, homepage, and display settings
- menu
- carousel slides
- external services
- calendar events

All admin routes use the existing M18 authentication, allowlisted-origin CORS, preview enablement, and production-context block. Production admin writes remain disabled.

## Provider Behavior

The frontend defaults remain:

- `VITE_PUBLIC_API_PROVIDER`: Apps Script unless explicitly set to `cloudflare`
- `VITE_ADMIN_WRITE_PROVIDER`: Apps Script unless the existing Cloudflare-first preview and admin authentication gates all pass

The public provider now covers documents, home, content list/detail, search, and programs. The admin provider covers the structured resources listed above. Removing the explicit provider values returns calls to Apps Script.

Media upload/delete and visitor analytics settings mutation intentionally remain Apps Script-backed. The Worker reads D1 media metadata references but does not perform Google Drive binary operations.

## D1 Migrations

Ordered migrations are in `migrations/`:

- `0001`: base public-read and shared metadata schema
- `0002`: grouped public-read foundation
- `0003`: M18 write metadata and audit table
- `0004`: M18 parser-safe lifecycle audit triggers
- `0005`: M19 settings/menu/carousel/service/event actor, revision, and audit hardening

Migration `0005` is repository code only until a separately approved non-production execution. No production migration or binding is included.

## Safety Boundary

- Do not commit real D1 identifiers, account identifiers, credentials, live endpoints, or real records.
- Do not apply migrations, seed data, or imports to production from normal test/build flows.
- Do not deploy the Worker or mutate Vercel as part of repository validation.
- Keep Apps Script as production fallback until a future approved gate.
- Keep Google Drive binary operations in the approved Apps Script bridge.
- Keep M20 blocked until M19 external operator blockers are resolved.

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

M20 is not started. It remains a future controlled production cutover preparation/gate and must not execute until those external blockers are approved and recorded safely.
