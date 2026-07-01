# Environment Variables

This Vite app only exposes browser-readable variables whose names start with `VITE_`.

Treat every `VITE_` value as public because it can be bundled into client JavaScript.

Do not commit real environment values, deployment URLs for private environments, tokens, passwords, cookies, service account data, Access AUD values, D1 IDs, or any other secret material.

## Public Frontend Variables

| Variable                         | Purpose                                                                                      | Required                                            | Notes                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `VITE_CMS_SITE_NAME`             | Public CMS/site display name override.                                                       | Optional                                            | Use only when a deployment needs a name different from `src/config/project-settings.json`.     |
| `VITE_PUBLIC_SITE_URL`           | Canonical public site URL used for generated links, sitemap, robots, and metadata.           | Optional                                            | Set to the deployed public website origin when it differs from the checked-in project setting. |
| `VITE_PUBLIC_API_PROVIDER`       | Selects the public structured-data provider.                                                 | Required for Cloudflare-backed deployments          | Use `cloudflare` for the current Cloudflare Worker/D1 public read path.                        |
| `VITE_CLOUDFLARE_PUBLIC_API_URL` | Cloudflare Worker public API origin.                                                         | Required when `VITE_PUBLIC_API_PROVIDER=cloudflare` | Must be a public Worker origin. Do not include secrets.                                        |
| `VITE_PUBLIC_ANALYTICS_STRATEGY` | Selects the public analytics loader strategy. Supported values are `gtm`, `gtag`, or `both`. | Optional                                            | Omit to use the built-in default strategy.                                                     |

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

Do not expose bridge tokens through `VITE_` variables.

## Deprecated For Current Admin Runtime

`VITE_GOOGLE_APPS_SCRIPT_URL` is not the current admin login or user-management configuration path.

The current admin runtime uses Vercel admin proxy, Cloudflare Worker/D1, and RBAC environment variables.

`VITE_GOOGLE_APPS_SCRIPT_URL` may still appear in legacy/direct Apps Script compatibility code and local sitemap generation, but it must not be used for the current admin login, user management, or the server-side media bridge.
