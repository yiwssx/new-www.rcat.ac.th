# Environment Variables

This Vite app only exposes browser-readable variables whose names start with `VITE_`.

Treat every `VITE_` value as public because it can be bundled into client JavaScript.

Do not commit real environment values, deployment URLs for private environments, tokens, passwords, cookies, service account data, Access AUD values, D1 IDs, or any other secret material.

## Vercel Build Toolchain

The repository contract is Node `22.x` (exact local/CI pin `22.23.1`) and pnpm `10.34.5`. Vercel uses `engines.node` for Node selection. To make Vercel honor the exact `packageManager` pin through Corepack, configure the non-secret build variable `ENABLE_EXPERIMENTAL_COREPACK=1`; do not replace the frozen-lockfile install with a permissive install command.

## Public Frontend Variables

| Variable                          | Purpose                                                                                                   | Required                                            | Notes                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `VITE_CMS_SITE_NAME`              | Public CMS/site display name override.                                                                    | Optional                                            | Use only when a deployment needs a name different from `src/config/project-settings.json`.      |
| `VITE_PUBLIC_SITE_URL`            | Canonical public site URL used by browser links and metadata; also accepted as a server sitemap fallback. | Optional                                            | Prefer server-only `PUBLIC_SITE_URL` for the runtime sitemap function.                          |
| `VITE_PUBLIC_API_PROVIDER`        | Selects the public structured-data provider.                                                              | Required for Cloudflare-backed deployments          | Use `cloudflare` for the current Cloudflare Worker/D1 public read path.                         |
| `VITE_CLOUDFLARE_PUBLIC_API_URL`  | Cloudflare Worker public API origin.                                                                      | Required when `VITE_PUBLIC_API_PROVIDER=cloudflare` | Must be a public Worker origin. Do not include secrets.                                         |
| `VITE_ADMIN_WRITE_PROVIDER`       | Selects the admin structured write provider.                                                              | Required for Cloudflare-backed admin verification   | Use `cloudflare` for the current Worker/D1 admin structured write path.                         |
| `VITE_BACKEND_MIGRATION_MODE`     | Enables the Cloudflare-first preview runtime policy.                                                      | Required for preview field verification             | Current preview value is `cloudflare-first-preview`; do not use it to imply production cutover. |
| `VITE_CLOUDFLARE_ADMIN_AUTH_MODE` | Selects browser admin authentication behavior for the Cloudflare admin path.                              | Required for Cloudflare-backed admin verification   | Use the configured non-secret mode label only.                                                  |
| `VITE_CLOUDFLARE_ADMIN_PROXY_URL` | Optional same-origin or public admin proxy base URL for CMS requests.                                     | Optional                                            | Do not include tokens or private deployment URLs.                                               |
| `VITE_PUBLIC_ANALYTICS_STRATEGY`  | Selects the public analytics loader strategy. Supported values are `gtm`, `gtag`, or `both`.              | Optional                                            | Omit to use the built-in default strategy.                                                      |

## Vercel Admin Proxy Variables

Configure these in Vercel environment settings.

| Variable                       | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `ADMIN_PROXY_ALLOWED_EMAILS`   | Emails allowed to create admin proxy sessions.               |
| `ADMIN_PROXY_PASSWORD_HASH`    | Password hash used by the admin proxy login endpoint.        |
| `ADMIN_PROXY_SESSION_SECRET`   | Server-only secret used to sign admin proxy session cookies. |
| `ADMIN_RBAC_ADMINS`            | Admin role email list.                                       |
| `ADMIN_RBAC_EDITORS`           | Editor role email list.                                      |
| `ADMIN_RBAC_VIEWERS`           | Viewer role email list.                                      |
| `CLOUDFLARE_ADMIN_API_URL`     | Cloudflare Worker admin API origin.                          |
| `CLOUDFLARE_ADMIN_SMOKE_TOKEN` | Server-only token forwarded from Vercel proxy to the Worker. |

## Vercel Runtime Sitemap Variables

Configure these as server-side Vercel variables for `api/sitemap.mjs`.

| Variable                    | Purpose                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`           | Canonical public origin written into sitemap URLs. Falls back to `VITE_PUBLIC_SITE_URL` and then the request host.           |
| `CLOUDFLARE_PUBLIC_API_URL` | Cloudflare Worker public API origin used to read menu and published content. Falls back to `VITE_CLOUDFLARE_PUBLIC_API_URL`. |

The runtime sitemap reads `/api/public/home` and `/api/public/content?kind=...` for `news`, `announcements`, and `blog`. These URLs are server configuration, not secrets, but private preview origins should not be committed.

## Cloudflare Worker Variables

Configure these in Cloudflare Worker environment settings.

| Variable                         | Purpose                                                 |
| -------------------------------- | ------------------------------------------------------- |
| `ADMIN_RBAC_ADMINS`              | Admin role email list.                                  |
| `ADMIN_RBAC_EDITORS`             | Editor role email list.                                 |
| `ADMIN_RBAC_VIEWERS`             | Viewer role email list.                                 |
| `ADMIN_WRITE_AUTH_MODE`          | Admin write authentication mode.                        |
| `ADMIN_WRITE_ALLOWED_EMAILS`     | Allowed admin write emails.                             |
| `ADMIN_WRITE_ALLOWED_ORIGINS`    | Allowed frontend/admin origins.                         |
| `ADMIN_WRITE_PREVIEW_ENABLED`    | Enables preview admin write behavior where intended.    |
| `ADMIN_WRITE_ACCESS_AUD`         | Cloudflare Access AUD when Access mode is used.         |
| `ADMIN_WRITE_ACCESS_TEAM_DOMAIN` | Cloudflare Access team domain when Access mode is used. |
| `DB`                             | D1 database binding.                                    |

## Apps Script Media Bridge Variables

Configure these as server-side variables only.

| Variable                   | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `GOOGLE_APPS_SCRIPT_URL`   | Apps Script Web App URL used by the server-side media/file bridge. |
| `APPS_SCRIPT_WEB_APP_URL`  | Alternate Apps Script Web App URL variable accepted by the bridge. |
| `APPS_SCRIPT_BRIDGE_TOKEN` | Server-only bridge token shared with Apps Script where required.   |

Do not expose bridge URLs, bridge tokens, admin proxy secrets, admin smoke tokens, D1 identifiers, or Cloudflare Access AUD values through `VITE_` variables.

## Removed From Current Frontend Runtime

`VITE_GOOGLE_APPS_SCRIPT_URL` is not part of the current frontend runtime and must not be used as server runtime configuration.

The current admin runtime uses the Vercel admin proxy, Cloudflare Worker/D1, and RBAC variables. The public frontend and runtime sitemap use the Cloudflare public API. Apps Script remains server-side only for the media/file bridge through `GOOGLE_APPS_SCRIPT_URL` or `APPS_SCRIPT_WEB_APP_URL`.

## Current Status

M20 migration/runtime/domain-cutover scope is closed. M21 owns UI/UX and logic stabilization. Environment changes must still follow the deployment boundary and secret-handling rules; closure does not authorize unrelated production mutation.
