# CodeQL Security Remediation — Execution Tracker

**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Status:** **ACTIVE — PR-A #530 submitted; waiting for exact-head CI/CodeQL; STOP before S03**  
**Updated:** 2026-10-08 (Asia/Bangkok)  
**Baseline branch:** `main`  
**Baseline SHA:** `f793a608528a6986c8105bad69f27e5e7fdf6ce3`  
**Evidence:** user-supplied `codeql-alerts.json`, CodeQL 2.27.1, 18 open alerts (17 high / 1 medium), 7 rule types.  
**Implementation branch:** `security/codeql-actions-pr-a`  
**PR-A:** [#530](https://github.com/yiwssx/new-www.rcat.ac.th/pull/530) (Draft, base `main`; no merge authorized)  
**Execution authorization:** tracker adoption and S01–S02 only. Do **not** start S03–S10 in this turn.

## Objective

Eliminate confirmed weaknesses without changing expected website behavior, breaking CMS login or password compatibility, weakening release security, or degrading production verification. A green CodeQL run is not equivalent to zero alerts. Every alert needs a verified fix or an evidence-backed disposition.

## Safety and invariants

- Do not merge a red or unverified PR; do not bypass required gates, suppress queries wholesale, or dismiss alerts merely to produce zero.
- Preserve pnpm v10, existing CI and production approval gates, Vercel exact-commit deployment status, normal/ignored build behavior, and read-only browser smoke.
- Keep Cloudflare/D1 schema, production data, protected GitHub environments, Vercel, Apps Script and other live services unchanged absent separate approval.
- Preserve `bcrypt-sha384-v1` and bcrypt cost 12 pending any separately approved, compatible migration.
- No changes to Organization Chart or unrelated features.

## Status legend

`DONE` = evidence-backed; `IN_PROGRESS` = changes exist but not verified; `PENDING` = not started; `REVIEW` = decision requires evidence; `BLOCKED` = unable to proceed.

## Execution tracker

- **S00 Baseline and inventory**; Alerts: #1–18; Priority: P0; Status: DONE; Acceptance / next action: 18 open alerts at baseline SHA; JSON provides location, rule and severity
- **S01 GitHub Actions threat model**; Alerts: #1–3; Priority: P0; Status: DONE; Acceptance / next action: Provenance and cache boundary analyzed; see S01 findings below
- **S02 Secure Production Verification**; Alerts: #1–3; Priority: P0; Status: IN_PROGRESS; Acceptance / next action: PR-A changes proposed; require exact-head CI and Actions CodeQL evidence; not merged
- **S03 Facebook double-decoding**; Alerts: #4–5; Priority: P1; Status: PENDING; Acceptance / next action: Nested-entity tests + image-host restrictions
- **S04 API stack trace exposure**; Alerts: #7; Priority: P1; Status: PENDING; Acceptance / next action: Confirm all response data paths and safe diagnostics
- **S05 URL sanitization**; Alerts: #11–18; Priority: P1; Status: PENDING; Acceptance / next action: Test protocol, exact hostname, userinfo, deceptive URL, allowed paths
- **S06 Date literal escaping**; Alerts: #6; Priority: P2; Status: PENDING; Acceptance / next action: Verify WordPress/Day.js tokens, Thai year, literal brackets
- **S07 Contextual security alerts**; Alerts: #8–10; Priority: P1; Status: REVIEW; Acceptance / next action: Confirm aggregate counters, HMAC rate-limit keys and SHA-384 + bcrypt, do not rush cryptography changes
- **S08 Cross-cutting regression**; Alerts: all; Priority: Gate; Status: PENDING; Acceptance / next action: CI, dependencies, format/lint, worker, governance, E2E, build
- **S09 Main re-scan and disposition**; Alerts: all; Priority: Gate; Status: PENDING; Acceptance / next action: After approved merges, re-scan current main and reconcile IDs
- **S10 Closure**; Alerts: all; Priority: Gate; Status: PENDING; Acceptance / next action: Record merged SHAs, actual alert status, follow-ups, residual risk

**Scope complete for this session:** S00 + S01.  
**Implementation pending verification:** S02.  
**Alerts confirmed fixed by rescanning main:** 0/18 (baseline only).

## S01 — GitHub Actions threat model and remediation rationale

**Finding:** `actions/cache-poisoning/poisonable-step` #1–3 identifies execution of code checked out from `env.TARGET_SHA` in a job that subsequently installs dependencies and uses pnpm caching. On `workflow_run`, `TARGET_SHA` originated from `github.event.workflow_run.head_sha`. The browser job previously checked out that commit directly, without requiring the originating run to be a same-repository `push` or checking that its SHA is an ancestor of the trusted default-branch revision. A fork with a branch called `main` could be misclassified if only the branch name were inspected.

**Remediation proposed in PR-A:**

1. Accept post-CI browser smoke only for successful `push` CI where `head_branch == main` **and** `head_repository.full_name == github.repository`. Keep deliberate manual `workflow_dispatch` fallback.
2. Check out `github.sha` (trusted default-branch code) for executable verification scripts. Use full history for SHA ancestry and mark checkout `persist-credentials: false`.
3. Treat `TARGET_SHA` as data only: require 40-character hexadecimal SHA and `git merge-base --is-ancestor` of trusted `main` before reading its diff.
4. Classify the triggering CI commit (`TARGET_SHA^..TARGET_SHA`) with the existing `shouldIgnoreVercelBuild` classifier, not the checkout commit; preserve matching-SHA Vercel context, expected ignored builds, failure handling and bounded wait.
5. Preserve browser read-only behavior, Chrome/Playwright regression checks, manual dispatch, scheduled WAF/CSP/reliability and privileged-environment boundaries.

**Residual risks and assumptions:** The verification test source can be newer than the original CI commit when `main` advances; the deployment gate still verifies the original `TARGET_SHA`. A no-longer-reachable CI commit deliberately fails closed. Full-history fetch can increase checkout latency. Post-merge workflow behavior and CodeQL alerts must be verified before marking S02 `DONE`.

## Baseline alert mapping

- **#1–3**; CodeQL rule: `actions/cache-poisoning/poisonable-step`; Paths: `.github/workflows/production-verification.yml:160–170`; Planned treatment: PR-A — trusted code/CI SHA boundary
- **#4–5**; CodeQL rule: `js/double-escaping`; Paths: `server/appsScriptProxy/handler.mjs:376–380`; Planned treatment: PR-B — decoding tests
- **#6**; CodeQL rule: `js/incomplete-sanitization`; Paths: `src/utils/dateDisplay.ts:43`; Planned treatment: PR-C — literal escape behavior
- **#7**; CodeQL rule: `js/stack-trace-exposure`; Paths: `cloudflare/public-api/src/responses.ts:11`; Planned treatment: PR-B — response flow review
- **#8**; CodeQL rule: `js/clear-text-logging`; Paths: `scripts/check-production-auth-security-events.mjs:61`; Planned treatment: Evidence first
- **#9**; CodeQL rule: `js/insufficient-password-hash`; Paths: `scripts/phase-c3-disposable-fixture.mjs:106`; Planned treatment: Confirm SHA-384 + bcrypt
- **#10**; CodeQL rule: `js/insufficient-password-hash`; Paths: `server/cmsAuth/rateLimiters.mjs:10`; Planned treatment: Confirm HMAC-only key derivation
- **#11**; CodeQL rule: `js/incomplete-url-substring-sanitization`; Paths: `src/admin/pages/ExternalServicesPage.tsx:158`; Planned treatment: PR-C — URL validation
- **#12–15**; CodeQL rule: Same URL rule; Paths: `src/admin/pages/SettingsPage.tsx`; Planned treatment: PR-C — URL validation
- **#16–18**; CodeQL rule: Same URL rule; Paths: `src/utils/facebookEmbed.ts`; Planned treatment: PR-C — URL validation

## PR integration plan

- **PR-A**; Scope: #1–3; workflow + contract tests + Phase A runbook + tracker; State: IN_PROGRESS
- **PR-B**; Scope: #4–5 and #7; State: NOT STARTED
- **PR-C**; Scope: #6 and #11–18; State: NOT STARTED
- **PR-D (conditional)**; Scope: #8–10 security-context findings; State: REVIEW ONLY

## PR-A acceptance and stopping boundary

- Verify PR targets current `main`, no unrelated files, no production mutations.
- `quality` and all mandatory CI checks pass at _exact PR head SHA_.
- Confirm Actions CodeQL re-scan for PR head; if alert status cannot be queried with GitHub connector, record this explicitly instead of claiming #1–3 closed.
- Recheck branch trust, SHA ancestry, target-specific Vercel matching and ignored-build cases.
- **Stop after reporting PR-A/CI state. Do not merge PR-A or commence S03 without next instruction.**

## Checkpoint

PR-A #530 exists as Draft. CI runs `37754405142` and `37755328975` failed only at `pnpm format:check` on this tracker; all other functional and governance lanes passed. CodeQL passed both analyzers. The tracker now uses plain lists instead of manually aligned Markdown tables. S01 is complete; S02 remains IN_PROGRESS pending current-head CI/CodeQL checks. Initial run IDs `37754351542` (CI) and `37754347398` (CodeQL) correspond to the preceding PR head and must **not** be used as final verification after this tracker-only checkpoint commit. Re-read the latest PR head SHA and its runs before changing S02 status. No `main` merge, production deployment, D1 change, alert dismissal or subsequent phase has been initiated.
