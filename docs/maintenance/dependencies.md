# Dependency Governance

- Document status: active
- Canonical: true

## 1. Purpose and scope

This document defines the durable dependency policy for the RCAT public website,
CMS, Cloudflare Worker, test suites, and repository tooling. Current direct
versions and audit results are generated in
[Dependency Status](./dependency-current-status.md). Historical migration
sequence and completed upgrade checklists remain in Git history.

Dependency maintenance must preserve production behavior, authentication and
authorization contracts, route and lazy-loading boundaries, Worker bindings,
data contracts, and the repository's performance, media, layout, and design
governance.

## 2. Stable-release selection policy

Select stable releases from the registry. Do not select a prerelease merely
because it is numerically newer. A direct dependency may remain below the
registry `latest` release only when either a validated compatibility exception
in `config/dependency-policy.json` proves that the latest release is
incompatible with an active peer or runtime constraint, or a machine-validated
release-age hold proves that registry latest is not yet eligible.

Registry lookup is fail closed. A missing, malformed, or unreachable registry
response is an error, never evidence that the installed version is current.

## 3. Compatibility exceptions

Every exception must identify the selected version, the blocked latest major,
the package-specific reason, a machine-verifiable validation kind, and registry
commands that reproduce the constraint. The dependency checks verify that:

- the selected version matches the manifest and installed lockfile result;
- the registry latest stable version is retrieved successfully;
- the selected version is the newest release allowed by the active constraint;
- the registry latest release is still blocked by that constraint; and
- an exception fails as soon as it becomes stale.

The active exception classes are the TypeScript compiler range supported by
`typescript-eslint` and the `@types/node` major aligned with the repository Node
runtime. Add no exception that cannot be validated automatically.

## 4. Direct dependency and lockfile policy

Declare a package in only one direct dependency section. Use stable semantic
version specifiers supported by the dependency checks. Commit `package.json`
and `pnpm-lock.yaml` together whenever dependency resolution changes.

Install with:

```bash
pnpm install --frozen-lockfile --strict-peer-dependencies
```

Do not hand-edit the lockfile, hide an install error, or accept a lockfile whose
installed direct version conflicts with the manifest or compatibility policy.

## 5. Security audit thresholds

The required full-tree audit threshold is `high`. The required production audit
threshold is `moderate`.

```bash
pnpm audit --audit-level high
pnpm audit --prod --audit-level moderate
```

Both commands must exit with code 0. Audit output must be valid and include all
severity counts. A command failure or invalid JSON is `ERROR`, not zero
vulnerabilities.

## 6. Security update response policy

For an advisory, identify the direct or transitive dependency path, affected
runtime surface, fixed release, and package age. Prefer the smallest compatible
stable update that removes the advisory, regenerate the lockfile, and run the
complete gates.

