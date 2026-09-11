# Post-P5H Current Project State

Status: current project-state note.

Updated: 2026-09-11.

The project remains in a post-P5H production governance and maintenance baseline with a configured Production Observability guard operating behind the protected `production` Environment reviewer gate, completed P6B Security Enforcement, completed P6C Recovery & Reliability, completed P6D Product/UX Improvements, and ongoing governed dependency maintenance. There is no active P6 feature-development phase.

Reliability Roadmap v2 is complete. It does not reopen or renumber P6. Phase 0 Development Quality Gate is complete, Phase A Field QA Foundation is complete and production-verified, Phase B Operational Visibility is complete and production-verified, and Phase C Deep Field Verification is complete and production-verified. Within Phase B, B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete. There is no active Reliability Roadmap v2 phase; future reliability work requires a new explicit scope. The canonical reliability phase definitions are recorded in `docs/architecture/reliability-roadmap-v2.md`.

Admin UX 00-10 is complete. The completed Admin UX work is tracked in `docs/admin/admin-ux-execution-tracker.md` and does not reopen M21.

P5H closed the original production-hardening sequence covering Worker maintainability, CMS link integrity, request correlation governance, Apps Script release governance, D1 credential-boundary hardening, and production audit/release evidence.

Production Observability completed its activation gate on 2026-08-29. The workflow is configured on a six-hour schedule but remains approval-gated: scheduled runs are created automatically and wait for an authorized `production` Environment reviewer before the analytics credential becomes available and the query can execute. It is therefore an operational guard, but not unattended monitoring. Closure evidence and operating constraints are recorded in `docs/operations/p6a-production-observability.md`.

P6B Security Enforcement was explicitly reopened by user request and completed on 2026-08-29. Its final runtime-aligned implementation places browser-facing API WAF enforcement at Vercel, sensitive Admin/Auth rate limiting in the Cloudflare Production Worker, enforcing CSP on the public SSR/frontend, and privacy-preserving auth anomaly handling. Scheduled D1 auth polling was retired on 2026-09-02; password-threshold signaling is event-driven and deeper aggregate diagnosis is manual-only. Closure evidence is recorded in `docs/operations/p6b-security-enforcement.md`.

P6C Recovery & Reliability was explicitly opened by user request on 2026-08-30 and completed on 2026-08-30. Its completed scope covers recovery objectives, unattended public reliability checks, D1 Time Travel readiness, runtime-only Worker rollback, Vercel immutable-deployment rollback readiness, and Apps Script rollback verification. On 2026-09-02 the ongoing reliability guard was reduced from twice-hourly to every six hours because its uncached Search probe intentionally exercises Worker/D1 reads; the duplicate WAF probe was removed because P6B owns scheduled WAF verification. Closure evidence is recorded in `docs/operations/p6c-recovery-reliability.md` and `config/p6c-recovery-readiness.json`.

P6C closure evidence includes CI #1637 (`33288591684`), P6C Production Reliability #5 (`33288591681`), D1 Recovery Drill #7 (`33295018757`), Worker Production Release #7 (`33271266147`), and READY Vercel production rollback candidates `dpl_45oLEHJb38mcAYbH29M7HgZAFNTx` and `dpl_2c91Y6hkZ2BdHdR6tGp7ZdjVPadi`. The D1 drill resolved a production Time Travel bookmark with the dedicated read-only credential and performed no restore/write. Healthy production was not mutated merely to prove rollback readiness. The closure evidence remains historical evidence of the contract that existed on 2026-08-30; current guard cadence/ownership is defined by the P6C runbook.

P6D Product/UX Improvements was explicitly opened on 2026-08-30 as the final planned P6 development phase and completed on 2026-08-30. Its completed scope covers public not-found recovery, public error recovery, form-native search-state synchronization, clear-search/no-result exits, and assistive result-count announcements. Implementation PR #176 merged as `c790e1bdaf65ff2ab309224337d98748b7afafa1` after CI #1648 (`33299665776`) passed all required lanes and the protected `quality` aggregate. Vercel production deployment `dpl_9t2rYRaPpgGb6TNKwRFsiPWKEetK` for that merge commit reached `READY`, and the exact production deployment returned HTTP 200 for both `/` and `/search?q=RCAT`. Closure evidence is recorded in `docs/operations/p6d-product-ux-improvements.md`.

