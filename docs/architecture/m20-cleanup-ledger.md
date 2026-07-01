# M20 Cleanup Ledger

Date: 2026-06-24

Status: cleanup in progress. M20 production cutover remains gated.

## 2026-07-01 Follow-Up Cleanup

This follow-up keeps the existing runtime ownership unchanged while pruning unused frontend compatibility code and stale generated guidance.

### Files Removed

- `.github/copilot-instructions.md.bak`
- `src/features/cms-integrations/api.ts`
- `src/features/cms-integrations/index.ts`
- `src/services/authRuntime.ts`
- `src/shared/api/index.ts`

### Code Removed

- Unused `PublicIntroGate` local layout constant.
- Unused test callback parameter names in admin write provider tests.
- Legacy browser-side Google connection health facade:
  - `checkGoogleConnection()`
  - `IntegrationStatus`
  - frontend `projectSettings.api.resources.health`

### Evidence

- Import graph showed the removed TypeScript files had no active static importers outside historical docs.
- `rg checkGoogleConnection` and `rg IntegrationStatus` showed active references only in the removed facade/type path plus historical architecture records.
- The active Integrations page now reports Cloudflare structured-data status from provider configuration and Apps Script media bridge status from Vercel `/api/apps-script-proxy`.
- The stale `.github/copilot-instructions.md.bak` file was unreferenced and described obsolete Apps Script backend/user-service ownership.

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