An urgent fix younger than the normal release-age threshold may use an exact,
one-command release-age override during the controlled update. Record the
advisory, dependency path, and verification evidence. Do not persist
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`; the committed workspace
must retain the normal age policy without exclusions. Never reduce audit
thresholds or use broad overrides.

## 7. Strict peer dependency policy

Strict peer dependency validation is mandatory locally and in CI. Resolve a
peer conflict by selecting a supported stable release or completing the
necessary migration. Do not disable strict validation, use a silent fallback,
or treat a nonzero install as acceptable.

## 8. Runtime and type declaration alignment

Runtime libraries that ship declarations own their types; obsolete external
stub packages must be removed after compatibility tests pass. Runtime-major
declarations must match the runtime that executes the code. Browser, Node, and
Cloudflare Worker globals must remain limited to their owning TypeScript
projects.

## 9. TypeScript and typescript-eslint alignment

The selected TypeScript compiler must satisfy the installed
`typescript-eslint` peer range. The compatibility policy verifies the installed
lint package metadata against the registry and selects the newest stable
compiler allowed by that range. A compiler-major update is blocked until strict
peer install, lint, application and Worker typechecks, tests, build, and browser
verification all pass without suppression.

## 10. Node and @types/node alignment

The Node engine declaration, `.node-version`, CI runtime, active local runtime,
and `@types/node` major must agree. The compatibility policy selects the newest
stable `@types/node` release in the active runtime major and fails when the
registry latest release no longer requires an exception.

A Node-major migration must update runtime pins, CI, type declarations,
deployment runtime declarations where applicable, scripts, and integration
tests as one coordinated change.

## 11. React and React DOM alignment

`react` and `react-dom` must use the same full version. Their type declarations
must use the same runtime major. A React major update requires focused lifecycle,
rendering, routing, analytics, accessibility, functional, and regression tests.

## 12. MUI and Emotion alignment

`@mui/material` and `@mui/icons-material` must use the same full version and
remain compatible with the declared Emotion packages. A MUI major update
requires theme, component API, focus, accessible-role, responsive layout, and
design-system verification.

## 13. Vite, Vitest, and jsdom alignment

Treat Vite, its React plugin, Vitest, and jsdom as a compatibility group when a
major update changes transforms, bundler output, test mocks, or DOM behavior.
Acceptance requires a production build, unit and integration tests, deterministic
browser fixture readiness, and the committed performance gate.

The current Vite 8 and Rolldown performance checker follows the complete static
manifest graph. The reviewed React 19, MUI 9, and Vite 8 changes are an accepted
performance rebaseline, not permission to weaken the budget.

## 14. Cloudflare Worker tooling alignment

Keep Wrangler and `@cloudflare/workers-types` within their declared compatibility
range. Production Worker source owns Cloudflare globals in
`cloudflare/public-api/tsconfig.json`; Node-based Worker tests use the separate
`cloudflare/public-api/tsconfig.test.json` project. Do not expose Node globals to
production Worker source.

Worker tooling updates require both type projects, Worker tests, and
`pnpm worker:deploy:dry`. A dry run must not become a production deployment.

## 15. Supply-chain minimum release age

`pnpm-workspace.yaml` enforces `minimumReleaseAge: 4320`, requiring releases to
age for three days before normal installation. Keep the lockfile deterministic
and retain this protection during routine updates. Only the narrow, one-command
security response described above may bypass it during the controlled
installation; no exclusion may persist in the workspace.

The live dependency checker reports `Registry latest` when the installed stable
version matches the registry `latest` dist-tag. When a newer registry latest
exists, it validates that tag, the registry version inventory, and publication
timestamps from one metadata snapshot against a single controlled clock. If
registry latest is still too young, the checker may report
`Validated release-age hold` only when the installed version is exactly the
newest stable release currently eligible under the same window.

A release-age hold is derived from registry metadata rather than stored as a
permanent policy exception. It becomes invalid automatically at the recorded
eligibility time. Missing registry data, malformed timestamps, prereleases,
an installed version other than the newest eligible stable release, or an
expired hold must fail closed. Do not add `minimumReleaseAgeExclude` entries for
routine freshness timing.

## 16. Install-time build-script allowlist

`strictDepBuilds: true` is mandatory. The only approved install-time build
packages are:

- `esbuild`
- `sharp`
- `workerd`

Any addition requires evidence that the package must build during install, a
review of the executed script and ownership path, and removal when no longer
needed. Do not add broad script approvals.

## 17. Patch and minor update procedure

1. Confirm the branch and preserve unrelated working-tree changes.
2. Review registry release notes, advisories, peer ranges, and release age.
3. Update the smallest intended dependency set and regenerate the lockfile.
4. Run a frozen strict-peer install.
5. Run `pnpm deps:status`, `pnpm deps:latest:check`, `pnpm deps:check`, and
   `pnpm deps:docs:audit`.
6. Run the complete CI gates and package-specific tests for affected behavior.
7. Review the manifest, lockfile, generated status, and source diff before
   committing.

## 18. Major migration procedure

Evaluate a major in an isolated, reviewable change. Read the upstream migration
guide and identify affected runtime, types, APIs, bundler output, tests, and
deployment tooling before updating. Add focused compatibility tests where the
dependency owns authentication, routing, storage, build output, telemetry,
browser behavior, or Worker contracts.

Reject a trial that requires disabled peer validation, unsupported runtime or
compiler combinations, lower audit thresholds, weaker assertions, blanket
timeout increases, hidden errors, or an unreviewed performance-budget increase.
Record only durable final-state policy in active documentation; Git history
retains the migration sequence.

## 19. Required CI gates

The following checks are blocking:

```text
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm deps:status:check
pnpm deps:check
pnpm deps:latest:check
pnpm deps:docs:audit
pnpm format:check
pnpm lint:strict
pnpm test:unit
pnpm test:integration
pnpm build
pnpm perf:check
pnpm media:check
pnpm layout:check
pnpm design:check
pnpm worker:typecheck
pnpm worker:deploy:dry
pnpm test:functional
```

No gate may use `continue-on-error`, `|| true`, or another silent failure
fallback.

## 20. Rollback procedure

If an update fails acceptance, revert the dependency group and its source,
configuration, test, lockfile, policy, and generated-status changes together.
Rerun the affected baseline checks to prove the previous state remains valid.
Do not keep a partially migrated manifest or lockfile, and do not use destructive
Git commands that could discard unrelated work.

For a committed change, use a normal reviewable revert. For an uncommitted
trial, edit only the files owned by that trial after confirming the exact diff.

## 21. Documentation update procedure

After any manifest, lockfile, or compatibility-policy change:

```bash
pnpm deps:status
pnpm deps:status:check
pnpm deps:latest:check
pnpm deps:docs:audit
```

Commit the regenerated `dependency-current-status.md` with the inputs that
changed it. Keep this governance document version-agnostic except where a
current compatibility model or fixed repository policy must be explained.
Technical repository documentation, source comments, generated labels, and
commit messages use English; Thai remains appropriate for user-facing website
content.
