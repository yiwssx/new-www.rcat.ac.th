# Dependency Governance

- Document status: active
- Canonical: true

## 1. Purpose and scope

This document defines the durable dependency policy for the RCAT public website, CMS, Cloudflare Worker, test suites, and repository tooling. The committed `docs/maintenance/dependency-current-status.md` file is a reviewed snapshot, while current registry movement is reported by Renovate and the scheduled Dependency Monitoring workflow.

Dependency maintenance must preserve production behavior, authentication and authorization contracts, route boundaries, Worker bindings, data contracts, and repository quality gates.

## 2. Stable-release selection policy

Select stable releases only. A dependency may remain below registry `latest` while the release completes the three-day supply-chain age window or while a machine-checked compatibility exception in `config/dependency-policy.json` proves that the latest release is incompatible with an active runtime or peer constraint.

Registry lookup failures are errors, never evidence that an installed version is current.

## 3. Compatibility exceptions

Every exception in `config/dependency-policy.json` must identify a stable selected-version anchor, the blocked latest major, a package-specific reason, a machine-verifiable validation kind, and reproducible registry checks.

The active policy verifies that the installed version matches the manifest, remains in the approved compatibility major, and is the newest compatible age-eligible release. Exceptions must fail closed when their constraint is no longer valid.

## 4. Direct dependency and lockfile policy

Declare a package in only one direct dependency section. Commit `package.json` and `pnpm-lock.yaml` together whenever dependency resolution changes. Do not hand-edit the lockfile.

The canonical install is:

```bash
pnpm install --frozen-lockfile --strict-peer-dependencies
```

A dependency PR must contain a complete manifest/lockfile artifact before CI can pass.

## 5. Security audit thresholds

The full-tree audit threshold is `high`. The production audit threshold is `moderate`.

```bash
pnpm audit --audit-level high
pnpm audit --prod --audit-level moderate
```

Command failures and malformed audit output fail closed.

## 6. Security update response policy

For an advisory, identify the affected dependency path, runtime surface, fixed release, and release age. Prefer the smallest compatible stable update that removes the advisory and run the complete quality gates.

An urgent security fix younger than the normal release-age threshold may use a narrow one-command override during the controlled update. Never persist `minimumReleaseAgeExclude`, reduce audit thresholds, or add broad permanent overrides.

## 7. Strict peer dependency policy

Strict peer dependency validation is mandatory locally and in CI. Resolve peer conflicts by selecting supported releases or completing the required migration. Do not disable strict peer validation or hide a failed install.

## 8. Runtime and type declaration alignment

Runtime libraries that ship their own declarations own those types. Node, browser, and Cloudflare Worker globals must remain scoped to their respective TypeScript projects. Runtime-major declarations must match the runtime that executes the code.

## 9. TypeScript and typescript-eslint alignment

The selected TypeScript compiler must satisfy the installed `typescript-eslint` peer range. A compiler-major update requires strict peer install, lint, application and Worker typechecks, tests, build, and browser verification without suppressions.

## 10. Node and @types/node alignment

The Node engine declaration, `.node-version`, CI runtime, active runtime, and `@types/node` major must agree. A Node-major migration must update these surfaces as one coordinated change.

## 11. React and React DOM alignment

`react` and `react-dom` must use the same full version, and their type declarations must remain in the same runtime major. Major updates require focused rendering, routing, accessibility, lifecycle, and browser regression coverage.

## 12. MUI and Emotion alignment

`@mui/material` and `@mui/icons-material` must use the same full version and remain compatible with the declared Emotion packages. The existing focused-node restoration patch remains narrow and must be removed when an equivalent upstream fix is available.

## 13. Vite, Vitest, and jsdom alignment

Treat Vite build tooling and the Vitest ecosystem as compatibility-sensitive tooling. Renovate groups the Vite build surface where appropriate, while upstream monorepo grouping may group Vitest packages. `jsdom` remains subject to the focused-node restoration regression coverage because of the active MUI compatibility patch.

Build-tool updates require the production build, unit and integration tests, deterministic browser fixture readiness, and performance governance checks.

## 14. Cloudflare Worker tooling alignment

