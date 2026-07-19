# M20 Cleanup Ledger

Date: 2026-06-24

Status: M20 migration/runtime/domain-cutover scope is closed.

M20 is closed for migration/runtime ownership. M21 owns remaining UI/UX and logic stabilization.

M20 closure is limited to migration, runtime ownership, and domain cutover scope. It does not mean the UI/UX is complete, the system is defect-free, or all business workflows are final.

## 2026-07-07 M20 Migration Runtime Closure

### Closure Note

- The custom domain `www.rcat.ac.th` is connected to the Vercel production deployment.
- The Cloudflare/Vercel redirect loop was resolved at the provider configuration layer.
- Cloudflare Worker allowed origins include the production custom domain.
- Cloudflare Worker and D1 own structured public and admin data.
- Apps Script remains only the media/file bridge for Google Drive file operations.
- No D1 migration blocker remains for M20 migration/runtime ownership.
- No Apps Script structured-data blocker remains.
- No runtime ownership blocker remains.

### M21 Handoff

Remaining UI/UX, business logic, workflow, usability, validation, layout, content-presentation, Thai wording, and user-facing error issues move to `docs/architecture/m21-ui-ux-logic-stabilization.md`.

## 2026-07-07 Apps Script Active Source Prune

This pass pruned the active `apps-script/` deployment source to the retained media/file bridge only. M20 is now closed separately by the migration/runtime/domain closure note above.

### Removed From Active Apps Script Source

- Legacy structured public/admin routes:
  - `auth-login`
  - `snapshot`
  - `public-home`
  - `public-content-list`
  - `public-document-list`
  - `public-program-list`
  - `public-search-index`
  - `content`
  - `content-delete`
  - `document`
  - `document-delete`
  - `carousel`
  - `carousel-delete`
  - `external-service`
  - `external-service-delete`
  - `event`
  - `event-delete`
  - `publish`
  - `menu`
  - `display-settings`
  - `site-settings`
  - `homepage-settings`
  - `visitor-stats`
  - `users`
  - `users-delete`
  - `users-reset`
- Spreadsheet-backed structured CMS helpers, public cache helpers, legacy Apps Script user/auth helpers, menu helpers, site settings helpers, visitor stats helpers, and document-specific CMS helpers.
- Apps Script manifest scopes for spreadsheets, Google Docs, and external requests. The retained active bridge uses Google Drive.

### Remaining Apps Script Scope

- `doGet` status response with no structured data.
- `POST ?resource=media` for Drive upload/update metadata normalization.
- `POST ?resource=media-delete` for Drive file trashing.
- Apps Script bridge token validation with server-provided `APPS_SCRIPT_BRIDGE_TOKEN` or `MEDIA_BRIDGE_TOKEN`.
- Script property access for bridge token and Drive folder configuration.
- Drive folder resolution/creation for the managed media folder.
- Upload MIME/size validation, Drive file creation, public Drive URL normalization, and media response normalization.
- Script lock protection around media mutations.

### Frontend/Proxy Contract

- `server/appsScriptProxy/` remains scoped to browser/admin `media` -> Apps Script `media` and `deleteMedia` -> Apps Script `media-delete`.
- Media delete now sends the media asset Drive `fileId` when available so Apps Script no longer needs a spreadsheet media lookup to trash the Drive file.
- Cloudflare Worker and D1 remain source of truth for public/admin structured data and media metadata persistence.

### Tests Updated

- `src/test/appsScriptCode.test.ts` now guards the media-only Apps Script route contract and verifies structured resources are rejected.
- Removed legacy Apps Script tests that asserted spreadsheet-backed CMS/cache/documents/site settings/visitor stats ownership.
- `server/appsScriptProxy/handler.test.mjs` verifies structured resources are rejected by the Vercel proxy allowlist.
- `src/features/cms-media/mediaBridgeClient.test.ts` verifies delete payloads include the Drive `fileId` when available.

### Intentionally Retained

- `apps-script/` and `package.json` `gas:*` scripts, because the media/file bridge still needs clasp deployment.
- `server/appsScriptProxy/`, because Vercel remains the server-side bridge to Apps Script media/file operations.
- Cloudflare Worker source and D1 migrations, unchanged in this pass.
- M20 readiness docs and runbooks, because they remain the migration/runtime/domain closure record.

