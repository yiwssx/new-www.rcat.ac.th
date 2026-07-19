# Major Dependency Update Plan

Verified: 2026-07-19 (Asia/Bangkok)

Baseline commit: `80324e71982411c67e6f3f9b66e06b09ab7bb282`

No major dependency is upgraded by the warning-cleanup task.

## Deferred Major Groups

| Group                 | Current                                                            | Latest observed                                                     | Deferred until                                                                                                        |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| React platform        | React/React DOM `18.3.1`; types 18                                 | React `19.2.7`; types 19                                            | Dedicated React compatibility, hydration, router, and full browser regression pass.                                   |
| MUI platform          | Material/icons `6.5.0`                                             | `9.2.0`                                                             | React decision plus MUI 7-9 migration review; `Grid2` and `renderTags` must be reassessed against the selected major. |
| Vite/Vitest platform  | Vite `6.4.3`, plugin-react `4.7.0`, Vitest `3.2.7`, jsdom `26.1.0` | Vite `8.1.5`, plugin-react `6.0.3`, Vitest `4.1.10`, jsdom `29.1.1` | Isolated toolchain trial with unit/integration/build/Playwright and warning comparison.                               |
| TypeScript            | `5.9.3`                                                            | `7.0.2`                                                             | Selected Vite/Vitest and Worker tooling explicitly support it.                                                        |
| Worker types          | `4.20260702.1`                                                     | `5.20260718.1`                                                      | Wrangler peer compatibility and Worker typecheck/tests pass in an isolated trial.                                     |
| Runtime auth utility  | `bcryptjs 2.4.3`, `@types/bcryptjs 2.4.6`                          | `bcryptjs 3.0.3`; deprecated types `3.0.0`                          | Server-only admin-proxy auth smoke proves compatibility and bundled bcrypt types can replace external types.          |
| Repository AI tooling | Sigmap `6.15.0`                                                    | `8.18.0`                                                            | `pnpm ai:health`, `ai:map`, and repository workflow compatibility are in scope.                                       |

## Current Non-Major Freshness

`pnpm outdated` also reports patch/minor releases for Commitlint CLI, PostCSS, Prettier, Tailwind/PostCSS plugin, TanStack Router, ESLint, TypeScript-ESLint, and Wrangler. They are not security fixes required by this task and should be handled in a separate small update batch.

## Deprecated Transitives

- `git-raw-commits@5.0.1` is owned by `@commitlint/read@21.2.0`; wait for Commitlint to adopt `@conventional-changelog/git-client`.
- `whatwg-encoding@3.1.1` is owned by jsdom 26 through `html-encoding-sniffer`; reassess during the jsdom major trial.
- The installed `@types/bcryptjs@2.4.6` is not itself marked deprecated. Do not install the deprecated `3.0.0` latest release.

## Acceptance Criteria

Each major group must be isolated and must pass frozen install, format, strict lint, unit, integration, build, Worker typecheck, Playwright where relevant, peer checks, and audit. A failed trial is reverted as a group and its blocker is recorded here.
