# Agent Skills Wave A/B — Code Alignment Execution Tracker

Status: **ACTIVE — P01 IMPLEMENTED / CI VERIFICATION PENDING**

Updated: 2026-10-09 (Asia/Bangkok)

Repository: `yiwssx/new-www.rcat.ac.th`

Baseline branch: `main`

Planning branch: `docs/agent-skills-code-alignment-plan`

Planning PR: [#538](https://github.com/yiwssx/new-www.rcat.ac.th/pull/538) (documentation-only)

Implementation branch/PR: `agent/skills-align-p01-accessibility-links` / [#545](https://github.com/yiwssx/new-www.rcat.ac.th/pull/545)

## Goal

Bring the **actual code and runtime behavior** into alignment with the already installed Wave A and Wave B Agent Skills. This is a new code-alignment workstream, **not** a reinstallation, re-merge, or reopening of the completed Agent Skills Wave A/B program.

An installed skill, passing CI, or a completed tracker alone does not prove that implementation follows the skill. Each phase below must verify its own concrete code/runtime contracts.

## Authority and scope boundaries

- Root `AGENTS.md`, current `main`, current workflows, and current architecture/runtime ownership are authoritative.
- The existing `docs/workstreams/agent-skills-wave-a-b-tracker.md` stays **COMPLETE** and untouched.
- The Organization Content workstream stays **PAUSED**; do not begin organization schema, feature code, or content population.
- The separate CodeQL workstream reached S10 and was closed on `main` through PR #544 (14 fixed / 4 documented dismissals / 0 open, audited 2026-10-09). Preserve its independent ownership; do not reopen or duplicate its remediation here.
- Do not alter protected production environments, D1 data/migrations, Vercel/Worker/App Script deployments, DNS, credentials, or release tags during planning.
- Preserve pnpm v10, Cloudflare/Vercel ownership boundaries, production identity, read-only verification, authentication/RBAC/MFA/CSRF, revision-safe writes, CSP/SSR, dependency policy, and all required quality gates.
- Documentation planning is authorized now; **implementation begins only after an explicit new user instruction**. A merge of this tracker does not authorize any remediation phase.

## Evidence and confidence

The findings below arise from a **read-only, sampled static-code audit** of `main`; they do not claim end-to-end browser proof, current Cloudflare Dashboard state, production measurement, or a complete repository-wide compliance certification.

- **Confirmed code gap:** `src/routes.tsx` creates the TanStack Router without `defaultPreloadStaleTime: 0`, despite the vendored `router-query` recommendation. First verify installed-version semantics and refetch/hydration behavior.
- **Confirmed code gap:** `cloudflare/public-api/src/env.ts` maintains a handwritten `Env` interface. Compare it with current `wrangler.toml` and Wrangler-generated binding types before choosing migration.
- **Confirmed accessibility issue to test:** icon-only document file links in `src/admin/pages/DocumentsPage.tsx` use a tooltip on a wrapper but do not give the actionable anchor an explicit accessible name.
- **Reconciled on resumption:** `src/admin/pages/ExternalServicesPage.tsx` already uses `isValidCmsLink(..., "navigation", false)` from `shared/cmsLinkValidation.ts` (security PR #539). The earlier prefix-regex finding is resolved on current `main`; P01 adds missing positive/shared-edge regression coverage rather than duplicating this fix.
- **Confirmed architectural friction:** `cloudflare/public-api/src/routes/adminWrite.ts` owns significant SQL and business logic inside a large route module even though repository/data-access modules exist. This is a refactoring candidate, **not** proof of a security vulnerability.
- **Evidence needed:** `src/admin/pages/ContentPage.tsx` deliberately uses a wide, scrollable table. The RCAT Admin UI skill permits intentional table scrolling, but critical row actions must remain discoverable/reachable without browser zoom. Verify actual supported viewport behavior before classifying a defect.
- **Evidence needed:** `cloudflare/public-api/wrangler.toml` does not explicitly enable `observability.enabled` / `observability.traces.enabled`. Determine the real deployment/dashboard configuration and operational costs before proposing a change.
- **Documented trade-off:** `src/emotionSsr.ts` buffers the streamed Router HTML via `response.text()` before Emotion critical-CSS injection, so the final response is not progressive HTML streaming. This is a measured-performance decision, not an automatic violation.
- **Preserve:** request-local Router/QueryClient/Emotion runtime, public SSR hydration/SEO, shared `config/public-routes.json`, Worker/D1 data authority, protected release workflows, design tokens, targeted lazy-loading, and the tested Admin operation-feedback pattern.

## Status meanings

- **COMPLETE:** acceptance evidence recorded, required PR/checks merged when applicable.
- **PENDING:** authorized plan exists but no implementation has started.
- **REVIEW:** evidence/decision required before implementation can be justified.
- **BLOCKED:** external/technical obstacle identified; record the exact next check.
- **PAUSED:** no work may begin until the user explicitly resumes the relevant scope.

## Ordered implementation plan

### P00 — Plan and baseline (P0)

Status: **COMPLETE — PLANNING ONLY**

- Record the findings, concrete paths, scope boundaries, task sequencing, and acceptance criteria in this tracker.
- Submit **only this tracker** through a dedicated PR; require current-head CI/governance before merge.
- After merge, retain `PAUSED` and stop. No application, workflow, skills, dependency, schema, deployment, or security-tracker changes.

Acceptance: this document exists on `main` from a green, scoped documentation PR. This is **not** acceptance of remediation phases P01–P08.

### P01 — Accessible actions and shared URL validation (P1)

Status: **IN PROGRESS — PR #545 AWAITING EXACT-HEAD CI**

Implementation checkpoint (2026-10-09):

- Added item-specific `aria-label` to the focusable file-link `IconButton` in pinned and ordinary Document rows, with React Testing Library role/name assertions.
- Verified nearby ordering, edit/delete, and E-Service icon controls already provide labels; no unrelated Admin behavior changed.
- Verified current E-Service frontend already uses shared Worker URL validation after PR #539; added positive form-submission tests and shared URL-contract adversarial tests.
- Open PR: [#545](https://github.com/yiwssx/new-www.rcat.ac.th/pull/545), based on `main` `3bf559fcdb77d3c317e035af9fdecc105565409b` (CI result not yet established).
- Acceptance pending: formatting, focus tests, all required CI/governance, and merge confirmation.

Scope:

- Give document icon links an explicit accessible name on the focusable link (prefer an item-specific label) in both pinned and ordinary rows.
- Audit nearby icon-only Admin actions in the touched screens; preserve keyboard/focus/disabled semantics.
- Align the E-Service client-side navigation URL validation with `shared/cmsLinkValidation.ts` while **retaining the server validator as the security authority**.
- Preserve legitimate internal, HTTPS, HTTP, mailto and tel links as allowed by the current contract. Reject network-path URLs, malformed hosts, embedded credentials, control characters and disallowed schemes consistently.

Acceptance:

- Focused accessibility/keyboard tests identify each actionable icon link correctly.
- Positive and adversarial URL cases agree between the client and server without breaking supported existing records.
- Applicable unit/integration tests, format, lint, build, design and full required PR CI pass.

### P02 — TanStack Router + Query cache integration (P1)

Status: **PENDING**

Scope:

- Verify the project's installed TanStack Router version and current preload cache semantics; assess `defaultPreloadStaleTime: 0` in `src/routes.tsx`.
- Confirm Router preloads use the established QueryClient and do not create avoidable stale-data behavior or redundant fetches.
- Preserve request-local SSR state, Query dehydration/hydration, routing errors/redirects, canonical head and loader contracts.

Acceptance:

- Targeted tests cover preload freshness/invalidation, navigation/refetch, SSR isolation and hydration; no regression in network behavior.
- Relevant SSR/Query tests, E2E, build and current-head required CI pass.

### P03 — Wrangler bindings and Worker Env types (P1)

Status: **PENDING**

Scope:

- Inventory `wrangler.toml` bindings and current `Env` usage, including non-secret vars and test/dev/production optionality.
- Evaluate `wrangler types` as the generated source for platform bindings and define how secrets/optional runtime values are typed without losing safety.
- Make a scoped decision before changing types; do not copy production IDs/secrets or reintroduce preview resources.

Acceptance:

- Documented binding/type matrix with no missing, falsely optional or accidentally required runtime contracts.
- Worker typecheck, dry-run, unit/integration tests, security/governance and full required CI pass.

### P04 — Admin responsive reachability and accessibility (P1)

Status: **PENDING — BROWSER EVIDENCE REQUIRED**

Scope:

- Audit Content, Documents and other affected Admin tables/toolbars/dialogs at representative narrow mobile, tablet and desktop widths (e.g. 320/375/768/1024/1440 CSS px).
- For each view, test that View/Edit/Publish/Delete and other authorized actions remain discoverable and operable without browser zoom or clipping.
- Keep intentional **inner table scrolling** when it is genuinely usable; prefer an accessible action menu, wrapping or card/detail presentation only where evidence warrants it.
- Preserve MUI/Tailwind ownership, semantic tokens, touch targets, focus visibility and blocking mutation-result dialogs.

Acceptance:

- Reproducible before/after browser evidence for each confirmed defect, keyboard/touch verification and no unsupported horizontal page overflow.
- Responsive E2E, accessibility, design/bundle budgets and all required CI pass. Do not shrink text or hide actions to make a test green.

### P05 — Deepen Worker/D1 data-access seams (P2)

Status: **PENDING — ARCHITECTURE REVIEW REQUIRED**

Scope:

- Inspect hot paths and dependencies of `cloudflare/public-api/src/routes/adminWrite.ts`; identify true deep-module seams rather than creating passthrough wrappers.
- Extract SQL/data-access ownership **incrementally per domain** (e.g. Content, Documents, then additional domains only with evidence) behind small testable repository interfaces.
- Preserve parameter binding, revision/409 conflicts, capability checks, MFA/CSRF, audit identity, schema, public cache invalidation, and existing HTTP shapes.
- Keep D1 migrations append-only; **no schema change or production operation** is authorized by this refactor.

Acceptance:

- Before/after call/seam map and deletion-test rationale documented for each independently scoped PR.
- Existing and focused repository/route/RBAC/revision tests pass, along with Worker/typecheck, governance and required CI.

### P06 — Cloudflare observability configuration assessment (P2)

Status: **REVIEW — READ-ONLY DISCOVERY**

Scope:

- Check actual deployed Worker Logs/Traces settings and existing B1/B2/B3/P6 observability ownership; compare with vendored `workers-best-practices`.
- Evaluate sampling, sensitive-data exposure, retention, cost and diagnostic benefit; verify compatibility-date upgrade risk separately.
- Propose a configuration PR **only if evidence shows a meaningful gap**. Do not create duplicate monitors, scheduled polling, new credentials, or a paid observability stack by default.

Acceptance: decision documented as **implement** or **retain with rationale**, with privacy/cost/verification evidence. Any production configuration change requires independent explicit approval.

### P07 — Emotion SSR streaming trade-off assessment (P3)

Status: **REVIEW — MEASURE FIRST**

Scope:

- Measure current HTML size, SSR latency, memory use and TTFB for representative routes and real render failures.
- Compare current buffering/critical-CSS behavior with safe progressive alternatives compatible with React, Emotion, CSP nonce, Vercel and TanStack SSR.
- Keep buffering if benchmark/risk evidence does not justify a change; avoid a speculative streaming rewrite.

Acceptance: benchmark-backed decision/ADR and regression-test proposal; implementation is optional and separately authorized.

### P08 — Regression and drift prevention (P2)

Status: **PENDING — AFTER RELEVANT FIXES**

Scope:

- Add only deterministic tests/guards with a demonstrated regression risk (e.g. URL contract parity, icon-link accessible names, preload behavior, generated binding drift, responsive critical actions).
- Preserve existing CI lane ownership, `quality` aggregate context, production approvals, security thresholds, pnpm v10 and bounded CI polling.
- Do **not** claim that CI can verify an AI agent actually read every Skill; enforce observable code/runtime contracts instead.
- Keep completed CodeQL S10 closure independent. If new CodeQL regressions appear, handle under the separate security ownership without weakening scanning gates.

Acceptance: every new guard has a focused failing-before/passing-after case where applicable; no weakening/duplication of workflows; required CI passes on exact PR heads.

## Dependency order and PR discipline

1. First implementation authorization: reconcile the latest `main`, affected code, open PRs and this paused tracker. Change status to `ACTIVE` only after explicit user permission.
2. Start with P01; P02 and P03 can follow independently once P01's interface changes are stable.
3. Treat P04 as evidence-first. Do not declare a responsive regression solely from a wide-table `minWidth` when accessible scrolling remains usable.
4. Split P05 by real domain seams across small PRs; do not combine it with P02/P03 or rewrite the complete Worker.
5. P06 and P07 are decisions/measurements first; implementation requires a separate risk-based choice.
6. Add P08 guards alongside each fix where feasible, then perform a final cross-cutting audit.
7. Use one focused branch/PR for each phase or narrowly coupled subtask; do not merge red/unverified PRs, bypass CodeQL, or weaken budgets and required checks to force green.

Suggested implementation branches (future only): `agent/skills-align-p01-accessibility-links`, `agent/skills-align-p02-router-query`, `agent/skills-align-p03-worker-types`, `agent/skills-align-p04-admin-responsive`, `agent/skills-align-p05-d1-seams`.

## Verification and stop conditions

- For every future implementation PR: record exact branch/head SHA, changed files, test cases, CI run URL and all required outcomes before merge.
- Verify impacted feature contracts using the relevant Wave A/B skills, not merely passing generic lint/build.
- No production release, protected environment change, schema migration, data mutation or security alert dismissal without a separate authorized operation.
- If CI is still pending after the repository's bounded-wait limit, write the exact pending run and next check, then stop; do not infer success.
- Planning-only stop requirement was satisfied by merged PR #538. Explicit implementation resumption was granted on 2026-10-09; continue with the ordered phases and current tracker.
- On subsequent resumptions, use live GitHub state plus this tracker; never resume from historical chat assumptions.

## Current checkpoint

P00 remains complete through merged PR #538. P01 implementation has been submitted as PR #545; its exact-head CI/governance and merge remain pending. E-Service validation drift is already corrected in the CodeQL security workstream; Document link accessible names and focused regression tests are the actual P01 changes. Wave A/B skills installation remains complete; CodeQL S10 completed on main through PR #544; Organization Content stays paused.

Next action: inspect PR #545 checks on its latest head; repair concrete failures without bypasses; merge only after all required gates pass; record the final merge SHA and advance P02. Do not deploy or mutate production.
