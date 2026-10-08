# CodeQL Security Remediation — Execution Tracker

**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Status:** **PAUSED AFTER S03 — PR-A merged; PR-B validated; S04 deferred**  
**Updated:** 2026-10-08 (Asia/Bangkok)  
**Baseline branch:** `main`  
**Baseline SHA:** `f793a608528a6986c8105bad69f27e5e7fdf6ce3`  
**Evidence:** user-supplied `codeql-alerts.json`, CodeQL 2.27.1, 18 open alerts (17 high / 1 medium), 7 rule types.  
**Implementation branch:** `security/codeql-facebook-response-pr-b`  
**PR-A:** [#530](https://github.com/yiwssx/new-www.rcat.ac.th/pull/530) (MERGED; `14c88c317a6f1f02f127a2055fa29ba91a664c2e`)  
**Execution scope:** PR-A complete in `main`; S03 implementation validated on PR #532. Pause after merging PR #532; S04 and all later tasks require a new instruction. No direct production mutation.

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
- **S02 Secure Production Verification**; Alerts: #1–3; Priority: P0; Status: DONE; Acceptance / next action: PR #530 merged at `14c88c3`; CI #3336 and PR CodeQL passed; post-merge main alert statuses deferred to S09
- **S03 Facebook double-decoding**; Alerts: #4–5; Priority: P1; Status: DONE; Acceptance / next action: PR-B #532 passes CI #3339, CodeQL and focused tests; verify main Code Scanning alerts separately at S09
- **S04 API stack trace exposure**; Alerts: #7; Priority: P1; Status: REVIEW; Acceptance / next action: Audit `jsonError` and Worker handlers; do not change generic serialization without a proven exposure
- **S05 URL sanitization**; Alerts: #11–18; Priority: P1; Status: PENDING; Acceptance / next action: Test protocol, exact hostname, userinfo, deceptive URL, allowed paths
- **S06 Date literal escaping**; Alerts: #6; Priority: P2; Status: PENDING; Acceptance / next action: Verify WordPress/Day.js tokens, Thai year, literal brackets
- **S07 Contextual security alerts**; Alerts: #8–10; Priority: P1; Status: REVIEW; Acceptance / next action: Confirm aggregate counters, HMAC rate-limit keys and SHA-384 + bcrypt, do not rush cryptography changes
- **S08 Cross-cutting regression**; Alerts: all; Priority: Gate; Status: PENDING; Acceptance / next action: CI, dependencies, format/lint, worker, governance, E2E, build
- **S09 Main re-scan and disposition**; Alerts: all; Priority: Gate; Status: PENDING; Acceptance / next action: After approved merges, re-scan current main and reconcile IDs
- **S10 Closure**; Alerts: all; Priority: Gate; Status: PENDING; Acceptance / next action: Record merged SHAs, actual alert status, follow-ups, residual risk

**Completed in `main`:** S00–S02; CI #3336 and CodeQL PR #530 succeeded.  
**S03 accepted on PR #532:** CI #3339 and CodeQL PASS. S04 remains REVIEW; stop here.  
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

- **PR-A**; Scope: #1–3; workflow + contract tests + Phase A runbook + tracker; State: MERGED #530
- **PR-B**; Scope: #4–5 remediation with #7 review deferred; State: PR #532 GREEN / READY FOR MERGE — `security/codeql-facebook-response-pr-b`
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

## Main synchronization checkpoint (2026-10-08)

- PR-A #530 synchronizes with `main` at `9639467c1265a0cc609c7ba4e6e1a16673dfc558` through an ancestry-preserving merge commit.
- Both branches changed disjoint files: main added the Organization Content tracker; PR-A contains only five security workstream files.
- S02 remains `IN_PROGRESS` until fresh CI and CodeQL on the merge head pass. PR-A stays Draft, and no deploy or merge into `main` is authorized in this step.

## Post-merge PR-A checkpoint (2026-10-08)

- PR #530 was merged into `main` as `14c88c317a6f1f02f127a2055fa29ba91a664c2e`.
- PR-head CI #3336 / run `37758188081` and CodeQL run `37758182560` both passed on `89d2647ce8812f7a187d2054e1251d9e25ccd198`.
- Post-merge Production Verification #150 / `37758845282` passed. Main CI #3337 and main CodeQL were in progress at this checkpoint.
- The GitHub connector does not expose the repository's Code Scanning Alerts API; a successful CodeQL workflow does not prove that alerts #1–3 are closed. Verify those separately at S09.
- PR-B changes only Facebook thumbnail decoding and related tests until S04 public-error-path review establishes whether additional remediation is justified. No changes to password hash, login, Worker/D1 schema, production services or unrelated features.

## PR-B implementation checkpoint (2026-10-08)

- Main commit `14c88c317a6f1f02f127a2055fa29ba91a664c2e`: CI #3337 / `37758845270` PASS; CodeQL main push #10 / `37758844653` PASS; Production Verification #150 and #151 PASS.
- Facebook image URL decoder now resolves exactly one layer of the supported HTML/JSON escapes, rather than allowing a cascade from `&amp;` into `&quot;` or `&#39;`. Existing HTTPS, hostname, credential and port validation remain unchanged.
- `server/appsScriptProxy/facebookThumbnail.test.mjs`: 8 of 8 focused Vitest tests pass (including nested HTML entity and JSON-escaped ampersand cases).
- Prettier 3.9.9 `--check` passed on both touched files and this tracker.
- S04 review: Worker top-level unhandled-error path emits a generic 500 via `jsonError("internal server error", 500)`. `responses.ts` is a generic serializer; verify downstream route exceptions and preview diagnostics before treating CodeQL #7 as an exploitable leak or changing API response contracts. No broad Error serialization rewrite is authorized by this checkpoint.

## S03 acceptance checkpoint — PR #532

- Exact-head CI #3339 / `37759554783`: SUCCESS (all mandatory lanes including aggregate `quality`).
- CodeQL PR analysis / `37759551597`: SUCCESS for Actions and JavaScript/TypeScript.
- Tested 8 of 8 Facebook thumbnail scenarios and Prettier 3.9.9 formatting.
- PR #532 is clean against `main` with zero commits behind at acceptance.
- After GitHub merges PR #532, this workstream is paused after S03. S04 remains REVIEW; S05–S10 remain pending. No production deployment, alert dismissal or other security implementation is authorized by this checkpoint.
