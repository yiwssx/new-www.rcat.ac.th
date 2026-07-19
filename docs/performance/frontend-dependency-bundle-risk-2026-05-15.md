> Historical record — checkpoint 2026-05-15 at commit `b5e3b33214fefe6d8759b7acbfbd3cad6b4cb2f6`. Measurements and runtime statements below are preserved as historical evidence, not current state. Current source of truth: [M20 cleanup runtime ownership](../architecture/m20-cleanup-runtime-ownership.md).

# Frontend Dependency and Bundle Risk Report

Date: 2026-05-15  
Production URL: https://preview-placeholder.example.invalid/  
Scope: package/source import review and local Vite production build output  
Status: Updated 2026-05-19 with the auth import-graph hardening follow-up.

## Summary

The current build keeps the largest admin pages lazy-loaded, but the public entry bundle is still heavy because global app providers, route setup, analytics components, MUI runtime, and auth services are loaded before any public route renders.

The highest-risk finding is not that `bcryptjs` is downloaded on the first public page load. The build shows `bcryptjs` is emitted as a separate lazy chunk. The risk is that browser-side local auth and user fallback code is statically reachable from the app-wide auth provider, so public visitors receive auth/user-management fallback code in the initial application chunk and production safety depends on the Apps Script URL being configured correctly.

## 2026-05-19 Auth Import-Graph Follow-Up

Changes made:

- `AuthProvider` now imports only lightweight session restore code during public startup.
- Credential login now dynamically imports `src/services/auth.ts` only when login is attempted.
- `src/services/auth.ts` dynamically imports the Apps Script auth API path or local user fallback only inside the login action.
- `src/services/users.ts` keeps development/test local fallback behavior, but production builds fail closed if Apps Script user management is missing.
- `bcryptjs` remains installed and lazy-loaded only for the explicit local fallback paths.

New build result:

| Asset / metric             | Baseline build | 2026-05-19 build | Delta                   |
| -------------------------- | -------------: | ---------------: | ----------------------- |
| Initial `index` JS raw     |      390.71 kB |        382.35 kB | -8.36 kB                |
| Initial `index` JS gzip    |      128.48 kB |        125.95 kB | -2.53 kB                |
| Initial CSS raw            |       15.52 kB |         15.52 kB | No change               |
| `bcryptjs` lazy chunk gzip |       10.19 kB |         10.19 kB | No change               |
| Total built JavaScript raw |    1,171,978 B |      1,175,911 B | +3,933 B split overhead |
| Total built CSS raw        |       46,020 B |         46,020 B | No change               |

The initial public entry chunk improved modestly because user-management fallback code moved behind login/admin-only dynamic imports. The total JavaScript output increased slightly because the split creates additional small chunks (`auth`, `authRuntime`, and `users`) rather than flattening that code into the entry bundle.

Remaining risks:

- The public entry chunk is still large at 382.35 kB raw / 125.95 kB gzip.
- `bcryptjs` is still present as a lazy browser chunk for development/test local fallback behavior.
- Homepage LCP remains image/media-dependent and still needs production Lighthouse/Vercel measurement before claiming score recovery.

## Build Command

Command:

```powershell
pnpm.cmd build
```

Result: Passed.

Important build warning:

```text
Module "crypto" has been externalized for browser compatibility, imported by bcryptjs/dist/bcrypt.js
```

This warning comes from the lazy `bcryptjs` browser bundle. It does not fail the build, but it confirms that password hashing code is still part of the frontend build graph.

## Build Output Summary

Initial document assets:

| Asset                       |  Raw size | Gzip size | Notes                   |
| --------------------------- | --------: | --------: | ----------------------- |
| `assets/index-cB0hX8gS.js`  | 390.71 kB | 128.48 kB | Initial app entry chunk |
| `assets/index-BTl8vwsS.css` |  15.52 kB |   3.81 kB | Initial stylesheet      |

Largest JavaScript chunks observed:

| Chunk                             |  Raw size | Gzip size | Risk note                                  |
| --------------------------------- | --------: | --------: | ------------------------------------------ |
| `index-cB0hX8gS.js`               | 390.71 kB | 128.48 kB | Large initial startup cost for every route |
| `ContentPage-CMEBoTJ3.js`         | 120.15 kB |  33.87 kB | Admin content editor, lazy route chunk     |
| `sweetalert2.esm.all-i0D1jcg2.js` |  79.88 kB |  21.16 kB | Lazy alert dependency                      |
| `PublicHomePage-CDcQddxz.js`      |  60.42 kB |  19.72 kB | Public homepage route chunk                |
| `TextField-CHQPbs5b.js`           |  51.47 kB |  15.07 kB | Shared MUI input dependency                |
| `SettingsPage-DZIjzlmE.js`        |  42.49 kB |  10.37 kB | Admin settings, lazy route chunk           |
| `PublicSiteShell-8XzBmBLS.js`     |  40.26 kB |  14.14 kB | Public layout/header/footer/menu shell     |
| `Tooltip-BRxQ7f0C.js`             |  32.65 kB |  11.57 kB | Shared MUI overlay dependency              |
| `bcrypt-BbAE2fbd.js`              |  22.43 kB |  10.19 kB | Lazy browser bcrypt payload                |

