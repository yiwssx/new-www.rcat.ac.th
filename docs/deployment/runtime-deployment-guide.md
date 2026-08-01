# Runtime Deployment Guide

Updated: 2026-08-01.

## Toolchain

Current checked-in contract:

- Node `24.x`
- pnpm `10.34.5`

Node 22 is no longer the current project requirement.

## Deployment Matrix

| Change type                                                | Required deployment                          | Notes                                              |
| ---------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| React/Vite frontend (`src/**`)                             | Vercel                                       | Includes Admin/Public/Auth UI.                     |
| Vercel functions/proxies (`api/**`, `server/**`)           | Vercel                                       | Revalidate proxy/auth behavior when touched.       |
| Cloudflare Worker runtime (`cloudflare/public-api/src/**`) | Cloudflare Worker                            | Run relevant Worker tests/typecheck first.         |
| Worker config                                              | Cloudflare Worker/config operation           | Environment changes are explicit operations.       |
| New D1 schema migration                                    | D1 migration + compatible Worker as required | Append-only; do not rewrite historical migrations. |
| Apps Script `.gs` media bridge                             | Apps Script                                  | Explicit deployment required.                      |
| Documentation only                                         | No runtime deployment                        | Source-control only.                               |
| Tests only                                                 | No runtime deployment                        | Unless accompanying runtime code.                  |

## Runtime Ownership

- Vercel: React/Vite frontend, same-origin CMS/Admin/Apps Script proxies, runtime sitemap.
- Cloudflare Worker: Public/Admin structured API behavior.
- D1: structured persistence.
- Apps Script: Google Drive media/file bridge only.
- Google Drive: file/media storage behind that bridge.

## Admin Menu Refactor Deployment

When the Menu refactor changes only:

- `src/admin/pages/MenuPage.tsx`
- `src/admin/pages/MenuPage.test.tsx`
- `src/admin/pages/menuPageModel.ts`
- `src/admin/pages/menuPageModel.test.ts`
- documentation

impact is:

- Vercel: required
- Cloudflare Worker: not required
- D1 migration: not required
- Apps Script: not required
- environment variables: not required
- cookie changes: not required

The existing Worker menu APIs and D1 `menu_items` schema remain unchanged.

## CMS Session Deployment Rule

Deploy based on the actual diff:

- frontend auth/session code -> Vercel;
- `server/adminProxy/**` -> Vercel;
- `cloudflare/public-api/**` -> Worker;
- migration files -> D1 migration.

Do not deploy Worker/D1 merely because a feature relates to authentication.

## Focused Verification

For Admin Menu:

```bash
pnpm exec vitest run src/admin/pages/menuPageModel.test.ts src/admin/pages/MenuPage.test.tsx
pnpm build
```

Then broaden as appropriate:

```bash
pnpm format:check
pnpm lint:strict
pnpm test:unit
pnpm test:integration
```

Release-scale gates may include `pnpm quality`, `pnpm quality:full`, and `pnpm quality:release`. Do not use an hour-scale release suite as the first feedback loop for a small Admin UI edit.

## Sitemap

Vercel rewrites `/sitemap.xml` to `/api/sitemap`, which reads live public data from the Cloudflare API.

Verification:

```bash
pnpm test:sitemap
pnpm build
```

Do not restore a tracked build-generated `public/sitemap.xml`.

## Deployment Safety

Before deployment:

1. inspect `git status` and final diff;
2. ensure no secrets/generated junk/unrelated changes;
3. run focused validation;
4. run appropriate broader gates;
5. commit and push normally;
6. do not force-push solely to deploy.

Documentation-only changes require no runtime deployment. When docs are committed with Menu runtime code, Vercel is required because of the frontend diff, not because of Markdown files.
