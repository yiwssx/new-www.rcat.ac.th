# Google Apps Script Backend

This folder contains the zero-cost backend for the React CMS. It exposes a web app endpoint that the frontend calls through `VITE_GOOGLE_APPS_SCRIPT_URL`.

## What It Provides

- `GET ?resource=snapshot` returns dashboard metrics, content, media, and events.
- `GET ?resource=health` checks the spreadsheet connection.
- `GET ?resource=menu` returns the public website menu tree.
- `GET ?resource=content-detail&id=...` or `&slug=...` returns full content body from Google Docs.
- `POST ?resource=auth-login` authenticates a CMS user and returns a signed session token.
- `POST ?resource=content` creates or updates one content item.
- `POST ?resource=content-delete` deletes one content item.
- `POST ?resource=media` creates or updates one media item.
- `POST ?resource=media-delete` deletes one media item and moves its Drive file to trash when possible.
- `POST ?resource=event` creates or updates one calendar event.
- `POST ?resource=event-delete` deletes one calendar event.
- `POST ?resource=publish` marks one content item as published.
- `POST ?resource=menu` replaces the public website menu tree.
- `POST ?resource=users` with `{ "action": "list", "authToken": "..." }` returns CMS user accounts for authenticated admins.
- `POST ?resource=users` creates or updates one CMS user account for authenticated admins.
- `POST ?resource=users-delete` deletes one CMS user account.
- `POST ?resource=users-reset` restores the default admin user account.

The data source is a Google Sheet with these tabs:

- `Content`
- `Media`
- `Events`
- `Menu`
- `Users`
- `Settings`

Backend configuration is now property-driven. Runtime settings are read from Apps Script
Script Properties instead of hard-coded values in `Code.gs`.

## Setup

1. Open [script.google.com](https://script.google.com/) and create a new project.
2. Copy all `.gs` files from this folder into the Apps Script editor:
   - `Config.gs`
   - `ScriptProperties.gs`
   - `Code.gs`
   - `Cms.gs`
   - `Cache.gs`
   - `Menu.gs`
   - `Users.gs`
   - `Storage.gs`
   - `HttpUtils.gs`
3. Open Project Settings, enable `Show appsscript.json manifest file in editor`, then copy `appsscript.json` into the manifest file.
4. Open Project Settings > Script Properties and optionally set:
   - `publicSiteUrl`
   - `spreadsheetName`
   - `rootFolderName`
   - `mediaFolderName`
   - `docsFolderName`
   - `authSessionHours` (token lifetime, default `8`)
5. Set secure admin bootstrap Script Properties (required if you want automatic first admin creation):
   - `defaultAdminName` (optional display name)
   - `defaultAdminEmail` (required for bootstrap)
   - `defaultAdminPasswordHash` (required for bootstrap)
   - Use `createPasswordHash("your-password")` in Apps Script editor to generate a `sha256$...` hash value.
6. Optional: set `authTokenSecret` manually. If omitted, the script auto-generates one on first request.
7. Never commit real admin email/password hashes to source control.
8. Select the `setupCmsBackend` function and click Run.
9. Approve the requested Google permissions.
10. Keep the returned `spreadsheetUrl` for direct Sheet inspection when needed.
11. Run `setupCmsBackend` again after schema upgrades so new columns are added without deleting existing rows.

`setupCmsBackend` creates required sheets/folders.
If `defaultAdminEmail` and `defaultAdminPasswordHash` are configured in Script Properties,
it also seeds one admin user in `Users`.
It does not seed sample content/media/events/menu rows. Add real records through the CMS or Sheet.
Media uploads sent to `POST ?resource=media` are stored in the folder configured by `driveFolderId`
(`mediaFolderName`, default `RCAT_MEDIA_STUFF`).
Content body text is stored in Google Docs under `docsFolderId` (`docsFolderName`, default `RCAT_CONTENTS`), and
the Sheet stores document links instead of long body text.

## Deploy Web App

1. Click Deploy > New deployment.
2. Select type `Web app`.
3. Set Execute as to `Me`.
4. Set Who has access to `Anyone`.
5. Click Deploy.
6. Copy the Web app URL. It looks like:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

## Connect The React App

Create `.env.local` in the project root:

```bash
VITE_CMS_SITE_NAME="RCAT CMS"
VITE_GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
VITE_PUBLIC_SITE_URL="https://preview-placeholder.example.invalid"
```

Restart Vite:

```bash
pnpm dev
```

On this Windows machine, use `pnpm.cmd dev` if PowerShell blocks the pnpm script shim.

## Test The Endpoint

Open this URL in a browser:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?resource=health
```

Expected result:

```json
{
  "ok": true,
  "hasSpreadsheet": true,
  "hasDriveFolder": true,
  "hasDocsFolder": true,
  "timestamp": "2026-04-23T00:00:00.000Z",
  "statusCode": 200
}
```

Then test content:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?resource=snapshot
```

## Updating The Script

After editing Apps Script code:

1. Click Deploy > Manage deployments.
2. Edit the active web app deployment.
3. Choose New version.
4. Click Deploy.
5. Keep the same Web app URL in `.env.local`.

## Security Notes

This backend now enforces signed server tokens for protected routes:

- `POST` write routes require a valid token.
- Admin-only routes (`users`, `users-delete`, `users-reset`) require admin role in a verified token.
- User listing is only available through `POST ?resource=users` with `{ "action": "list", "authToken": "..." }`.
- Password hashes are never returned from user listing responses.
- Login attempts are rate-limited per email via Apps Script cache.
- Public `GET` routes do not read `authToken` from query parameters.
- Public `snapshot` responses are limited to published/public records. Use `POST ?resource=snapshot-admin` for authenticated admin reads.

For production school data, still review:

- Drive sharing policies for uploaded files and docs.
- Script deployment access level in `appsscript.json`.
- Password rotation/reset process for admin bootstrap credentials.
