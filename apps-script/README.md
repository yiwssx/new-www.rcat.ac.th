# Apps Script Media/File Bridge

This Apps Script project is retained only for media/file bridge operations and Google Drive file access.

Apps Script is not the current user-management backend.

## Current Scope

Apps Script is used for:

- media/file operations
- Google Drive file access
- upload/delete/list workflows behind the Vercel proxy

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

Do not expose bridge tokens through `VITE_` variables.

## Safety Rules

- Do not commit real Apps Script deployment URLs for private environments.
- Do not commit bridge tokens, spreadsheet IDs, private Drive URLs, or private configuration values.
- Do not reintroduce Apps Script user-management routes as the active admin runtime.
- Do not assume Vercel deployment updates Apps Script.
