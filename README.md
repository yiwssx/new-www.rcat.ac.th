# RCAT Public Website And CMS

React/Vite public website and CMS for Roi-Et College of Agriculture and Technology.

Current source-of-truth snapshot: 2026-07-19, based on commit `80324e71982411c67e6f3f9b66e06b09ab7bb282` plus the warning-cleanup changes documented in `docs/development/`.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side admin proxy.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive behind the Apps Script media/file bridge.

## Current Project Status

M20 is closed for migration/runtime ownership. M21 owns remaining UI/UX and logic stabilization.

M20 closure is limited to migration, runtime ownership, and domain cutover scope. It does not mean the UI/UX is complete, the system is defect-free, or all business workflows are final. Remaining public, admin, workflow, validation, layout, Thai wording, and user-facing error issues are tracked under M21.

The production custom domain `www.rcat.ac.th` is connected to the Vercel production deployment, the Cloudflare/Vercel redirect loop was resolved at the provider configuration layer, and the Cloudflare Worker allowed origins include the production custom domain. Apps Script is retained only for the media/file bridge and Google Drive operations. Browser-side direct Apps Script structured reads/writes and legacy Apps Script user-management paths have been removed.

## Admin Operation Feedback

Admin CMS write operations now use blocking loading modals while pending, centered success modals requiring acknowledgment, and centered error modals requiring acknowledgment. Final admin write results must not use short auto-dismiss success toasts.

The standardized feedback applies to Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings. It was completed by:

- `7f5f95083b5df18c5c73939bf2b1e251c3880a97` `fix(admin): make media operation results explicit`
- `8aa55b3b22dd6a121fbaa799899670766f776abb` `fix(admin): standardize operation feedback`

## Public UX Updates

Urgent marquee speed is device-independent. The ticker uses distance-based animation duration, reduced-motion slows the ticker instead of disabling it, and the change did not require Worker, D1, or Apps Script updates.

- `4b8f01a2162ef8de002a8c2c46c69110f7b749e2` `fix(ui): normalize marquee speed across devices`

## Stack

- React + TypeScript strict mode
- Vite
- Tailwind CSS v4
- MUI
- TanStack Router
- TanStack Query and Table
- Vercel frontend and server-side proxy routes
- Cloudflare Worker and D1
- Apps Script media/file bridge
- Google Drive file storage

## Project Settings

Project settings live in `src/config/project-settings.json`.

Use that file for checked-in non-secret defaults such as site name, canonical public site URL, logo path, theme colors, query behavior, storage keys, role permissions, and resource names.

Do not store secrets, tokens, production credentials, Access AUD values, D1 IDs, or private deployment URLs in project settings.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm format:check
pnpm lint:strict
pnpm test:unit
pnpm test:integration
pnpm test:functional
pnpm build
pnpm worker:typecheck
pnpm deps:peers
pnpm deps:check
```

Use Node `22.23.1` and pnpm `10.34.5`. `package.json` accepts the Vercel-supported Node `22.x` line, while `.node-version`, `packageManager`, and CI pin the exact tested versions.

`pnpm-workspace.yaml` permits install scripts only for `esbuild`, `workerd`, and `sharp`. These binaries are required by the Vite/Wrangler toolchain; any unreviewed dependency build script fails installation.

pnpm 10 predates the `pnpm peers check` reporter. `pnpm deps:peers` enforces the same acceptance condition through a frozen install with strict peer-dependency validation.

## Runtime Sitemap

Vercel rewrites `/sitemap.xml` to the same-origin function `/api/sitemap`. The function reads the current public menu and published news, announcement, and blog content from the Cloudflare Worker/D1 public API, then returns XML with a five-minute shared-cache lifetime. It returns `503` when the public API is unavailable rather than publishing a stale build-time sitemap.

Server-side Vercel variables are `PUBLIC_SITE_URL` and `CLOUDFLARE_PUBLIC_API_URL`; the function also accepts the corresponding `VITE_` names as deployment-compatibility fallbacks. `pnpm build` does not generate sitemap files. `public/sitemap.xml` is absent and untracked. `public/robots.txt` is tracked and points crawlers to `/sitemap.xml`. `pnpm test:sitemap` covers route normalization and XML generation. The old tracked `scripts/generate-sitemap.mjs` is unreferenced and reserved for a separate removal decision.

## Documentation

- Current runtime ownership: `docs/architecture/m20-cleanup-runtime-ownership.md`
- Current migration/stabilization status: `docs/architecture/current-migration-status.md`
- Environment variables: `docs/development/environment-variables.md`
- Deployment boundaries: `docs/deployment/runtime-deployment-guide.md`
- Current warning/dependency state: `docs/development/warning-cleanup-final-report.md`
