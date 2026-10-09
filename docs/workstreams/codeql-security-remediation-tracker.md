# CodeQL Security Remediation — Execution Tracker

**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Status:** **ACTIVE — S05 merged; S06 date-format hardening in PR-D (CI pending)**  
**Updated:** 2026-10-09 (Asia/Bangkok)  
**Baseline branch:** `main`  
**Baseline SHA:** `f793a608528a6986c8105bad69f27e5e7fdf6ce3`  
**Evidence:** user-supplied `codeql-alerts.json`, CodeQL 2.27.1, 18 open alerts (17 high / 1 medium), 7 rule types.  
**Current implementation branch:** `security/codeql-date-literal-pr-d` (S06; PR pending)  
**PR-C:** [#539](https://github.com/yiwssx/new-www.rcat.ac.th/pull/539) (MERGED; `478ced6570ad49f03221ac4c6bf222867be755e4`)  
**PR-A:** [#530](https://github.com/yiwssx/new-www.rcat.ac.th/pull/530) (MERGED; `14c88c317a6f1f02f127a2055fa29ba91a664c2e`)  
**PR-B:** [#532](https://github.com/yiwssx/new-www.rcat.ac.th/pull/532) (MERGED; `42840c138c4d82d697801dc6b2217a0b4a5201f6`)  
**Execution scope:** S00–S03 and S05 merged into `main`; S04 remains REVIEW pending independent Code Scanning disposition. S06 is IN_PROGRESS in a separate branch; S07 remains REVIEW and S08–S10 pending. No production mutation.

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
- **S03 Facebook double-decoding**; Alerts: #4–5; Priority: P1; Status: DONE; Acceptance / next action: PR #532 merged as `42840c1`; final PR-head CI #3340 and CodeQL passed; verify main Code Scanning alert closures separately at S09
- **S04 API stack trace exposure**; Alerts: #7; Priority: P1; Status: REVIEW; Acceptance / next action: Audit `jsonError` and Worker handlers; do not change generic serialization without a proven exposure
- **S05 URL sanitization**; Alerts: #11–18; Priority: P1; Status: DONE; Acceptance / next action: PR #539 merged after exact-head CI and CodeQL PASS; main Code Scanning alert closures pending S09
- **S06 Date literal escaping**; Alerts: #6; Priority: P2; Status: IN_PROGRESS; Acceptance / next action: Reject custom Day.js bracket delimiters in WordPress format converter, preserve Buddhist-year presets and escaped letter tokens; exact-head CI/CodeQL required
- **S07 Contextual security alerts**; Alerts: #8–10; Priority: P1; Status: REVIEW; Acceptance / next action: Confirm aggregate counters, HMAC rate-limit keys and SHA-384 + bcrypt, do not rush cryptography changes
- **S08 Cross-cutting regression**; Alerts: all; Priority: Gate; Status: PENDING; Acceptance / next action: CI, dependencies, format/lint, worker, governance, E2E, build
- **S09 Main re-scan and disposition**; Alerts: all; Priority: Gate; Status: PENDING; Acceptance / next action: After approved merges, re-scan current main and reconcile IDs
- **S10 Closure**; Alerts: all; Priority: Gate; Status: PENDING; Acceptance / next action: Record merged SHAs, actual alert status, follow-ups, residual risk

**Completed in `main`:** S00–S03 and S05; PR #530, #532 and #539 merged after exact-head CI and CodeQL passed.  
**Current boundary:** S04 remains REVIEW; S05 is DONE (implementation); S06 is IN_PROGRESS in PR-D; S07 REVIEW; S08–S10 PENDING.  
**Code Scanning alert closures:** NOT VERIFIED via alert API; the historical baseline was 18 open alerts. A successful CodeQL workflow is not proof that those alerts are closed.

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
- **PR-B**; Scope: #4–5 remediation with #7 review deferred; State: MERGED #532 at `42840c1` — `security/codeql-facebook-response-pr-b`
- **PR-C**; Scope: #11–18 URL hardening (S05 only); State: MERGED #539 at `478ced6570ad49f03221ac4c6bf222867be755e4`
- **PR-D (S06)**; Scope: #6 Day.js/WordPress escaping; State: IN_PROGRESS — `security/codeql-date-literal-pr-d`
- **PR-E (conditional)**; Scope: #8–10 security-context findings; State: REVIEW ONLY

## PR-A acceptance and stopping boundary (historical)

- Verify PR targets current `main`, no unrelated files, no production mutations.
- `quality` and all mandatory CI checks pass at _exact PR head SHA_.
- Confirm Actions CodeQL re-scan for PR head; if alert status cannot be queried with GitHub connector, record this explicitly instead of claiming #1–3 closed.
- Recheck branch trust, SHA ancestry, target-specific Vercel matching and ignored-build cases.
- **Stop after reporting PR-A/CI state. Do not merge PR-A or commence S03 without next instruction.**

## Checkpoint (historical, before PR-A merge)

PR-A #530 existed as Draft. CI runs `37754405142` and `37755328975` failed only at `pnpm format:check` on this tracker; all other functional and governance lanes passed. CodeQL passed both analyzers. The tracker now uses plain lists instead of manually aligned Markdown tables. S01 is complete; S02 remains IN_PROGRESS pending current-head CI/CodeQL checks. Initial run IDs `37754351542` (CI) and `37754347398` (CodeQL) correspond to the preceding PR head and must **not** be used as final verification after this tracker-only checkpoint commit. Re-read the latest PR head SHA and its runs before changing S02 status. No `main` merge, production deployment, D1 change, alert dismissal or subsequent phase has been initiated.

## Main synchronization checkpoint (historical, 2026-10-08)

- PR-A #530 synchronizes with `main` at `9639467c1265a0cc609c7ba4e6e1a16673dfc558` through an ancestry-preserving merge commit.
- Both branches changed disjoint files: main added the Organization Content tracker; PR-A contains only five security workstream files.
- S02 remains `IN_PROGRESS` until fresh CI and CodeQL on the merge head pass. PR-A stays Draft, and no deploy or merge into `main` is authorized in this step.

## Post-merge PR-A checkpoint (historical, 2026-10-08)

- PR #530 was merged into `main` as `14c88c317a6f1f02f127a2055fa29ba91a664c2e`.
- PR-head CI #3336 / run `37758188081` and CodeQL run `37758182560` both passed on `89d2647ce8812f7a187d2054e1251d9e25ccd198`.
- Post-merge Production Verification #150 / `37758845282` passed. Main CI #3337 and main CodeQL were in progress at this checkpoint.
- The GitHub connector does not expose the repository's Code Scanning Alerts API; a successful CodeQL workflow does not prove that alerts #1–3 are closed. Verify those separately at S09.
- PR-B changes only Facebook thumbnail decoding and related tests until S04 public-error-path review establishes whether additional remediation is justified. No changes to password hash, login, Worker/D1 schema, production services or unrelated features.

## PR-B implementation checkpoint (historical, 2026-10-08)

- Main commit `14c88c317a6f1f02f127a2055fa29ba91a664c2e`: CI #3337 / `37758845270` PASS; CodeQL main push #10 / `37758844653` PASS; Production Verification #150 and #151 PASS.
- Facebook image URL decoder now resolves exactly one layer of the supported HTML/JSON escapes, rather than allowing a cascade from `&amp;` into `&quot;` or `&#39;`. Existing HTTPS, hostname, credential and port validation remain unchanged.
- `server/appsScriptProxy/facebookThumbnail.test.mjs`: 8 of 8 focused Vitest tests pass (including nested HTML entity and JSON-escaped ampersand cases).
- Prettier 3.9.9 `--check` passed on both touched files and this tracker.
- S04 review: Worker top-level unhandled-error path emits a generic 500 via `jsonError("internal server error", 500)`. `responses.ts` is a generic serializer; verify downstream route exceptions and preview diagnostics before treating CodeQL #7 as an exploitable leak or changing API response contracts. No broad Error serialization rewrite is authorized by this checkpoint.

## S03 acceptance checkpoint — PR #532

- Final exact-head CI #3340 / `37760587399`: SUCCESS (all mandatory lanes including aggregate `quality`).
- Final PR-head CodeQL analysis / `37760582651`: SUCCESS for Actions and JavaScript/TypeScript.
- Tested 8 of 8 Facebook thumbnail scenarios and Prettier 3.9.9 formatting.
- PR #532 is clean against `main` with zero commits behind at acceptance.
- PR #532 was merged into `main` on 2026-10-08 at 10:05:30 UTC as `42840c138c4d82d697801dc6b2217a0b4a5201f6`. This workstream is PAUSED after S03; S04 remains REVIEW and S05–S10 remain pending. No further security implementation, production operation, or alert dismissal was authorized by this checkpoint.

## Resumption checkpoint — 2026-10-09 (S04 review / S05 PR-C)

- Reconciled current `main` at `df722a403b4f1d4180c78894aeb17e607a49851e`: main CI run `37868970586` PASS, CodeQL run `37868970151` PASS for Actions and JavaScript/TypeScript, and Production Verification `37869276628` PASS. These results establish analysis success, **not alert closure**.
- **S04 evidence review:** `cloudflare/public-api/src/index.ts` catches unhandled errors, logs only a bounded error name/request context via `logUnhandledWorkerError`, and responds with the constant `jsonError("internal server error", 500)`. `responses.ts` serializes its explicit arguments; reviewed call sites primarily send static messages and non-sensitive resource/status fields. No trace string has been shown to reach a public HTTP response. Keep #7 in REVIEW until alert API data and a focused negative contract are available; do not rewrite generic serialization or dismiss #7 on this inference alone.
- **S05 scope:** replace E-Service prefix regex with Worker-shared `isValidCmsLink`, check example placeholders by **parsed hostname** rather than substring, harden Google Maps host/port/userinfo validation, consolidate Facebook URL parsing with exact-host HTTPS/no-userinfo/no-non-default-port checks. Add shared/React/Facebook regression tests for protocol-relative links, deceptive authorities, credentials, ports, and valid links.
- **S06:** display settings are constrained to five canonical date formats by `normalizeDateFormat`, so ordinary settings cannot provide arbitrary Day.js tokens. The exported converter still merits a dedicated escaped-literal test and review; it is not declared resolved.
- **S07:** contextual alerts #8–10 not changed: auth diagnostic reads aggregate counters; rate limiter uses HMAC-SHA256 keyed identifiers; disposable C3 fixture uses SHA-384 prehash followed by bcrypt cost 12. Reconcile with alert API before any disposition or cryptographic change.
- PR-C is review-only until its **exact-head CI and CodeQL** pass. No worker deployment, D1 write, release, credential, protected-environment operation, or unrelated work is authorized.

### PR-C durable CI checkpoint (2026-10-09)

- Draft [PR #539](https://github.com/yiwssx/new-www.rcat.ac.th/pull/539) targets `main`, branch `security/codeql-url-validation-pr-c`.
- First implementation commit `a3978706e510bf51d97d063823347ec536fb6b14` opened CI run `37870614792` and CodeQL run `37870612051`; both were still IN_PROGRESS at review. Those checks **do not qualify** as final evidence after this tracker/format checkpoint commit.
- The new PR-head SHA must be re-read and its full required CI / CodeQL suite checked before any ready-for-review or merge decision. S05 remains IN_PROGRESS; no production change.

## S05 acceptance / S06 implementation checkpoint — 2026-10-09

- PR #539 final exact head `98988d61fce0566a8e7afb9ad4893339b73b83d4`: CI `37870773017` SUCCESS (all lanes and aggregate quality), CodeQL `37870770324` SUCCESS (Actions and JavaScript/TypeScript). PR had no merge conflict and merged into `main` as `478ced6570ad49f03221ac4c6bf222867be755e4`.
- S05 implementation is DONE; do not claim Code Scanning alert #11–18 closure without the alert API. Post-merge `main` CI/CodeQL needs separate confirmation for S09.
- S06 scope: `src/services/displaySettings.ts` already normalizes stored/public/Admin date formats to five supported WordPress presets. `convertWordPressFormatToDayjs` is exported and additionally supports WordPress escaped letters; the previous bracket sanitizer attempted to backslash-escape `]` in Day.js literal delimiters, which does not establish a reliable Day.js escaping contract. Instead fail closed to the Buddhist-year fallback `D MMMM BBBB` when either Day.js bracket delimiter appears; retain `\\Y`, `\\a`, `\\t` escaped-letter behavior and test suspicious delimiter formats.
- S07 evidence: `scripts/check-production-auth-security-events.mjs` logs aggregate failure/lockout counts only and emits `GITHUB_OUTPUT` counts; `server/cmsAuth/rateLimiters.mjs` uses HMAC-SHA256 to derive bounded rate-limit map keys (not password storage); `scripts/phase-c3-disposable-fixture.mjs` derives a SHA-384 domain-separated prehash then bcrypt cost 12 and performs a comparison before using a disposable QA credential. These are contextual findings requiring Code Scanning API dispositions and no auth migration; S07 remains REVIEW.
- S06 PR must pass exact-head CI and CodeQL before merging. Never weaken auth, D1, release gates or production controls.
