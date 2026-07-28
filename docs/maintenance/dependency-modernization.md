# Dependency Modernization

Verified: 2026-07-28 (Asia/Bangkok)

Starting master: `73d69e928e19a6d90689578e0d861df3acdb61ce`

This record covers Task 5's controlled dependency modernization. Production performance, runtime
compatibility, and the existing Public/Auth/Admin boundaries were acceptance gates. It is not a
blanket update-to-latest record.

## Toolchain

| Tool     | Before    | After     | Decision                                          |
| -------- | --------- | --------- | ------------------------------------------------- |
| Node.js  | `24.18.0` | `24.18.0` | Retained; satisfies `engines.node` and CI `24.x`. |
| pnpm     | `10.34.5` | `10.34.5` | Retained; matches `packageManager` and CI.        |
| Corepack | `0.35.0`  | `0.35.0`  | Environment observation only.                     |

No Node, pnpm, package-manager, or CI workflow change was necessary.

## Direct Dependency Matrix

`Runtime impact` identifies whether a package can enter a production bundle or is build/test tooling.
Versions are the direct manifest ranges before and after this task.

| Package                           | Before          | After           | Classification | Runtime impact            | Reason                                                                                            |
| --------------------------------- | --------------- | --------------- | -------------- | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `@emotion/react`                  | `^11.14.0`      | `^11.14.0`      | Retained       | Runtime styling           | Current compatible Emotion release; kept aligned with MUI 6.                                      |
| `@emotion/styled`                 | `^11.14.1`      | `^11.14.1`      | Retained       | Runtime styling           | Current compatible release; no independent migration value.                                       |
| `@mui/icons-material`             | `^6.5.0`        | `^6.5.0`        | Retained       | Runtime UI/icons          | MUI 9 requires a multi-major theme, Grid, and visual-governance migration.                        |
| `@mui/material`                   | `^6.5.0`        | `^6.5.0`        | Retained       | Runtime UI                | MUI 9 was outside the safe scope for owner-state, variants, typography, tables, and focus policy. |
| `@tanstack/react-query`           | `^5.101.2`      | `^5.101.4`      | Patch          | Runtime data cache        | Compatible patch; targeted cache/invalidation tests and bundle gate passed.                       |
| `@tanstack/react-router`          | `^1.170.17`     | `^1.170.18`     | Patch          | Runtime routing           | Compatible patch; route ownership and lazy boundaries passed targeted tests.                      |
| `@tanstack/react-table`           | `^8.21.3`       | `^8.21.3`       | Retained       | Runtime tables            | Already current; kept in the tested TanStack major set.                                           |
| `@vercel/analytics`               | `^2.0.1`        | `^2.0.1`        | Retained       | Lazy Public telemetry     | Already current; synchronous telemetry isolation remained unchanged.                              |
| `@vercel/speed-insights`          | `^2.0.0`        | `^2.0.0`        | Retained       | Lazy Public telemetry     | Already current; no eager association was introduced.                                             |
| `bcryptjs`                        | `^2.4.3`        | `^2.4.3`        | Retained       | Server-side auth utility  | Version 3 is an auth-sensitive major and needs a dedicated proxy/auth migration.                  |
| `dayjs`                           | `^1.11.21`      | `^1.11.21`      | Retained       | Runtime dates             | Already current.                                                                                  |
| `embla-carousel-react`            | `^8.6.0`        | `^8.6.0`        | Retained       | Runtime carousel          | Already current; carousel media window remained bounded.                                          |
| `jose`                            | `^6.2.3`        | `^6.2.4`        | Patch          | Server/runtime JOSE       | Compatible maintenance patch; auth and Worker tests passed.                                       |
| `jwt-decode`                      | `^4.0.0`        | `^4.0.0`        | Retained       | Runtime token decode      | Already current.                                                                                  |
| `react`                           | `^18.3.1`       | `^18.3.1`       | Retained       | Core runtime              | React 19 requires a dedicated lifecycle/StrictMode and ecosystem migration.                       |
| `react-dom`                       | `^18.3.1`       | `^18.3.1`       | Retained       | Core runtime              | Kept exactly aligned with React 18.                                                               |
| `sweetalert2`                     | `^11.26.25`     | `^11.26.25`     | Retained       | Lazy admin feedback UI    | Already current; lazy boundary retained.                                                          |
| `@cloudflare/workers-types`       | `^4.20260702.1` | `^5.20260728.1` | Major          | Build-only Worker types   | Matched to current Wrangler; root type entrypoint, typecheck, Worker tests, and dry-run passed.   |
| `@commitlint/cli`                 | `21.2.0`        | `21.2.1`        | Patch          | Commit tooling            | Maintenance/security transitive refresh; cleared vulnerable `fast-uri`.                           |
| `@commitlint/config-conventional` | `21.2.0`        | `21.2.0`        | Retained       | Commit tooling            | Current and major-aligned with the CLI.                                                           |
| `@eslint/js`                      | `^10.0.1`       | `^10.0.1`       | Retained       | Lint tooling              | Already current and major-aligned with ESLint 10.                                                 |
| `@playwright/test`                | `^1.61.1`       | `^1.62.0`       | Minor          | Browser-test tooling      | Compatible stable minor; full functional suite uses the matching Chromium runtime.                |
| `@tailwindcss/postcss`            | `^4.3.2`        | `^4.3.2`        | Retained       | CSS build tooling         | `4.3.3` trial added 144 CSS bytes and 6 startup gzip bytes, so the pair was reverted.             |
| `@testing-library/jest-dom`       | `^6.9.1`        | `^6.9.1`        | Retained       | Test tooling              | Version 7 is a test-behavior major; no security or support need justified migration scope.        |
| `@testing-library/react`          | `^16.3.2`       | `^16.3.2`       | Retained       | Test tooling              | Already current and compatible with React 18.                                                     |
| `@testing-library/user-event`     | `^14.6.1`       | `^14.6.1`       | Retained       | Test tooling              | Already current.                                                                                  |
| `@types/bcryptjs`                 | `^2.4.6`        | `^2.4.6`        | Retained       | Type-only auth support    | Required by bcryptjs 2; latest 3.0.0 is a deprecated stub for bcryptjs 3.                         |
| `@types/react`                    | `^18.3.31`      | `^18.3.31`      | Retained       | Type-only React           | Kept major-aligned with React 18.                                                                 |
| `@types/react-dom`                | `^18.3.7`       | `^18.3.7`       | Retained       | Type-only React DOM       | Kept major-aligned with React DOM 18.                                                             |
| `@vitejs/plugin-react`            | `^4.7.0`        | `^4.7.0`        | Retained       | Build tooling             | Version 6 belongs to the deferred Vite/React toolchain migration.                                 |
| `eslint`                          | `^10.6.0`       | `^10.8.0`       | Minor          | Lint tooling              | Compatible minor; strict lint passed and vulnerable minimatch path was refreshed.                 |
| `eslint-config-prettier`          | `^10.1.8`       | `^10.1.8`       | Retained       | Lint tooling              | Already current.                                                                                  |
| `eslint-plugin-react-hooks`       | `^7.1.1`        | `^7.1.1`        | Retained       | Lint tooling              | Already current.                                                                                  |
| `eslint-plugin-react-refresh`     | `^0.5.3`        | `^0.5.3`        | Retained       | Lint/dev tooling          | Already current.                                                                                  |
| `globals`                         | `^17.7.0`       | `^17.8.0`       | Minor          | Lint tooling              | Compatible data refresh; strict lint passed.                                                      |
| `husky`                           | `^9.1.7`        | `^9.1.7`        | Retained       | Git-hook tooling          | Already current.                                                                                  |
| `jsdom`                           | `^26.1.0`       | `^26.1.0`       | Retained       | Unit-test environment     | Version 30 is a multi-major DOM-environment change coupled to Vitest migration.                   |
| `lint-staged`                     | `^17.0.8`       | `^17.2.0`       | Minor          | Git-hook tooling          | Compatible stable minor; staged workflow configuration remained valid.                            |
| `postcss`                         | `^8.5.16`       | `^8.5.24`       | Patch          | CSS build tooling         | Fixed the direct high-severity advisory without changing generated CSS.                           |
| `prettier`                        | `^3.9.4`        | `^3.9.6`        | Patch          | Format tooling            | Compatible patch; repository format check passed.                                                 |
| `sigmap`                          | `^6.15.0`       | `^6.15.0`       | Retained       | Repository AI tooling     | Version 8 is a workflow major requiring separate `ai:*` compatibility validation.                 |
| `tailwindcss`                     | `^4.3.2`        | `^4.3.2`        | Retained       | CSS build tooling         | `4.3.3` performance trial regressed output, so it was reverted with its PostCSS plugin.           |
| `typescript`                      | `^5.9.3`        | `^5.9.3`        | Retained       | Compiler tooling          | TypeScript 7 requires the TypeScript 6 transition and coordinated toolchain support.              |
| `typescript-eslint`               | `^8.63.0`       | `^8.65.0`       | Minor          | Lint tooling              | Compatible minor; strict lint and type-aware rules passed.                                        |
| `vite`                            | `^6.4.3`        | `^6.4.3`        | Retained       | Build/dev tooling         | Vite 8 changes the bundler/toolchain and needs an isolated output migration.                      |
| `vite-plugin-checker`             | `^0.14.4`       | `^0.14.5`       | Patch          | Build/dev tooling         | Compatible patch; build and checks passed.                                                        |
| `vitest`                          | `^3.2.7`        | `^3.2.7`        | Retained       | Test tooling              | Vitest 4 is coupled to the deferred Vite/jsdom test-environment migration.                        |
| `wrangler`                        | `^4.107.0`      | `^4.114.0`      | Minor          | Worker build/test tooling | Stable maintenance/security update; Worker contracts and configuration were unchanged.            |

