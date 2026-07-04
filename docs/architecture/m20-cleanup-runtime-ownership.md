# M20 Cleanup Runtime Ownership

Status: cleanup completed; preview field verification in progress. M20 production cutover remains gated.

M20 is not closed and production is not approved.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1 through `VITE_PUBLIC_API_PROVIDER=cloudflare` and `VITE_CLOUDFLARE_PUBLIC_API_URL`.
- Public analytics: Cloudflare Worker and D1 for site view, content view, visitor presence, and live visitor stats.
- Admin structured reads and writes: Cloudflare Worker and D1 through the configured admin write provider.
- Admin user access: Cloudflare RBAC plus D1 app user profiles in `app_admin_users`.
- Admin proxy session: Vercel server-side proxy authenticates the CMS login session and forwards role/email context to the Worker.
- Media and file bridge: Vercel `/api/apps-script-proxy` forwards authenticated media/file requests to Apps Script.
- File storage: Google Drive remains the media/document storage target behind the Apps Script media bridge.

## Admin Operation Feedback Standardization

The current CMS write-feedback standard was established by:

- `7f5f95083b5df18c5c73939bf2b1e251c3880a97` `fix(admin): make media operation results explicit`
- `8aa55b3b22dd6a121fbaa799899670766f776abb` `fix(admin): standardize operation feedback`

CMS write operations use a blocking loading modal while pending, a centered success modal requiring acknowledgment, and a centered error modal requiring acknowledgment. Final admin write results must not use short auto-dismiss success toasts.

Affected areas: Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings.

## Public UX Updates

The urgent marquee speed normalization was established by:

- `4b8f01a2162ef8de002a8c2c46c69110f7b749e2` `fix(ui): normalize marquee speed across devices`

The marquee uses measured distance and pixels per second for device-independent visual speed. Reduced-motion still slows the ticker instead of disabling it. This was a frontend-only UI change and did not require Worker, D1, or Apps Script deployment.

## Preview Field Verification Checklist

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

## Apps Script Scope

Apps Script is retained only for the Google Drive media/file bridge and related file operations.

Apps Script is no longer the active user-management backend.

The CMS Integrations page no longer uses the legacy browser-side Google connection health facade. It reports:

- Cloudflare structured-data status from the configured admin write provider.
- Apps Script media bridge readiness from Vercel `/api/apps-script-proxy`.
- Google Drive media storage readiness through the same authenticated bridge status.

Removed legacy user-management paths:

- Direct Apps Script user account CRUD from frontend services.
- Local bootstrap user fallback.
- Password-hash based local user account management.
- Legacy `VITE_GOOGLE_APPS_SCRIPT_URL` production-auth requirement for admin login.

## Admin User Profiles

Admin user profiles are stored as metadata in D1 table:

- `app_admin_users`

The table stores:

- email
- name
- role
- status
- audit metadata
- revision metadata

The table must not store:

- passwords
- password hashes
- reset tokens
- API tokens
- secrets
- production credentials

## RBAC Matrix

### User Management

| Role   | Permission                                                                                 |
| ------ | ------------------------------------------------------------------------------------------ |
| admin  | Can manage other users, cannot delete self, cannot remove or disable the last active admin |
| editor | Can edit own profile only, cannot delete self, cannot change role or status                |
| viewer | Can view the user list only                                                                |

### Content And Admin Data

| Role   | Permission                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| admin  | Can manage all content, media, settings, menu, integrations, and users                                                                             |
| editor | Can manage content, documents, carousel, E-Service, media, and events; cannot manage website settings, menu, integrations, or system configuration |
| viewer | Read-only reviewer before publish; cannot create, update, delete, upload, or publish                                                               |

## Active Environment Variables

### Vercel Admin Proxy

- `ADMIN_PROXY_ALLOWED_EMAILS`
- `ADMIN_PROXY_PASSWORD_HASH`
- `ADMIN_PROXY_SESSION_SECRET`
- `ADMIN_RBAC_ADMINS`
- `ADMIN_RBAC_EDITORS`
- `ADMIN_RBAC_VIEWERS`
- `CLOUDFLARE_ADMIN_API_URL`
- `CLOUDFLARE_ADMIN_SMOKE_TOKEN`

### Cloudflare Worker

- `ADMIN_RBAC_ADMINS`
- `ADMIN_RBAC_EDITORS`
- `ADMIN_RBAC_VIEWERS`
- `ADMIN_WRITE_ACCESS_TEAM_DOMAIN`
- `ADMIN_WRITE_ACCESS_AUD`
- `ADMIN_WRITE_ALLOWED_EMAILS`
- `ADMIN_WRITE_ALLOWED_ORIGINS`
- `ADMIN_WRITE_PREVIEW_ENABLED`
- `ADMIN_WRITE_AUTH_MODE`
- `DB`

### Apps Script Media Bridge

- `GOOGLE_APPS_SCRIPT_URL` or `APPS_SCRIPT_WEB_APP_URL`
- `APPS_SCRIPT_BRIDGE_TOKEN`

Do not expose bridge URLs or bridge tokens through `VITE_` variables. `VITE_GOOGLE_APPS_SCRIPT_URL` is not server runtime configuration and must not be restored for the media bridge.

## Required D1 Migrations

Required historical and current migrations must be retained.

Current M20-related migrations include:

- `cloudflare/public-api/migrations/0006_m20_visitor_presence.sql`
- `cloudflare/public-api/migrations/0007_admin_user_profiles.sql`

Do not delete old migrations.

## Removed Or No-Op Paths

- Public analytics no longer falls back to direct Apps Script calls when the public provider is not Cloudflare.
- Public site-view, content-view, and presence calls become safe no-ops outside Cloudflare provider mode.
- The Vercel Apps Script media bridge no longer reads `VITE_GOOGLE_APPS_SCRIPT_URL` as server configuration.
- Admin user management no longer uses direct Apps Script user CRUD.
- The legacy browser-side `checkGoogleConnection()` integrations health mapper is removed from the frontend.

## Safety State

- M19 remains closed.
- M20 production execution remains gated.
- This cleanup does not approve production cutover.
- This cleanup does not mutate Cloudflare, Vercel, Apps Script, Google Drive, D1, or production runtime.
- No secrets, real tokens, real D1 ids, real Access AUD values, or private credentials belong in this document.
