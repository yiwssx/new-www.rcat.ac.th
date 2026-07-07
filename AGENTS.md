# Agent Notes

This project is a React/Vite public website and CMS for Roi-Et College of Agriculture and Technology.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side admin proxy.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive behind the Apps Script media/file bridge.

## Current Project Status

M20 is closed for migration/runtime ownership. M21 owns remaining UI/UX and logic stabilization.

M20 closure is limited to migration, runtime ownership, and domain cutover scope. It does not mean the UI/UX is complete, the system is defect-free, or all business workflows are final. Remaining public, admin, workflow, validation, layout, Thai wording, and user-facing error issues are tracked under M21. Do not restore browser-side direct Apps Script structured reads/writes. Apps Script is retained only for media/file bridge and Google Drive operations.

## Admin Operation Feedback Standard

Admin write operations use:

- blocking loading modal while pending
- centered success modal requiring acknowledgment
- centered error modal requiring acknowledgment
- no short auto-dismiss toast for final admin write results

The standard applies to Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings.

## Keep

- Cloudflare Worker and D1 runtime paths.
- Vercel admin proxy paths.
- Apps Script media/file bridge.
- Google Drive file storage bridge.
- D1 migration history.
- M19 and M20 readiness records.
- M21 UI/UX and logic stabilization tracking.
- Sigmap AI helper workflow.

## Do Not Restore

- Legacy Apps Script user-management backend.
- Direct frontend Apps Script user CRUD.
- Local bootstrap user fallback.
- Local password-hash user-account fallback.
- Legacy Apps Script credential login path.

## Safety Rules

- Do not commit real secrets, tokens, D1 IDs, Access AUD values, private credentials, or production-only identifiers.
- Do not mutate production Cloudflare, Vercel, Apps Script, Google Drive, D1, or DNS unless explicitly requested.
- Keep D1 migrations append-only.
- Keep Apps Script scoped to media/file bridge operations.
- Prefer small, scoped commits.

## Sigmap Workflow

Use sigmap for repository-aware AI assistance when available.

Common commands:

```bash
pnpm ai:ask
pnpm ai:validate
pnpm ai:map
```