## Selected Updates and Removals

Fourteen direct packages were updated: TanStack Query, TanStack Router, jose, Cloudflare Workers
types, Commitlint CLI, Playwright, ESLint, globals, lint-staged, PostCSS, Prettier,
typescript-eslint, vite-plugin-checker, and Wrangler.

No direct package was removed. Inspection found no safe obsolete direct dependency:

- `@types/bcryptjs@2.4.6` remains required by the retained bcryptjs 2 API.
- explicit runtime dependencies remain actual application imports or intentional direct contracts;
- no package was removed merely because it was also transitively available.

`pnpm dedupe` pruned 14 redundant transitive installations from the lock graph. It did not remove a
direct contract. The one remaining deprecated transitive is `whatwg-encoding@3.1.1`, reached only
through jsdom 26 test tooling; it is deferred with the jsdom/Vitest major migration.

## Major Decisions

The only applied major was `@cloudflare/workers-types` 4 to 5. The repository imports the package's
root type entrypoint, not a removed dated subpath. Wrangler 4.114, Worker typecheck, 693 Worker tests,
and the dry-run build all passed without Worker source, bindings, schema, migration, or configuration
changes.

Intentionally retained major families:

- React 18 and React DOM 18: React 19 changes lifecycle and compatibility assumptions; no support or
  security issue required taking that risk in this performance-first task.