Keep Wrangler and `@cloudflare/workers-types` within their declared compatibility range. Renovate groups compatible Cloudflare patch/minor updates into one PR. Worker tooling updates require both Worker type projects, Worker tests, and `pnpm worker:deploy:dry`.

## 15. Supply-chain minimum release age

`pnpm-workspace.yaml` enforces `minimumReleaseAge: 4320`, requiring releases to age for three days before normal installation. Renovate uses the same three-day npm security preset without an additional release-age buffer, so the package manager and automation agree on eligibility.

The live monitor reports registry `latest`, publication time, and age-eligible backlog. Ordinary lag is informational in scheduled monitoring. Security response follows section 6.

Live registry monitoring is separate from blocking push and pull-request CI. Blocking CI validates the committed dependency artifact, strict peers, compatibility policy, security audits, and repository behavior without requiring a newly committed live-registry snapshot for every Renovate head.

## 16. Install-time build-script allowlist

`strictDepBuilds: true` is mandatory. The only approved install-time build packages are:

- `esbuild`
- `sharp`
- `workerd`

Any addition requires explicit review of the executed install script and ownership path.

## 17. Patch and minor update procedure

1. Review release notes, advisories, peer ranges, and release age.
2. Update the smallest compatible dependency group and regenerate the lockfile.
3. Run `pnpm install --frozen-lockfile --strict-peer-dependencies`.
4. Run `pnpm deps:check -- --skip-documentation-freshness` and `pnpm deps:docs:audit -- --skip-status-hashes`.
5. Run the complete CI gates and package-specific regression tests.
6. Allow the strict master ruleset to require the final Renovate head to be current before merge.

Do not add an Actions-generated documentation commit to an active Renovate PR. This avoids changing the PR head solely for reporting metadata and prevents unnecessary CI restart loops.

## 18. Major migration procedure

Evaluate major updates in isolated, reviewable changes. Read the upstream migration guide and identify affected runtime APIs, types, build output, tests, and deployment tooling before updating.

Reject migrations that require disabled peer validation, lower audit thresholds, blanket timeout increases, hidden errors, unsupported runtime combinations, or unreviewed performance-budget increases.

## 19. Required CI gates

The blocking quality path includes:

```text
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm deps:check -- --skip-documentation-freshness
pnpm deps:docs:audit -- --skip-status-hashes
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

No blocking gate may use `continue-on-error`, `|| true`, or another silent failure fallback.

The separate Dependency Monitoring workflow runs daily and on manual dispatch. It performs current registry and audit monitoring without modifying repository branches.

Renovate uses the `Asia/Bangkok` timezone and a maintenance window from 00:00 through 06:59. Branch creation, existing-branch updates/rebases, and Renovate-driven automerge are kept inside that window. `rebaseWhen: behind-base-branch` remains necessary because the master ruleset uses strict required status checks and requires the final merge candidate to be current with master.

Normal throughput is bounded to three concurrent Renovate PRs/branches, two new PRs per hour, and four branch commits/rebases per hour. Security alerts retain their dedicated security policy and are not intentionally delayed by ordinary backlog management.

## 20. Rollback procedure

If an update fails acceptance, revert the dependency group and its manifest, lockfile, configuration, source, tests, and policy changes together. Rerun the affected quality gates to prove the prior state remains valid. Do not keep a partially migrated dependency artifact.

For committed changes, use a normal reviewable revert. Do not use destructive Git commands that can discard unrelated work.

## 21. Documentation update procedure

The committed dependency status document is an operator snapshot, not a required mutation on every Renovate PR. Current registry movement is visible in the Dependency Dashboard and scheduled Dependency Monitoring output.

When an operator deliberately wants to refresh the committed snapshot, run:

```bash
pnpm deps:status
pnpm deps:status:check
pnpm deps:docs:audit
```

The manual **Dependencies / Snapshot Repair** workflow may prepare `automation/dependency-status-sync` when the committed snapshot hashes are stale. It never listens to Renovate PR synchronization events and never commits into Renovate branches. A maintainer PR is still required for the repair branch.

Use `pnpm deps:latest:check` only for an explicit full-freshness sweep. Technical repository documentation, source comments, generated labels, and commit messages use English; Thai remains appropriate for user-facing website content.
