# Cloudflare Security Audit Skill Integration

Status: **ACTIVE — INTEGRATION MERGED; SCOPED PILOT PENDING INDEPENDENT SANDBOXED EXECUTION**

Updated: 2026-10-25 (Asia/Bangkok)

Repository: `yiwssx/new-www.rcat.ac.th`

Baseline: `main` at integration merge commit `327b1691e9ccfe0e17febdf8a094f844411211f2` (2026-10-25)

Integration branch: `chore/security-audit-skill`

Integration PR: [#711](https://github.com/yiwssx/new-www.rcat.ac.th/pull/711) (merged 2026-10-25 17:14 ICT; squash commit `327b1691e9ccfe0e17febdf8a094f844411211f2`)

Upstream: `cloudflare/security-audit-skill@c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (MIT)

## Goal

Vendor the complete pinned Cloudflare Security Audit Agent Skill into existing RCAT repository-scoped skills and establish an evidence-based, non-production pilot process without duplicating CI or reopening completed security workstreams.

## Scope and boundaries

- Add upstream `skills/security-audit/*` files without source modifications; include upstream MIT license and validator tests.
- Document usage and pin provenance in `.agents/skills/README.md`; add selection/safety rules in `AGENTS.md`; exclude unmodified vendor sources from Prettier rewriting.
- Preserve `security-guidance` (OWASP ASVS), existing CodeQL, Renovate, CI/security/governance and Production Verification workflows.
- Do not add dependencies, alter app/runtime source or production configuration, execute target-controlled code without a sandbox, call live endpoints, access production secrets/data, migrate D1, or deploy.
- A full six-phase audit requires independent agent assignments and an OS-enforced resource-limited no-network sandbox. This installation alone does not satisfy that prerequisite.
- Any unremediated finding is private under `SECURITY.md`; public trackers/PRs must contain process status only, not exploit evidence.

## Checkpoints

- [x] Review current `main` repository skills, CI, security and production boundaries.
- [x] Select and verify exact upstream commit, source file SHA equality and MIT license.
- [x] Prepare integration documentation and skill registration.
- [x] Open an integration PR to `main` and record the exact PR and head SHA.
- [x] Verify all 20 upstream vendored files and MIT license against pinned source blob SHAs.
- [x] Verify vendored Node validator self-tests in the dedicated Node test-runner CI step (Unit Tests passed on prior head).
- [x] Require current-head PR CI/governance green and GitHub-accepted protected-main merge (expected head SHA enforced).
- [ ] Conduct a separate **read-only, scoped** Pilot Audit for Admin auth/session/MFA, Worker RBAC/D1, and Vercel-to-Worker trust boundaries. Select `quick` or `standard` profile only if proper independent-agent and sandbox execution is available; otherwise perform a labeled preliminary static review and retain unverified leads as `needs_validation`.
- [ ] Privately triage confirmed findings, open separate narrow remediation PRs with regression tests, and verify required gates. Do not auto-merge security fixes or deploy.
- [ ] Record completion evidence and close this tracker when integration and pilot conditions are satisfied.

## Pilot acceptance

- Baseline SHA, scope, selected companions, execution profile, exclusions, and observed evidence are recorded without publishing unpatched exploit paths.
- No finding is called `confirmed` or assigned severity without source-grounded trust-boundary proof and independent review.
- Sandbox or independent-agent unavailability is stated clearly; do not fabricate six-phase outputs.
- Each approved remediation is isolated and tested; application behavior/production are unchanged by skill installation.

## Current checkpoint

PR #711 initial commit added the pinned skill at upstream `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (21 unchanged source files including MIT license), docs and registration.

- PR head before CI correction: `268eccb622801dd88df0694d15a3405dae9b64ea`.
- [CI #40151869007](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40151869007) failed the aggregate `quality` check because Vitest discovered two vendored `node:test` suites as if they were Vitest tests; its 2,751 application tests passed, and other primary CI lanes passed.
- Corrected: exclude vendored skill trees from Vitest discovery in `vite.config.ts`, and run both untouched upstream validator test suites using `node --test` in the existing Unit Tests lane. Both verifications passed in [CI #40162508225](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40162508225).
- Follow-up: [CI #40162508225](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40162508225) failed only Static Quality due to Prettier formatting in `vite.config.ts`. The exclude list was reformatted to comply with repository Prettier print width (120); rerun required on the new head.
- No runtime application behavior, dependencies, production state, or vulnerable-code claims changed.
- Integration merged after current-head checks passed; read-only scoped pilot security review and private remediation triage remain pending.

## Integration merge verification — 2026-10-25

- PR #711 head `e6c09a40e65027a578940f48a010055d785c099b` completed [CI #40183442228](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/40183442228) with success. Dependency Preflight, Governance, Dependencies, Unit Tests (including vendored validator suites), Integration Tests, Build, Functional E2E, Worker, Static Quality, aggregate quality, and CodeQL check runs passed on that head.
- GitHub accepted squash merge with `expected_head_sha=e6c09a40e65027a578940f48a010055d785c099b`. PR is closed/merged; `main` was verified at `327b1691e9ccfe0e17febdf8a094f844411211f2` immediately after merge. Post-merge main checks were queued at the time of this entry and require independent completion verification.
- This merge installs pinned audit tooling and documentation only; it does **not** constitute an application security audit or production deployment.

## Read-only scoped pilot — preliminary static review (not a six-phase audit)

- **Baseline:** `327b1691e9ccfe0e17febdf8a094f844411211f2` (integration merge on `main`).
- **Scope:** Admin authentication, session and MFA; Worker authorization/RBAC and D1 session boundaries; Vercel-to-Worker trust boundary.
- **Read-only source inspected:** `server/adminProxy/handlers.mjs`, `server/cmsAuth/handlers.mjs`, `server/cmsAuth/protocol.mjs`, `server/cmsAuth/upstreamFetch.mjs`, `cloudflare/public-api/src/auth/adminAccess.ts`, `adminRoutePolicy.ts`, `adminCapabilities.ts`, `adminStepUp.ts`, `cmsSessionService.ts`, and `cloudflare/public-api/src/routes/cmsAuthInternal.ts`. Existing relevant tests were located, including `cmsAdminAccess.test.ts`, `adminAuthorizationMatrix.test.ts`, `adminRoutePolicy.test.ts`, `cmsMfaD1Integration.test.ts`, and `server/adminProxy/handlers.test.mjs`.
- **Preliminary observations (not validation):** The reviewed source contains request-origin checks, proxy-secret verification, session/CSRF enforcement, role-capability policy and step-up mechanisms. Presence of controls or green CI does not establish complete trust-boundary security. No issue was independently confirmed or severity-ranked in this limited inspection; this is **not** a clean-security finding.
- **Execution profile:** none selected. Independent agent assignments and an OS-enforced, resource-limited, no-network sandbox were **not available/verified in this execution**. Accordingly, no six-phase skill execution, target-controlled code execution, dynamic exploitation, or independent validation was performed. All potential leads remain `needs_validation` and must not be published as confirmed findings.
- **Exclusions:** live endpoints, production data/secrets, deployments, D1 migrations, security-affecting runtime changes, and unapproved active tests. No such operations were performed.
- **Next gate:** Provision and verify the independent agents and enforced sandbox; then select `quick` or `standard`, run the scoped pilot against the pinned baseline, privately triage source-grounded findings under `SECURITY.md`, and create separate narrow remediation PRs with regression tests only if warranted. Do not mark the pilot or tracker complete before these gates are met.
