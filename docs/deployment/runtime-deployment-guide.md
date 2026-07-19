# Runtime Deployment Guide

Current source-of-truth snapshot: 2026-07-19, baseline commit `80324e71982411c67e6f3f9b66e06b09ab7bb282`.

The deployment toolchain contract is Node `22.x` (exact local/CI pin `22.23.1`) and pnpm `10.34.5`. Vercel must retain frozen-lockfile installation and use Corepack when enforcing the exact pnpm pin.

| Change type                                                              | Required deployment                                        | Notes                                                                                |
| ------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Frontend React/Vite, Vercel functions, or accepted frontend dependencies | Vercel                                                     | Includes `api/sitemap.mjs` and server proxy changes.                                 |
| Cloudflare Worker runtime source/config                                  | Cloudflare Worker                                          | Validate Worker typecheck/tests first. Do not deploy from documentation-only work.   |
| D1 schema                                                                | Apply append-only migration, then deploy compatible Worker | Never edit old migrations; migration execution requires explicit authorization.      |
| Apps Script `.gs` media/file bridge                                      | Apps Script                                                | Google Drive remains behind this bridge. Deployment requires explicit authorization. |
| Documentation, tests, lint, or CI only                                   | No runtime deployment                                      | Repository/CI changes take effect through normal source-control review.              |

## Runtime Ownership

- Vercel hosts the React/Vite frontend, admin session/API proxies, Apps Script media bridge proxy, and runtime sitemap function.
- Cloudflare Worker owns public/admin structured API behavior; D1 owns structured persistence.
- Apps Script owns only media/file operations against Google Drive.
- `/sitemap.xml` is a Vercel rewrite to `/api/sitemap`, backed by live Cloudflare public API data.

Sitemap deployment validation uses `pnpm test:sitemap` for normalization/XML behavior and `pnpm build` for the Vercel bundle. `public/robots.txt` remains tracked; `public/sitemap.xml` is neither generated nor tracked.

The corrective toolchain commit requires a Vercel redeployment after it is pushed. It requires no Cloudflare Worker deployment, D1 migration, or Apps Script deployment.