Phase 0 Development Quality Gate was added after repeated formatter failures from remote/connector commits that bypass local Husky hooks. The repository now self-heals changed-file Prettier formatting on non-`master` branches while retaining `format:check` and the existing CI gates as independent validation.

Phase A Field QA Foundation is complete. It adds read-only desktop/mobile Playwright checks against the deployed production site and detects browser/runtime/console/network/layout failures that static analysis and raw HTTP checks cannot reliably expose. The normal path is automation-first: successful `master` CI waits for the matching Vercel deployment of the same commit SHA and then runs the production browser smoke. Manual dispatch remains a fallback only. Phase A completion evidence and safety boundaries are recorded in `docs/operations/phase-a-field-qa-foundation.md`.

Phase B Operational Visibility is complete and production-verified. B1 provides the protected `/admin/system-health` operator view using existing CMS authentication, capabilities, Request ID correlation, Admin API/Worker/D1 read paths, and public SSR. B2 Runtime Incident Feed is complete and production-verified: implementation PR #217 merged as `76ca0be1c17715b9e6cc2ec71de8d8e7eef81ea4`, its repository CI and Phase A production browser smoke succeeded, and canonical Worker release PR #218 at `51d286ddebbe0f05b5ddb21af601768ba0e472c3` passed Worker Production Release and follow-up Phase A verification. B3 Health Aggregation is complete and production-verified: implementation PR #270 merged as `cda947149fee0e79791bfc401efbc5c33f3adbb9`; final implementation head `b10ab8c99117fa1e254bd420df3f69de5ec77182` passed CI #2007 (`34547284821`); Vercel production deployment `dpl_94AZDYbaLc61t2XbmxMFCw1GQZyP` reached `READY`; and the exact production endpoint preserved the expected fail-closed CMS-session, `no-store`, Request ID, and P6B security boundary. Phase B scope and completion evidence are recorded in `docs/operations/phase-b-operational-visibility.md` and `docs/architecture/b3-health-aggregation-implementation-2026-09-11.md`.

Phase C Deep Field Verification is complete. C1 automated accessibility and C2 synthetic performance were completed through the read-only production field pipeline. C3 authenticated disposable CMS verification completed on 2026-09-07 with Phase C3 Round 19, GitHub Actions run `34126501500`, on exact `master` SHA `88ef27396472d618fbf2091c4bab0255c4d31397`; the browser field test, deterministic cleanup, and final zero-row verification all passed. C3 remains a manual protected deep-production regression tool and is not automatically dispatched by normal Worker production releases. Closure evidence is recorded in `docs/operations/phase-c-deep-field-verification.md`.

Governed Renovate dependency maintenance is expected to continue. It is not considered feature, runtime, or stabilization-scope expansion when it follows the repository dependency policy and passes the required CI/governance gates.

## Interpretation Rules