Largest CSS assets observed:

| Asset                      | Raw size | Gzip size | Notes                       |
| -------------------------- | -------: | --------: | --------------------------- |
| `sweetalert2-shEbScbE.css` | 30.50 kB |   5.12 kB | Lazy-loaded with SweetAlert |
| `index-BTl8vwsS.css`       | 15.52 kB |   3.81 kB | Initial Tailwind/global CSS |

Built asset totals:

| Type       | Count | Raw bytes |
| ---------- | ----: | --------: |
| JavaScript |    92 | 1,171,978 |
| CSS        |     2 |    46,020 |

## Source Import Findings

### Public Entry Path

The public app starts through:

- `src/main.tsx`
- `src/App.tsx`
- `src/routes.tsx`
- `src/routeComponents.tsx`

`App` mounts the auth provider, router, MUI theme, TanStack Query provider, and baseline CSS for the whole application. This is normal for the current architecture, but it means any dependency statically imported by global providers can affect public route startup.

### Admin Route Isolation

Admin pages are lazy route chunks. The large admin pages do not appear to be directly included in the public homepage route chunk.

Positive isolation already present:

- `ContentPage`, `SettingsPage`, `MediaPage`, and other admin pages are lazy exports in `src/routeComponents.tsx`.
- `AdminActionProgress` is lazy and path-gated.
- `SweetAlert2` is imported dynamically through `src/utils/swal.ts`.

Resolved auth leakage from the follow-up:

- `src/App.tsx` still mounts `AuthProvider` globally, but the provider no longer statically imports `src/services/auth.ts`.
- `src/context/AuthContext.tsx` imports `src/services/authSession.ts` for session restore only.
- `src/services/auth.ts` dynamically imports `src/services/googleApi.ts` or `src/services/users.ts` only when credential login is attempted.
- `src/services/users.ts` remains reachable from admin user management and local fallback login paths, not normal public route startup.

This means the bcrypt payload and user-management fallback implementation remain lazy. They are still in the frontend build for development/test fallback behavior, but they are no longer part of the public startup graph.

## Dependency Risk Ranking

### P0: Browser Auth Fallback and bcryptjs Production Safety

Risk:

`bcryptjs` is not part of the first HTML module payload, but it is emitted as a browser chunk and reachable from local auth/user management fallback paths. In production, password verification and hashing should be server-side only.

Why this matters:

- The local fallback path in `src/services/auth.ts` calls frontend user authentication when `VITE_GOOGLE_APPS_SCRIPT_URL` is unavailable.
- A production environment misconfiguration could cause login behavior to fall back to browser-side local auth assumptions.
- The build warning about `crypto` externalization confirms this dependency is designed around Node-like crypto assumptions and is not ideal for public browser code.
- Even if the chunk is lazy, keeping password hashing code in the frontend weakens the production boundary.

Recommendation:

Apps Script authentication is now mandatory for production fallback paths. If the Apps Script URL is missing in production, login/user-management fallback fails closed instead of silently using browser-local auth. Development/test local fallback is preserved.

What not to change yet:

Do not remove `bcryptjs` until the local/dev auth fallback strategy is explicitly replaced or gated. Removing it blindly could break local admin bootstrap or tests.

### P1: Initial Public Bundle Size

Risk:

The initial `index` chunk improved from 390.71 kB raw / 128.48 kB gzip to 382.35 kB raw / 125.95 kB gzip. That is still high for a public marketing/institutional homepage before route-specific chunks load.

Likely contributors:

- Global MUI provider/runtime and baseline.
- TanStack Router/Query startup.
- Route definitions and protected route guards.
- Auth provider and session restore imports.
- Public analytics/Speed Insights wiring.

Recommendation:

First target import graph reductions that do not change UX:

1. Keep browser-local auth/user fallback code out of app startup.
2. Keep only lightweight session restore in the global provider.
3. Continue lazy-loading login/auth mutation code when `/login` or admin user management is used.
4. Measure the next bottleneck before deeper UI work.

### P1: Public Homepage Route Chunk and LCP/Image Risk

Risk:

`PublicHomePage` is 60.42 kB raw and imports all homepage sections statically. `PublicSiteShell` adds another 40.26 kB raw. The homepage can also be dominated by image and media behavior:

- IntroGate image when enabled.
- Carousel first image.
- Director image.
- Google Drive thumbnail URLs.
- Below-the-fold iframe/media sections.

Recommendation:

Do not hide or remove features. Measure the actual LCP element first. If source-level optimization is needed, prefer:

- Responsive thumbnail size selection for Google Drive images.
- Static optimized WebP/AVIF for true LCP images.
- Lazy rendering or intersection-triggered rendering for below-the-fold homepage sections.
- Ensuring only the first visible carousel image receives eager/high-priority loading.

### P1: SweetAlert2 Interaction Cost

Risk:

SweetAlert2 is large at 79.88 kB raw plus 30.50 kB CSS. However, it is lazy-loaded through the app alert helper, so it is not an immediate public first-load problem.

Recommendation:

Keep the current lazy-loading strategy. Review only if login/admin interaction latency becomes measurable.

### P2: MUI Icons and Shared MUI Chunks

Risk:

The project uses per-icon MUI imports rather than broad icon barrel imports, which is good. Still, public shell/header/footer and admin UI use many MUI components and icons, creating multiple shared chunks such as `TextField`, `Tooltip`, `Button`, and `List`.

Recommendation:

Avoid broad icon imports. Audit public shell icons only after the P0/P1 auth and route-splitting work, because icon cleanup is unlikely to recover the largest score drop by itself.

### P2: FontAwesome Dependency Hygiene

Risk:

Resolved on 2026-05-23: a follow-up audit again found zero source usage and removed the unused FontAwesome dependencies from `package.json` and `pnpm-lock.yaml`.

Previously, `package.json` included FontAwesome packages, but no source import was found for:

- `@fortawesome/fontawesome-svg-core`
- `@fortawesome/free-brands-svg-icons`
- `@fortawesome/free-solid-svg-icons`
- `@fortawesome/react-fontawesome`

No direct bundle impact was found from source imports during this pass.

Recommendation:

No further action is needed unless a future feature intentionally introduces FontAwesome again for a specific icon that MUI Icons does not cover.

### P2: Tailwind and MUI Boundary

Risk:

There is no evidence of a build conflict between Tailwind CSS v4 and MUI. Initial CSS is modest at 15.52 kB raw. The real risk is design and maintenance drift from two styling systems:

- Tailwind/global CSS variables in `src/styles.css`.
- MUI theme and `sx` styles in React components.

Recommendation:

Keep both systems for now. Use Tailwind/global CSS for layout utilities, public content classes, and shared tokens. Use MUI for complex interactive components, admin tables/forms/dialogs, and accessibility-heavy controls. Avoid broad MUI-to-Tailwind or Tailwind-to-MUI rewrites.

## Recommended Action Plan

### P0

Completed in the 2026-05-19 follow-up: Apps Script auth is required in production fallback paths, and browser-local auth/user fallback now fails closed in production mode.

### P1

Completed in the 2026-05-19 follow-up: auth/user fallback code is split out of the public startup graph. Keep this boundary in place during future auth work.

### P1

Measure public homepage LCP in Lighthouse or Vercel Speed Insights and identify the actual LCP element before changing media behavior. If the LCP is a Google Drive thumbnail or carousel image, optimize image size/source first.

### P1

Review whether below-the-fold homepage sections can be lazy-rendered without altering the visible first viewport or crawlable critical content.

### P2

Keep SweetAlert lazy and do not replace it unless interaction metrics justify it.

### P2

Audit remaining unused dependencies after production behavior and planned usage are confirmed. FontAwesome was handled in the 2026-05-23 MUI/Tailwind/icons cleanup.

### P2

Document and enforce the Tailwind/MUI boundary in UI work, but do not rewrite existing components only for consistency.

## What Should Not Be Changed Yet

- Do not remove `bcryptjs` until local/development auth fallback behavior is explicitly replaced or gated.
- Do not reintroduce FontAwesome dependencies unless usage intent is confirmed.
- Do not remove MUI or rewrite MUI components in Tailwind.
- Do not remove Tailwind or move all CSS into MUI.
- Do not remove SweetAlert2; it is already lazy-loaded.
- Do not change auth behavior, Apps Script routes, CMS schema, or admin workflows as part of this report.
- Do not optimize homepage images blindly without identifying the production LCP element.

## Manual Verification Needed Before Claiming Performance Recovery

This report is based on source imports and local build output. It does not prove a 90+ Vercel Speed Insights or Lighthouse score.

Before claiming recovery:

1. Deploy the next performance branch.
2. Run Lighthouse mobile and desktop against production or a Vercel preview deployment.
3. Record FCP, LCP, CLS, INP/TBT, Speed Index, and transfer sizes.
4. Confirm the first public route does not fetch admin-only chunks.
5. Confirm IntroGate, carousel, Director image, Facebook embed/fallback, analytics, and admin login still behave normally.
