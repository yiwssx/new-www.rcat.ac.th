# Apps Script Media/File Bridge

This Apps Script project is retained only for media/file bridge operations and Google Drive file access.

Current status: cleanup completed; preview field verification in progress. M20 production cutover remains gated.

Apps Script is not the current structured public/admin data backend and is not the current user-management backend.

## Current Scope

Apps Script is used for:

- media upload/update operations
- media delete operations
- Google Drive file access
- upload/delete workflows behind the Vercel proxy

## Active Web App Routes

The active Apps Script deployment source is pruned to these routes only:

- `POST ?resource=media`
- `POST ?resource=media-delete`

Structured data routes were removed from Apps Script source. Requests such as `snapshot`, `public-home`, `content`, `users`, `menu`, `site-settings`, `homepage-settings`, `visitor-stats`, and `publish` must be rejected by Apps Script and must remain owned by Cloudflare Worker and D1.

The Vercel proxy keeps the public contract narrow:

- browser/admin client `media` -> Apps Script `media`
- browser/admin client `deleteMedia` -> Apps Script `media-delete`

Apps Script must not be restored as:

- frontend credential login backend
- direct frontend user-management backend
- local bootstrap user fallback
- password-hash user-account fallback

## Runtime Ownership

Current active runtime ownership:

- Public structured reads: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side admin proxy.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive.

Apps Script no longer owns spreadsheet-backed CMS records, user profiles, public snapshots, public analytics counters, settings, menu, content, documents, carousel, E-Service, or calendar data.

## Deployment Notes

A Vercel deploy does not deploy Apps Script.

When Apps Script media/file bridge code changes:

1. Push Apps Script source.
2. Create a new Apps Script version.
3. Update the intended Web App deployment.
4. Confirm the Web App URL remains the intended bridge URL.
5. Confirm the server-side bridge environment still points to the intended deployment.

Use the deployment checklist:

- `docs/deployment/apps-script-deployment-checklist.md`

## Required Server-Side Bridge Configuration

Configure these outside the repository:

- `GOOGLE_APPS_SCRIPT_URL` or `APPS_SCRIPT_WEB_APP_URL`
- `APPS_SCRIPT_BRIDGE_TOKEN`

Do not expose bridge URLs or bridge tokens through `VITE_` variables. `VITE_GOOGLE_APPS_SCRIPT_URL` must not be restored as server runtime configuration.

## Safety Rules

- Do not commit real Apps Script deployment URLs for private environments.
- Do not commit bridge tokens, spreadsheet IDs, private Drive URLs, or private configuration values.
- Do not reintroduce Apps Script user-management routes as the active admin runtime.
- Do not reintroduce Apps Script structured CMS routes as the active public/admin runtime.
- Do not assume Vercel deployment updates Apps Script.
