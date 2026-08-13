# Apps Script Media/File Bridge

Updated: 2026-08-13.

This Apps Script project is retained only for media/file bridge operations and Google Drive file access.

M20 structured-data migration/cutover scope is closed. Apps Script is not the current structured public/admin data backend and is not the current user-management backend.

## Current Scope

Apps Script is used for:

- media metadata upsert operations required by the bridge;
- media delete operations;
- resumable media upload start/chunk/status operations;
- Google Drive file access and upload/delete workflows behind the Vercel proxy.

## Active Web App Routes

`GET` with no resource returns a bridge health/scope response. Active authenticated `POST` resources are:

- `media`
- `media-delete`
- `media-upload-start`
- `media-upload-chunk`
- `media-upload-status`

These names are defined by `MEDIA_BRIDGE_RESOURCES` in `apps-script/Code.gs`. The Vercel media bridge remains the browser-facing boundary; the browser must not receive bridge tokens or call the private bridge endpoint directly.

Structured data routes were removed from Apps Script source. Requests such as `snapshot`, `public-home`, `content`, `users`, `menu`, `site-settings`, `homepage-settings`, `visitor-stats`, and `publish` must remain unavailable from this project and remain owned by Cloudflare Worker and D1.

Apps Script must not be restored as:

- frontend credential login backend;
- direct frontend user-management backend;
- local bootstrap user fallback;
- password-hash user-account fallback;
- public/admin structured CMS backend.

## Runtime Ownership

Current active runtime ownership:

- Public structured reads and analytics: Cloudflare Worker + D1.
- Admin structured reads and writes: Cloudflare Worker + D1.
- CMS identity/session/RBAC/MFA lifecycle: Cloudflare Worker + D1 through Vercel same-origin proxies.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive.

Apps Script no longer owns spreadsheet-backed CMS records, user profiles, public snapshots, public analytics counters, settings, menu, content, documents, carousel, E-Service, or calendar structured data.

## Deployment Notes

A Vercel deploy does not deploy Apps Script.

When Apps Script media/file bridge code changes:

1. Push Apps Script source.
2. Create a new Apps Script version.
3. Update the intended Web App deployment.
4. Confirm the Web App URL remains the intended bridge URL.
5. Confirm the server-side bridge environment still points to the intended deployment.
6. Smoke-test metadata update/delete and resumable upload start/chunk/status paths through the Vercel bridge.

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
- Keep bridge logs free of upload keys, bearer/OAuth tokens, private Google API URLs, and other credentials.
