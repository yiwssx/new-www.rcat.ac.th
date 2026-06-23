# M20 Cleanup Runtime Ownership

Status: field-verification cleanup only. M20 is not closed and this is not a production final cutover.

## Active Runtime Paths

- Public structured reads: Cloudflare Worker and D1 through `VITE_PUBLIC_API_PROVIDER=cloudflare` and `VITE_CLOUDFLARE_PUBLIC_API_URL`.
- Public analytics: Cloudflare Worker and D1 only for site view, content view, visitor presence, and live visitor stats.
- Admin structured reads and writes: Cloudflare Worker and D1 through the configured admin write provider.
- Media and file bridge: Vercel `/api/apps-script-proxy` forwards authenticated media requests to Apps Script.
- File storage: Google Drive remains the media storage target behind the Apps Script media bridge.

## Legacy Paths Retained

- Apps Script source remains for the media bridge and Google Drive file operations.
- Legacy user management may still use the direct Apps Script client until user administration is migrated.
- Legacy direct-browser Apps Script configuration is retained only for compatibility tests and explicitly labeled legacy paths.

## Removed Or No-Op Paths

- Public analytics no longer falls back to direct Apps Script calls when the public provider is not Cloudflare.
- Public site-view, content-view, and presence calls become safe no-ops outside Cloudflare provider mode.
- The Vercel Apps Script media bridge no longer reads `VITE_GOOGLE_APPS_SCRIPT_URL` as server configuration.

## Required Environment Variables

Frontend public Cloudflare field verification:

- `VITE_PUBLIC_API_PROVIDER=cloudflare`
- `VITE_CLOUDFLARE_PUBLIC_API_URL=<worker origin>`

Vercel Apps Script media bridge:

- `GOOGLE_APPS_SCRIPT_URL=<Apps Script /exec URL>` or `APPS_SCRIPT_WEB_APP_URL=<Apps Script /exec URL>`
- `APPS_SCRIPT_BRIDGE_TOKEN=<server-only bridge token>`

Do not expose the bridge token through a `VITE_` variable.

## Required D1 Migrations

Live visitor presence requires:

- `cloudflare/public-api/migrations/0006_m20_visitor_presence.sql`

If the migration is missing, `/api/public/presence` and `/api/public/visitor-stats` return the safe diagnostic:

- `diagnostic: "visitor-presence-schema-missing-v1"`
- `suggestedMigration: "run 0006_m20_visitor_presence.sql"`

The public frontend keeps the latest snapshot values and backs off live polling/presence writes instead of breaking page rendering.