- MUI 6 and Emotion 11: moving through MUI 7-9 requires Grid/theme/export and visual-policy work.
- Vite 6, plugin-react 4, Vitest 3, and jsdom 26: Vite 8 and Vitest 4 change the bundler and test
  environment and need a dedicated output comparison.
- TypeScript 5.9: TypeScript 7 requires the TypeScript 6 transition and coordinated ecosystem
  support.
- bcryptjs 2 plus its version-2 types: authentication-sensitive migration is deferred.
- Sigmap 6 and jest-dom 6: repository workflow and test-behavior majors are deferred.
- Tailwind/PostCSS plugin 4.3.2: the 4.3.3 patch was trialed and reverted because CSS grew by 144
  bytes and startup gzip grew by 6 bytes.

Official sources consulted:

- [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [MUI v7 migration](https://mui.com/material-ui/migration/upgrade-to-v7/) and
  [MUI v9 migration](https://mui.com/material-ui/migration/upgrade-to-v9/)
- [Vite migration guide](https://vite.dev/guide/migration)
- [Vitest migration guide](https://vitest.dev/guide/migration)
- [TypeScript 6 transition notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)
- [Cloudflare Workers changelog](https://developers.cloudflare.com/changelog/product/workers/) and
  [Workers TypeScript documentation](https://developers.cloudflare.com/workers/languages/typescript/)
- package registry metadata and the maintainers' package repositories for every selected target

## Compatibility and Governance Changes

- `scripts/check-dependencies.mjs` now deterministically validates Node/pnpm/CI alignment, duplicate
  direct declarations, prerelease direct versions, and React, MUI, TanStack, Tailwind, Commitlint,
  and Cloudflare ecosystem coherence.
- The same script runs a frozen offline strict-peer install and both full-tree and production audit
  checks. `pnpm outdated` remains informational so a live freshness lookup is not a deterministic CI
  gate.
- `pnpm-workspace.yaml` release-age exclusions were updated only for the selected
  typescript-eslint 8.65.0 package set.
- Playwright's matching Chromium runtime was installed outside the repository after the Playwright
  minor update.
- The Public event dialog now stays mounted but hidden after its first close. The attachment is
  still absent before first open, while reopening reuses the same image node and avoids a third
  Drive request. User-visible event behavior, API contracts, and layout are unchanged.

## Security, Peers, and Dependency Graph

| Check                           | Baseline          | Final             |
| ------------------------------- | ----------------- | ----------------- |
| Full audit, high/critical       | 4 high            | 0                 |
| Production audit, high/critical | 0                 | 0                 |
| Strict peer validation          | Pass; no warnings | Pass; no warnings |
| Duplicate runtime majors        | None              | None              |
| Prerelease direct dependencies  | None              | None              |

Baseline high findings were:

- `GHSA-v2hh-gcrm-f6hx`: `fast-uri@3.1.3` through Commitlint;
- `GHSA-f88m-g3jw-g9cj`: vulnerable Sharp range through Wrangler/Miniflare;
- `GHSA-r28c-9q8g-f849`: direct PostCSS 8.5.16;
- `GHSA-mh99-v99m-4gvg`: brace-expansion through ESLint/minimatch.

The selected Commitlint, Wrangler, PostCSS, and lint ecosystem updates refreshed the affected paths
without overrides or incompatible transitive substitutions. The final full-tree and production
audits report no known vulnerabilities.

The runtime graph has one React/React DOM major, one MUI/Emotion family, and one direct version for
each TanStack package both before and after. No runtime-major duplication was introduced.

The stable Vite/Wrangler toolchains retain the same pre-existing transitive prerelease package
identities (`@rolldown/pluginutils@1.0.0-beta.27`, `gensync@1.0.0-beta.2`,
`unenv@2.0.0-rc.24`, and `youch@4.1.0-beta.10`). No new prerelease identity or version was selected.
They are controlled transitives of stable direct releases; replacing them would require an
incompatible override or rejecting the stable toolchain updates.

## Performance Comparison

Measurements use Node 24.18.0, pnpm 10.34.5, and the same Windows workspace. Startup values come from
the repository's in-memory production analyzer; emitted asset values come from `dist`.

| Metric                            |  Baseline |     Final | Difference |                  Limit | Result                          |
| --------------------------------- | --------: | --------: | ---------: | ---------------------: | ------------------------------- |
| Synchronous JavaScript files      |         1 |         1 |          0 |                      1 | Pass                            |
| Synchronous raw JavaScript bytes  |   387,327 |   387,307 |        -20 |                388,000 | Pass                            |
| Synchronous gzip JavaScript bytes |   126,300 |   126,262 |        -38 |                127,000 | Pass                            |
| Emitted JavaScript assets         |       150 |       150 |          0 |              Not fixed | Pass                            |
| Largest emitted JavaScript asset  |   387,460 |   387,440 |        -20 | Startup governed above | Pass                            |
| Largest lazy JavaScript asset     |    96,341 |    96,341 |          0 |          No regression | Pass                            |
| Total emitted JavaScript bytes    | 1,459,484 | 1,459,506 |        +22 |              Not fixed | Pass; negligible lazy event fix |
| Emitted CSS assets                |         2 |         2 |          0 |          No regression | Pass                            |
| Total emitted CSS bytes           |    45,488 |    45,488 |          0 |          No regression | Pass                            |
| Vite transformed modules          |     1,390 |     1,390 |          0 |          No regression | Pass                            |
| Vite build duration               |   11.06 s |    9.59 s |    -1.47 s |          Informational | Pass                            |

The largest lazy asset remained `ContentPage` at 96,341 bytes. The event-dialog reuse change added a
small amount to an already-lazy Home component and accounts for the 22-byte total-JavaScript
increase; it did not enter the synchronous entry, change the largest lazy asset, or change route
ownership. The fixed limits were not raised.

## Media, Layout, and Design Governance

- `media:check`, `layout:check`, and `design:check` pass.
- The focused media suite finishes 7/7. Drive source widths, eager/high-priority ownership, deferred
  embeds, and Auth/Admin isolation remain governed. Auth routes observed zero Public fixture media
  or embed requests before and after.
- The starting focused media suite exposed one pre-existing failure: reopening an event attachment
  produced 3 Drive observations against a maximum of 2. The final dialog reuse behavior passes the
  maximum and preserves absence before first open. Other baseline media cases passed 6/7.
- The focused Public Shell suite finishes 10/10. Worst corrected local CLS was
  `0.0580079652567083` at baseline and `0.057929053537163246` in the final acceptance run; Footer
  Directory and cached navigation checks pass.
- The focused design-system browser suite finishes 17/17.
- These are deterministic local regression measurements, not a claim of improved production Core
  Web Vitals.

## Worker Acceptance

- `pnpm worker:typecheck`: pass.
- `pnpm exec vitest run cloudflare/public-api/test`: 56 files and 693 tests passed.
- `pnpm worker:deploy:dry`: pass with Wrangler 4.114.0; 400.22 KiB raw / 79.53 KiB gzip dry-run
  upload artifact.
- The dry run emitted the existing reminder that multiple environments exist and no target was
  selected. It did not deploy anything.

## Complete Validation

The final acceptance run used the required commands without weakened checks:

| Command                                                     | Result                         |
| ----------------------------------------------------------- | ------------------------------ |
| `pnpm install --frozen-lockfile --strict-peer-dependencies` | Pass                           |
| `pnpm format:check`                                         | Pass                           |
| `pnpm lint:strict`                                          | Pass                           |
| `pnpm test:unit`                                            | Pass                           |
| `pnpm test:integration`                                     | Pass                           |
| `pnpm build`                                                | Pass                           |
| `pnpm perf:check`                                           | Pass                           |
| `pnpm media:check`                                          | Pass                           |
| `pnpm layout:check`                                         | Pass                           |
| `pnpm design:check`                                         | Pass                           |
| `pnpm deps:check`                                           | Pass                           |
| `pnpm worker:typecheck`                                     | Pass                           |
| `pnpm worker:deploy:dry`                                    | Pass                           |
| `pnpm test:functional`                                      | Pass                           |
| `pnpm audit --audit-level=high`                             | Pass; no known vulnerabilities |
| `pnpm audit --prod --audit-level=high`                      | Pass; no known vulnerabilities |

Targeted TanStack tests passed 49 tests across 5 files. Focused design, media, Public Shell CLS, CMS
auth, and Worker suites also passed.

## Remaining Limitations

- The retained major ecosystems and Tailwind 4.3.3 performance rejection remain visible in
  `pnpm outdated`; the command's non-zero result is informational and intentional.
- jsdom 26 retains the deprecated test-only `whatwg-encoding@3.1.1` transitive. There is no
  production reachability or high/critical advisory, and removal requires the deferred jsdom major.
- Stable Vite/Wrangler direct releases still own the same four prerelease-labelled tool-only
  transitives that were already present at the starting commit; no direct dependency or newly
  introduced transitive uses a prerelease identity.
- Local bundle, Playwright, and CLS regression checks cannot establish field Core Web Vitals or
  production-network improvement.
- Build duration varies with local machine state and is recorded for comparison, not treated as a
  field-performance claim.

No Cloudflare Worker runtime code, D1 schema/migration/data, Worker binding, API contract, CMS auth,
session/CSRF/MFA/recovery-code behavior, role/capability, media contract, Apps Script runtime,
Vercel proxy behavior, analytics semantics, production content, or production secret was changed.
No manual deployment was performed.