## 2026-07-04 Project-Wide Documentation Synchronization

This pass synchronizes active project documentation with the current runtime truth after the Apps Script structured-data cleanup, urgent marquee speed fix, media operation feedback fix, and broader admin operation feedback standardization.

### Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin CMS session/proxy: Vercel server-side proxy.
- Media/file bridge: Vercel `/api/apps-script-proxy` to Apps Script.
- File storage: Google Drive behind the Apps Script media/file bridge.

### Admin Operation Feedback Standardization

The current admin write feedback standard was completed by:

- `7f5f95083b5df18c5c73939bf2b1e251c3880a97` `fix(admin): make media operation results explicit`
- `8aa55b3b22dd6a121fbaa799899670766f776abb` `fix(admin): standardize operation feedback`

Admin write operations now use:

- blocking loading modal while pending
- centered success modal requiring acknowledgment
- centered error modal requiring acknowledgment
- no short auto-dismiss toast for final admin write results

Affected areas: Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings.

### Public UX Updates

The urgent marquee speed consistency fix was completed by:

- `4b8f01a2162ef8de002a8c2c46c69110f7b749e2` `fix(ui): normalize marquee speed across devices`

Current behavior:

- visual marquee speed is device-independent
- animation duration is calculated from measured travel distance and pixels per second
- reduced-motion still slows the ticker instead of disabling it
- no Worker, D1, or Apps Script change was required

### M21 Stabilization Handoff Checklist

- [ ] public home
- [ ] marquee
- [ ] carousel
- [ ] menu
- [ ] content/news/announcements
- [ ] documents
- [ ] E-Service
- [ ] calendar
- [ ] media upload/delete
- [ ] admin content save/publish/delete
- [ ] settings save
- [ ] mourning mode
- [ ] visitor stats / Who's Online
- [ ] user management
- [ ] Apps Script media bridge status
- [ ] Cloudflare public/admin structured status

### Stale Guidance Handling

- Active docs now distinguish Cloudflare Worker/D1 structured data from the retained Apps Script media/file bridge.
- Historical checkpoint docs are retained as history. Where they still describe obsolete active runtime ownership, they should be read with the current runtime ownership above and the M20 closure note.
- `VITE_GOOGLE_APPS_SCRIPT_URL` must not be used as server runtime config. Media bridge deployments use server-only `GOOGLE_APPS_SCRIPT_URL` or `APPS_SCRIPT_WEB_APP_URL` plus `APPS_SCRIPT_BRIDGE_TOKEN`.

## 2026-07-02 Final Dead-Code Cleanup

This pass removed the no-op admin progress runtime surface left behind after the Apps Script structured-data adapter was removed. M20 is now closed separately by the migration/runtime/domain closure note above.

### Files Removed

- `src/admin/components/AdminActionProgress.tsx`
- `src/shared/api/activity.ts`

### Code Removed

- `AdminActionProgress` lazy import from `src/routeComponents.tsx`.
- `AdminActionProgressBoundary` from `src/routeComponents.tsx`.
- Root route rendering of the admin action progress boundary.
- The no-op API activity facade whose `getApiActivityCount()` always returned `0` and whose `subscribeApiActivity()` never emitted updates.

### Test Script Audit

- `src/test/integration/` still contains `router-auth.integration.test.tsx`.
- `test:integration`, `test:all`, and `quality` remain because the integration script is not empty.
- No `--passWithNoTests` fallback was added.

### Evidence

- `src/test/adminInformationArchitecture.test.ts` now guards against reintroducing the deleted admin progress files and route wiring.
- Active source grep showed no remaining imports for:
  - `AdminActionProgress`
  - `shared/api/activity`
  - `services/googleApi`
  - `cms-integrations`
  - `authRuntime`
  - `VITE_GOOGLE_APPS_SCRIPT_URL`

### Intentionally Retained

- `apps-script/`

  Retained for the Apps Script media/file bridge and clasp deployment workflow.

