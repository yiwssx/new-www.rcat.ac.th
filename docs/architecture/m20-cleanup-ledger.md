# M20 Cleanup Ledger

Date: 2026-06-24

Status: cleanup in progress. M20 production cutover remains gated.

## Cleanup Scope

This cleanup removes stale legacy user-management code and synchronizes documentation with the current Cloudflare-first runtime ownership.

The cleanup does not perform production cutover.

## Files Removed

- `src/services/users.ts`
- `src/services/users.test.ts`

## Files Updated

- `src/admin/pages/LoginPage.tsx`
- `src/config/project-settings.json`
- `src/config/projectSettings.ts`
- `src/services/auth.ts`
- `src/services/auth.test.ts`
- `src/services/authRuntime.ts`
- `src/services/googleApi.ts`
- `src/test/integration/googleApi.integration.test.ts`
- `docs/architecture/m20-cleanup-runtime-ownership.md`
- `docs/architecture/m20-cleanup-ledger.md`

## Files Intentionally Retained

- `src/services/googleApi.ts`

  Retained because Apps Script is still used for the media/file bridge and Google Drive file operations. Only legacy auth and user-management wrappers were removed.

- `apps-script/`

  Retained because Apps Script still owns Google Drive bridge operations for media/file workflows.

- `cloudflare/public-api/migrations/`

  Retained because D1 migrations are historical and must not be deleted.

- `server/appsScriptProxy/`

  Retained because server-side Apps Script proxy remains part of the media bridge.

- `cloudflare/public-api/scripts/m20-readiness-gate.mjs`

  Retained because M20 production readiness remains gated.

## Legacy Paths Removed

- Direct Apps Script user-account CRUD from frontend services.
- Local bootstrap user fallback.
- Local password-hash user-account fallback.
- Legacy Apps Script credential login path.
- Legacy project settings for:
  - `authLogin`
  - `users`
  - `deleteUser`
  - `resetUsers`
  - `storageKeys.users`
  - `auth.loginPrefill`
  - `auth.bootstrapUsers`

## Legacy Paths Retained

- Apps Script media/file bridge.
- Google Drive file operations.
- Historical Apps Script architecture and migration notes, where still useful as records.
- D1 migration history.
- M19 and M20 readiness gates.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 app user profiles.
- Admin proxy session: Vercel server-side proxy.
- Media and file bridge: Apps Script behind Vercel proxy.
- File storage: Google Drive.

## RBAC Summary

### User Management

- Admin can manage other users, cannot delete self, and cannot remove the last active admin.
- Editor can edit own profile only and cannot delete self.
- Viewer can view users only.

### Content Management

- Admin can manage everything.
- Editor can manage content, documents, carousel, E-Service, media, and events.
- Editor cannot manage website settings, menu, integrations, or system configuration.
- Viewer is read-only.

## Validation Commands

Run before commit:

```bash
pnpm vitest run src/services/auth.test.ts
pnpm build
pnpm worker:m20:readiness
pnpm worker:m19:readiness
pnpm worker:typecheck
```
