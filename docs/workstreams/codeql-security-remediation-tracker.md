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

| Task                               | Alerts | Priority | Status      | Acceptance / next action                                                                                |
| ---------------------------------- | ------ | -------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| S00 Baseline and inventory         | #1–18  | P0       | DONE        | 18 open alerts at baseline SHA; JSON provides location, rule and severity                               |
| S01 GitHub Actions threat model    | #1–3   | P0       | DONE        | Provenance and cache boundary analyzed; see S01 findings below                                          |
| S02 Secure Production Verification | #1–3   | P0       | IN_PROGRESS | PR-A changes proposed; require exact-head CI and Actions CodeQL evidence; not merged                    |
| S03 Facebook double-decoding       | #4–5   | P1       | PENDING     | Nested-entity tests + image-host restrictions                                                           |
| S04 API stack trace exposure       | #7     | P1       | PENDING     | Confirm all response data paths and safe diagnostics                                                    |
| S05 URL sanitization               | #11–18 | P1       | PENDING     | Test protocol, exact hostname, userinfo, deceptive URL, allowed paths                                   |
| S06 Date literal escaping          | #6     | P2       | PENDING     | Verify WordPress/Day.js tokens, Thai year, literal brackets                                             |
| S07 Contextual security alerts     | #8–10  | P1       | REVIEW      | Confirm aggregate counters, HMAC rate-limit keys and SHA-384 + bcrypt, do not rush cryptography changes |
| S08 Cross-cutting regression       | all    | Gate     | PENDING     | CI, dependencies, format/lint, worker, governance, E2E, build                                           |
| S09 Main re-scan and disposition   | all    | Gate     | PENDING     | After approved merges, re-scan current main and reconcile IDs                                           |
| S10 Closure                        | all    | Gate     | PENDING     | Record merged SHAs, actual alert status, follow-ups, residual risk                                      |

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

| IDs    | CodeQL rule                                | Paths                                                   | Planned treatment                   |
| ------ | ------------------------------------------ | ------------------------------------------------------- | ----------------------------------- |
| #1–3   | `actions/cache-poisoning/poisonable-step`  | `.github/workflows/production-verification.yml:160–170` | PR-A — trusted code/CI SHA boundary |
| #4–5   | `js/double-escaping`                       | `server/appsScriptProxy/handler.mjs:376–380`            | PR-B — decoding tests               |
| #6     | `js/incomplete-sanitization`               | `src/utils/dateDisplay.ts:43`                           | PR-C — literal escape behavior      |
| #7     | `js/stack-trace-exposure`                  | `cloudflare/public-api/src/responses.ts:11`             | PR-B — response flow review         |
| #8     | `js/clear-text-logging`                    | `scripts/check-production-auth-security-events.mjs:61`  | Evidence first                      |
| #9     | `js/insufficient-password-hash`            | `scripts/phase-c3-disposable-fixture.mjs:106`           | Confirm SHA-384 + bcrypt            |
| #10    | `js/insufficient-password-hash`            | `server/cmsAuth/rateLimiters.mjs:10`                    | Confirm HMAC-only key derivation    |
| #11    | `js/incomplete-url-substring-sanitization` | `src/admin/pages/ExternalServicesPage.tsx:158`          | PR-C — URL validation               |
| #12–15 | Same URL rule                              | `src/admin/pages/SettingsPage.tsx`                      | PR-C — URL validation               |
| #16–18 | Same URL rule                              | `src/utils/facebookEmbed.ts`                            | PR-C — URL validation               |

## PR integration plan

| PR                 | Scope                                                       | State       |
| ------------------ | ----------------------------------------------------------- | ----------- |
| PR-A               | #1–3; workflow + contract tests + Phase A runbook + tracker | IN_PROGRESS |
| PR-B               | #4–5 and #7                                                 | NOT STARTED |
| PR-C               | #6 and #11–18                                               | NOT STARTED |
| PR-D (conditional) | #8–10 security-context findings                             | REVIEW ONLY |

## PR-A acceptance and stopping boundary

- Verify PR targets current `main`, no unrelated files, no production mutations.
- `quality` and all mandatory CI checks pass at *exact PR head SHA*.
- Confirm Actions CodeQL re-scan for PR head; if alert status cannot be queried with GitHub connector, record this explicitly instead of claiming #1–3 closed.
- Recheck branch trust, SHA ancestry, target-specific Vercel matching and ignored-build cases.
- **Stop after reporting PR-A/CI state. Do not merge PR-A or commence S03 without next instruction.**

## Checkpoint

PR-A #530 exists as Draft. Initial CI run 37754405142 failed only at `pnpm format:check` on this tracker (other eight CI lanes passed); the table formatting has been normalized without weakening the quality gate. CodeQL run 37754400282 passed both analyzers. S01 is complete; S02 remains IN_PROGRESS pending current-head CI/CodeQL checks. Initial run IDs `37754351542` (CI) and `37754347398` (CodeQL) correspond to the preceding PR head and must **not** be used as final verification after this tracker-only checkpoint commit. Re-read the latest PR head SHA and its runs before changing S02 status. No `main` merge, production deployment, D1 change, alert dismissal or subsequent phase has been initiated.