- M13-M21 documents are retained as migration and stabilization history.
- Historical milestone documents must not be treated as the current active project phase after P5H.
- Historical text that says M21 is open or owns remaining work describes the M20/M21-era stabilization snapshot, not the current project-state baseline.
- Production Observability is configured and activation-proven but approval-gated; do not describe it as unattended monitoring while `production` Environment approval is required.
- P6B Security Enforcement, P6C Recovery & Reliability, and P6D Product/UX Improvements are completed requested work that form part of the production governance baseline.
- P6D was the final planned P6 development phase. No P6 feature-development phase is active after its closure.
- Reliability Roadmap v2 is separate from P6 and is complete: Phase 0, Phase A, Phase B, and Phase C are complete; B1, B2, and B3 are closed work.
- Completed C3 field verification remains manual-only unless a newer explicit reliability scope reopens automation for mutable production verification.
- Do not recreate Request ID correlation, D1 observability, security/WAF/CSP checks, P6C reliability probes, Phase A post-deploy browser QA, B1/B2/B3 operator visibility, or Vercel RUM under new phase names.
- Current runtime ownership is defined by `docs/architecture/current-runtime-ownership.md`.
- Current deployment behavior is defined by `docs/deployment/runtime-deployment-guide.md`.
- Reliability Roadmap v2 is defined by `docs/architecture/reliability-roadmap-v2.md`.
- Phase A closure/current operating context is defined by `docs/operations/phase-a-field-qa-foundation.md`.
- Phase B closure/current operating context is defined by `docs/operations/phase-b-operational-visibility.md`.
- Phase C closure/current operating context is defined by `docs/operations/phase-c-deep-field-verification.md`.
- P5H closure context is defined by `docs/operations/p5h-maintainability-observability-2026-08-16.md`.
- Production Observability closure context is defined by `docs/operations/p6a-production-observability.md`.
- P6B Security Enforcement closure context is defined by `docs/operations/p6b-security-enforcement.md`.
- P6C Recovery & Reliability closure context is defined by `docs/operations/p6c-recovery-reliability.md`.
- P6D Product/UX Improvements closure context is defined by `docs/operations/p6d-product-ux-improvements.md`.
- Admin UX completion context is defined by `docs/admin/admin-ux-execution-tracker.md`.

## Reporting Rules

Use this wording for project status reports unless a newer explicit project-state document replaces it:

```text
post-P5H production governance baseline + Production Observability configured/approval-gated + P6B Security Enforcement completed + P6C Recovery & Reliability completed + P6D Product/UX Improvements completed + governed dependency maintenance + Admin UX 00-10 completed + Reliability Roadmap v2 complete (Phase 0 + Phase A + Phase B/B1-B3 + Phase C complete)
```

Do not report M20, M21, P6B, P6C, P6D, or Reliability Roadmap v2 Phase B as the current active feature-development/reliability phase. P6B, P6C, P6D, Phase 0, Phase A, Phase B, and Phase C are completed. Production Observability remains an operational guard whose scheduled executions are reviewer-gated, not unattended.

When reporting future changes, separate them into one of these buckets:

- current baseline: post-P5H production governance baseline, including approval-gated Production Observability plus completed P6B security, P6C recovery, P6D public UX, and completed Reliability Roadmap v2 controls
- completed reliability work: Phase 0 Development Quality Gate, Phase A Field QA Foundation, Phase B1 System Health Dashboard, Phase B2 Runtime Incident Feed, Phase B3 Health Aggregation, and Phase C Deep Field Verification
- active requested reliability work: none unless a newer explicit scope is opened
- completed UX work: P6D Product/UX Improvements and Admin UX 00-10
- ongoing operations: approval-gated Production Observability, the bounded six-hour P6C end-to-end reliability guard, P6B security checks, deployment-driven Phase A production browser QA, explicit-refresh B1/B2/B3 operator visibility, and manual-only C3 deep-production regression when deliberately invoked
- ongoing maintenance: governed dependency maintenance and narrowly scoped bug fixes
- new requested product/reliability work: describe any future scope explicitly rather than extending completed P6D, Phase B, or M21 implicitly

## Maintenance Posture

Preserve the completed runtime, security, recovery, public UX, Admin UX, Phase 0, Phase A, Phase B1/B2/B3, and Phase C boundaries. Keep recovery operations fail-closed, avoid destructive production drills, preserve protected Environment review requirements, and reuse existing credentials/correlation identifiers before requesting any new token or creating a duplicate Environment/secret. Production Observability remains approval-gated by design. P6C keeps only a bounded six-hour end-to-end SSR/Worker/D1 probe, while P6B owns its security checks and no longer performs scheduled D1 auth polling. Completed Phase B remains explicit-refresh operator visibility rather than a parallel monitoring stack. C3 remains manual-only and must not be coupled back into normal Worker production releases without a new explicit scope. Dependency maintenance may continue through governed Renovate PRs according to the repository dependency policy and CI gates. New product or reliability development requires a new explicit scope.
