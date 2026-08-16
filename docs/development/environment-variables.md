# Environment Variables

Updated: 2026-08-16.

This Vite app only exposes browser-readable variables whose names start with `VITE_`.

Treat every `VITE_` value as public because it can be bundled into client JavaScript.

Do not commit real environment values, deployment URLs for private environments, tokens, passwords, cookies, service account data, Access AUD values, D1 IDs, or any other secret material.

## Vercel Build Toolchain

The repository contract is Node `24.x` and pnpm `10.34.5`. The local `.node-version` pin uses Node `24.18.0`, while CI and `engines.node` accept the current Node 24 release line. Vercel uses `engines.node` for Node selection. To make Vercel honor the exact `packageManager` pin through Corepack, configure the non-secret build variable `ENABLE_EXPERIMENTAL_COREPACK=1`; do not replace the frozen-lockfile install with a permissive install command.

## Public Frontend Variables

| Variable                         | Purpose                                                                                                                                                                     | Required                                  | Notes                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `VITE_CMS_SITE_NAME`             | Public CMS/site display name override.                                                                                                                                      | Optional                                  | Use only when a deployment needs a name different from `src/config/project-settings.json`.                             |
| `VITE_PUBLIC_SITE_URL`           | Canonical public site URL used by browser links and metadata; also accepted as a server sitemap fallback.                                                                   | Optional                                  | Prefer server-only `PUBLIC_SITE_URL` for the runtime sitemap function.                                                 |
| `VITE_CLOUDFLARE_PUBLIC_API_URL` | Browser-safe Cloudflare Worker public API origin used by Public reads, analytics, and live visitor statistics.                                                              | Required for browser Public API operation | The Worker origin itself is public; do not include secrets in the URL.                                                 |
| `VITE_PUBLIC_ANALYTICS_STRATEGY` | Selects the single Google page-view transport for Public routes. Supported values are `gtm` or `gtag`; the deprecated `both` value remains a compatibility alias for `gtm`. | Optional                                  | Omit or use an unknown value to select the built-in `gtm` default. Auth and Admin routes do not load Public telemetry. |

Public structured data is Cloudflare-only. There is no `VITE_PUBLIC_API_PROVIDER` runtime selector.

Admin structured reads and writes always use the fixed same-origin `/api/admin-proxy` path. No browser variable selects an Admin provider, migration mode, proxy path, or direct Worker Admin origin.

## Vercel Public SSR Variables

Configure the Cloudflare Public API origin server-side for SSR:

| Variable                         | Purpose                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_PUBLIC_API_URL`      | Preferred server-side Cloudflare Worker public API origin used by SSR and server Public reads.                            |
| `VITE_CLOUDFLARE_PUBLIC_API_URL` | Browser-safe compatibility fallback when the server-only variable is absent; browser bundles also use this public origin. |

Server-side code gives `CLOUDFLARE_PUBLIC_API_URL` precedence over the `VITE_` alias.

The configured URL must be the canonical production Worker endpoint after cutover. The repository no longer defines a persistent Cloudflare Preview runtime. Vercel production values are maintained separately from the Worker/D1 repository release configuration.

## Vercel Admin Proxy Variables

Configure these in Vercel environment settings.

| Variable                   | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `CLOUDFLARE_ADMIN_API_URL` | Cloudflare Worker admin API origin.                                  |
| `CMS_AUTH_PROXY_SECRET`    | Server-only secret shared by the Vercel CMS proxies and Worker.      |
| `GOOGLE_APPS_SCRIPT_URL`   | Apps Script Web App URL used by the server-side media/file bridge.   |
| `APPS_SCRIPT_WEB_APP_URL`  | Alternate Apps Script Web App URL accepted by the media/file bridge. |
| `APPS_SCRIPT_BRIDGE_TOKEN` | Server-only bridge token shared with Apps Script where required.     |

## Vercel Runtime Sitemap Variables

Configure these as server-side Vercel variables for `api/sitemap.mjs`.

| Variable                    | Purpose                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`           | Canonical public origin written into sitemap URLs. Falls back to `VITE_PUBLIC_SITE_URL` and then the request host.  |
| `CLOUDFLARE_PUBLIC_API_URL` | Cloudflare Worker public API origin used to read published content. Falls back to `VITE_CLOUDFLARE_PUBLIC_API_URL`. |

