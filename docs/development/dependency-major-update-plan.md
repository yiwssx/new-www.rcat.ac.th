# Major Dependency Update Plan

Verified: 2026-07-28 (Asia/Bangkok)

Task 5 starting commit: `73d69e928e19a6d90689578e0d861df3acdb61ce`

The current performance-first decisions and measurements are recorded in
[`../maintenance/dependency-modernization.md`](../maintenance/dependency-modernization.md).

## Deferred Major Groups

| Group                 | Current                                                            | Latest observed                                                     | Deferred until                                                                                                        |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| React platform        | React/React DOM `18.3.1`; types 18                                 | React `19.2.8`; types 19                                            | Dedicated React compatibility, hydration, router, and full browser regression pass.                                   |
| MUI platform          | Material/icons `6.5.0`                                             | `9.2.0`                                                             | React decision plus MUI 7-9 migration review; `Grid2` and `renderTags` must be reassessed against the selected major. |
| Vite/Vitest platform  | Vite `6.4.3`, plugin-react `4.7.0`, Vitest `3.2.7`, jsdom `26.1.0` | Vite `8.1.5`, plugin-react `6.0.4`, Vitest `4.1.10`, jsdom `30.0.0` | Isolated toolchain trial with unit/integration/build/Playwright and warning comparison.                               |
| TypeScript            | `5.9.3`                                                            | `7.0.2`                                                             | Selected Vite/Vitest and Worker tooling explicitly support it.                                                        |
| Runtime auth utility  | `bcryptjs 2.4.3`, `@types/bcryptjs 2.4.6`                          | `bcryptjs 3.0.3`; deprecated types `3.0.0`                          | Server-only admin-proxy auth smoke proves compatibility and bundled bcrypt types can replace external types.          |
| Repository AI tooling | Sigmap `6.15.0`                                                    | `8.22.0`                                                            | `pnpm ai:health`, `ai:map`, and repository workflow compatibility are in scope.                                       |

## Applied Major

`@cloudflare/workers-types` was updated from major 4 to major 5 together with Wrangler 4.114.0.
Worker typecheck, 693 Worker tests, and the deployment dry run passed without Worker runtime or
configuration changes.

## Current Non-Major Freshness

All selected compatible patch/minor updates were applied. Tailwind CSS and its PostCSS plugin remain
at 4.3.2 because a 4.3.3 trial increased generated CSS and startup gzip bytes.

## Deprecated Transitives

- `whatwg-encoding@3.1.1` is owned by jsdom 26 through `html-encoding-sniffer`; reassess during the jsdom major trial.
- The installed `@types/bcryptjs@2.4.6` is not itself marked deprecated. Do not install the deprecated `3.0.0` latest release.

## Acceptance Criteria

Each major group must be isolated and must pass frozen install, format, strict lint, unit, integration, build, Worker typecheck, Playwright where relevant, peer checks, and audit. A failed trial is reverted as a group and its blocker is recorded here.
