# Public Auth Isolation Evidence

## Scope

This evidence covers the browser entry that Vite builds from `index.html`, which loads `src/main.tsx`. It verifies that CMS authentication, recovery-code, reauthentication, CMS shell, and Admin page sources are not part of the recursively reachable static JavaScript entry graph after the Public/Auth split.

The comparison sources are:

- Baseline: `1d827eaec7c2bbe7daf7a69f53497bd0c1f0f462`
- Corrected snapshot: the pre-commit corrective working tree based on `f15a7c2dde0ef6e3661754761624a26d67543862`

Both sources were built in isolated detached worktrees outside the repository. This kept ignored local environment files out of both builds.

## Measurement method

1. Install the exact lockfile with lifecycle scripts enabled.
2. Run the normal production build and typecheck.
3. Create a temporary Vite manifest build.
4. Select the manifest's `index.html` entry (`isEntry: true`), which loads `src/main.tsx`.
5. Recursively follow only each chunk's `imports` entries. Do not follow `dynamicImports`.
6. Count the reachable JavaScript files and sum their raw byte lengths.
7. Gzip each reachable JavaScript file independently with Node `zlib.gzipSync` at level 9, then sum the compressed byte lengths.
8. Run the same build with source maps in a separate temporary output directory. Use only those maps to associate source modules with the static graph; do not use the sourcemapped output for byte totals.

The measurements used Node `24.18.0`, pnpm `10.34.5`, and the repository-locked Vite `6.4.3`.

## Results

| Metric          | Baseline `1d827ea` | Corrected snapshot |             Delta |
| --------------- | -----------------: | -----------------: | ----------------: |
| Static JS files |                  1 |                  1 |                 0 |
| Raw bytes       |            554,833 |            389,608 | -165,225 (-29.8%) |
| Gzip bytes      |            174,850 |            128,006 |  -46,844 (-26.8%) |

| Source association in the static entry graph      | Baseline | Corrected snapshot |
| ------------------------------------------------- | -------- | ------------------ |
| `src/context/AuthContext.tsx`                     | Yes      | No                 |
| `src/features/cms-auth/**`                        | Yes      | No                 |
| Recovery Code components or contexts              | Yes      | No                 |
| `src/admin/components/ReauthenticationDialog.tsx` | Yes      | No                 |
| `src/admin/layout/CmsShell.tsx`                   | No       | No                 |
| `src/admin/pages/**`                              | No       | No                 |

The lazy route boundary is one-way after the correction:

- `src/routeComponents.tsx` dynamically imports `src/cmsAuthRouteComponents.tsx`.
- Both route modules statically import the shared `src/shared/components/RouteFallback.tsx`.
- `src/cmsAuthRouteComponents.tsx` does not import `src/routeComponents.tsx` back.

## Functional routes

The Chromium functional suite supplies deterministic successful Public API responses and verifies these routes:

| Route                                | Stable success assertion                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `/`                                  | Public layout and fixture site heading are visible                     |
| `/news`                              | Public layout, `ข่าว` heading, and fixture news title are visible      |
| `/content/functional-public-content` | Public layout and fixture content-detail level-one heading are visible |

Every route also asserts that the generic Public error alert is absent. After all three navigations, the intercepted request state must still show:

- zero `/api/cms-auth/session` requests;
- zero Admin capabilities requests;
- no `/api/cms-auth/**` requests.

## Reproduction commands

Run the baseline commands in a temporary detached worktree:

```bash
git worktree add --detach <temporary-path> 1d827eaec7c2bbe7daf7a69f53497bd0c1f0f462
cd <temporary-path>
pnpm install --frozen-lockfile
pnpm build
pnpm exec vite build --manifest --outDir .tmp/perf-dist
pnpm exec vite build --manifest --sourcemap --outDir .tmp/perf-map-dist
```

Run the same install and build commands against an isolated corrected snapshot. Parse `.tmp/perf-dist/.vite/manifest.json` for byte totals and `.tmp/perf-map-dist/**/*.map` only for source association.

The repository checks for the boundary and representative runtime paths are:

```bash
pnpm exec vitest run src/test/publicAuthImportBoundary.test.ts
pnpm exec playwright test tests/functional/cms-auth.spec.ts --project=chromium
```

Remove both temporary worktrees and their build directories after recording the results.

## Limits

- This is a static JavaScript entry-graph comparison, not a total application bundle-size comparison. Lazy route chunks are intentionally excluded.
- Gzip totals are deterministic local compression estimates, not observed CDN transfer sizes. Brotli, HTTP headers, caching, and runtime request timing are outside this measurement.
- Source association comes from a separate sourcemapped build with the same source and Vite configuration. Source maps are not part of the byte totals and are not committed.
- The result is one build per source, not a build-time benchmark.
- The functional fixture proves successful rendering and absence of CMS Auth bootstrap calls for the listed routes. It does not measure production network latency or deployed runtime behavior.