The runtime sitemap reads published News and Blog content and the Announcements contract, including paginated published Public page items. It combines those canonical content records with the known indexable static route set. It does not depend on `/api/public/home` or the Public menu to construct sitemap routes. These URLs are server configuration, not secrets, but obsolete or non-production origins should not be committed.

## Complaint Proxy Variable

Canonical server-only Vercel configuration:

| Variable            | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `COMPLAINT_API_URI` | Dedicated complaint Apps Script `/exec` endpoint used only by the proxy. |

The browser submits to same-origin `/api/complaint`; do not expose the complaint Apps Script endpoint to browser code.

## Cloudflare Worker Variables

Configure these in Cloudflare Worker environment settings.

`CMS_MFA_ENCRYPTION_KEY` and `CMS_MFA_ENCRYPTION_KEY_VERSION` are Worker-only. Do not configure them in Vercel.

| Variable                         | Purpose                                                                    |
| -------------------------------- | -------------------------------------------------------------------------- |
| `ADMIN_WRITE_ALLOWED_ORIGINS`    | Allowed frontend/admin origins.                                            |
| `CMS_AUTH_PROXY_SECRET`          | Server-only secret shared with the Vercel CMS proxies.                     |
| `CMS_MFA_ENCRYPTION_KEY`         | Server-only encryption key for CMS MFA secrets.                            |
| `CMS_MFA_ENCRYPTION_KEY_VERSION` | Version label for the active CMS MFA encryption key.                       |
| `DB`                             | D1 database binding containing CMS data, users, credentials, and Sessions. |

The production Worker `DB` binding targets the existing data-bearing D1 whose legacy physical Cloudflare name is `rcat-public-api-preview`. That physical label does not define an environment anymore; the canonical role is production.

## GitHub Production Release Secrets

Cloudflare release workflows run only through the protected GitHub `Production` environment and require:

| Secret                           | Purpose                                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`          | Cloudflare account used by Wrangler.                                                                                    |
| `CLOUDFLARE_API_TOKEN`           | Protected Wrangler credential for the explicitly approved release workflow.                                             |
| `RCAT_PRODUCTION_D1_DATABASE_ID` | UUID of the promoted data-bearing D1, physically still named `rcat-public-api-preview`; authoritative release identity. |

Do not set `RCAT_PRODUCTION_D1_DATABASE_ID` to the unused empty D1 that was physically named `rcat-public-api-production`. Do not commit either UUID to git.

## Apps Script Media Bridge Variables

Configure these as server-side variables only.

| Variable                   | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `GOOGLE_APPS_SCRIPT_URL`   | Apps Script Web App URL used by the server-side media/file bridge. |
| `APPS_SCRIPT_WEB_APP_URL`  | Alternate Apps Script Web App URL variable accepted by the bridge. |
| `APPS_SCRIPT_BRIDGE_TOKEN` | Server-only bridge token shared with Apps Script where required.   |

Do not expose bridge URLs, bridge tokens, the CMS proxy secret, MFA encryption material, or D1 identifiers through `VITE_` variables.

## Removed From Current Frontend Runtime

The following are not current frontend runtime configuration and must not be restored:

- `VITE_PUBLIC_API_PROVIDER`;
- `VITE_GOOGLE_APPS_SCRIPT_URL`;
- browser-selected Admin provider/migration modes for production structured data;
- a persistent Cloudflare Preview environment selector.

The current admin runtime uses the Vercel CMS Admin proxy and the role stored in Cloudflare D1. The public frontend and runtime sitemap use the Cloudflare public API. Apps Script remains server-side only for the media/file bridge through `GOOGLE_APPS_SCRIPT_URL` or `APPS_SCRIPT_WEB_APP_URL`.

## Current Status

M20 migration/runtime/domain-cutover scope is closed. Cloudflare environment convergence makes local development plus one protected production runtime the current model. Environment changes must still follow the deployment boundary and secret-handling rules; closure does not authorize unrelated production mutation.

See `docs/architecture/production-environment-convergence-2026-08-16.md` for the canonical environment naming decision.