- `server/appsScriptProxy/`

  Retained as the Vercel server-side bridge for Apps Script media/file operations.

- `package.json` `gas:*` scripts

  Retained because the Apps Script media bridge still needs clasp-based deployment commands.

- `cloudflare/public-api/migrations/`

  Retained because D1 migration history remains append-only.

- M20 readiness docs and runbooks

  Retained because they remain the migration/runtime/domain closure record.

## 2026-07-01 Apps Script Surface Trim

This pass removes the remaining active browser-side Apps Script structured-data adapter while keeping the Apps Script media/file bridge intact.

### Files Removed

- `src/services/googleApi.ts`
- `src/test/integration/googleApi.integration.test.ts`
- `src/test/siteViewTracking.test.ts`
- `src/features/cms-integrations/types.ts`

### Code Removed

- Browser-side Apps Script structured public reads for:
  - public home
  - public content list/detail
  - public documents
  - public programs
  - public search
  - public aggregate CMS snapshot
- Browser-side Apps Script structured admin reads/writes for:
  - dashboard snapshot
  - content
  - documents
  - carousel
  - external services
  - events
  - menu
  - display/site/homepage settings
  - visitor stats settings mutation
- Active runtime config keys for direct browser Apps Script:
  - `projectSettings.api.googleAppsScriptUrl`
  - `projectSettings.api.googleAppsScriptUrlEnv`
  - `projectSettings.api.resources.*`
  - `VITE_GOOGLE_APPS_SCRIPT_URL`

### Code Moved

- Feature input contracts moved out of `src/services/googleApi.ts` into owning feature type files:
  - `CalendarEventInput`
  - `CarouselSlideInput`
  - `DocumentItemInput`
  - `ExternalServiceLinkInput`
  - `MediaAssetInput`
- The admin progress activity facade now lives independently in `src/shared/api/activity.ts` instead of re-exporting Google API activity state.

  Superseded on 2026-07-02: the independent activity facade was removed after confirming it was a no-op with no active request producer.

### Evidence

- `src/test/adminInformationArchitecture.test.ts` now guards active browser structured-data wrappers against `services/googleApi`, `getGoogleAppsScriptUrl`, `VITE_GOOGLE_APPS_SCRIPT_URL`, and `FromAppsScript` references.
- `rg` showed no active source imports for `services/googleApi`, `cms-integrations`, `authRuntime`, `services/users`, or browser-side Apps Script structured read/write fallbacks after the cleanup.
- Public and admin feature wrappers now call Cloudflare Worker APIs directly for structured data.
- Historical implementation note: `scripts/generate-sitemap.mjs` previously enriched a build-time sitemap and fell back to static routes. Commit `80324e7` superseded that path: Vercel now serves `/sitemap.xml` through `api/sitemap.mjs` using live Cloudflare public API data; the old script remains tracked but unreferenced.

### Intentionally Retained

- `apps-script/`

  Retained for the media/file bridge and Google Drive file operations.

- `server/appsScriptProxy/`

  Retained as the Vercel server-side media/file proxy. Its allowlist remains scoped to `media` and `deleteMedia`.

- `src/features/cms-media/mediaBridgeClient.ts`

  Retained as the active frontend client for `/api/apps-script-proxy` media upload/delete operations.

- `cloudflare/public-api/migrations/`

  Retained because D1 migration history is append-only.

- Historical architecture and release records

  Retained unless clearly obsolete active guidance was updated.

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

  Retained only during the initial legacy user cleanup because media bridge typing still depended on it at that point. It was removed in the 2026-07-01 Apps Script surface trim above after media bridge types moved to `src/features/cms-media/types.ts`.

- `apps-script/`

  Retained because Apps Script still owns Google Drive bridge operations for media/file workflows.

- `cloudflare/public-api/migrations/`

  Retained because D1 migrations are historical and must not be deleted.

- `server/appsScriptProxy/`

  Retained because server-side Apps Script proxy remains part of the media bridge.

- `cloudflare/public-api/scripts/m20-readiness-gate.mjs`

  Retained because they remain the migration/runtime/domain closure record.

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
- M19 and M20 readiness records.
- M21 UI/UX and logic stabilization tracking.

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
