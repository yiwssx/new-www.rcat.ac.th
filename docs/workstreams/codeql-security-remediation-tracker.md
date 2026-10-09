# CodeQL Security Remediation — Execution Tracker

**Repository:** `yiwssx/new-www.rcat.ac.th`  
**Status:** **CLOSED — S00–S10 accepted; 14 fixed, 4 evidence-dismissed, 0 open Code Scanning alerts on main**  
**Updated:** 2026-10-09 (Asia/Bangkok)  
**Baseline branch:** `main`  
**Baseline SHA:** `f793a608528a6986c8105bad69f27e5e7fdf6ce3`  
**Evidence:** user-supplied `codeql-alerts.json`, CodeQL 2.27.1, 18 open alerts (17 high / 1 medium), 7 rule types.  
**Finalized baseline:** `main` at `30ccc13a9d3346856d4defd21ed8fd66b68ef132` (PR #542, CI / CodeQL / Production Verification passed)  
**Finalization branch:** `security/codeql-s10-finalization` (closure tracker only; no temporary auditing workflows retained)  
**PR-C:** [#539](https://github.com/yiwssx/new-www.rcat.ac.th/pull/539) (MERGED; `478ced6570ad49f03221ac4c6bf222867be755e4`)  
**PR-D:** [#540](https://github.com/yiwssx/new-www.rcat.ac.th/pull/540) (MERGED; `6e7a857a969158e9a8f3ed30e184e5ac545e1084`)  
**PR-A:** [#530](https://github.com/yiwssx/new-www.rcat.ac.th/pull/530) (MERGED; `14c88c317a6f1f02f127a2055fa29ba91a664c2e`)  
**PR-B:** [#532](https://github.com/yiwssx/new-www.rcat.ac.th/pull/532) (MERGED; `42840c138c4d82d697801dc6b2217a0b4a5201f6`)  
**Execution scope:** All S00–S10 phases complete. Four implementation PRs (#530, #532, #539, #540) plus two verification/hardening PRs (#541, #542) merged, with passing CI and CodeQL. Official GitHub Code Scanning REST API audited all baseline alerts on `main`: 14 fixed and four individually dismissed with detailed evidence as false positives; total open scan alerts = 0. No production data/secret/migration mutation.

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
- **S04 API stack trace exposure**; Alerts: #7; Priority: P1; Status: DONE; Acceptance / next action: PR #541 negative Worker error-boundary test + PR #542 recovery error-message redaction; #7 individually dismissed `false positive` after evidence review. Monitor if scanner reopens
- **S05 URL sanitization**; Alerts: #11–18; Priority: P1; Status: DONE; Acceptance / next action: PR #539 merged after exact-head CI and CodeQL PASS; main Code Scanning alert closures pending S09
- **S06 Date literal escaping**; Alerts: #6; Priority: P2; Status: DONE; Acceptance / next action: PR #540 merged after exact-head CI / CodeQL PASS; alert closure pending S09
- **S07 Contextual security alerts**; Alerts: #8–10; Priority: P1; Status: DONE; Acceptance / next action: Aggregated numeric-only auth metrics, SHA-384 + bcrypt cost 12 and rate-limit HMAC verified; each alert individually dismissed as `false positive` with explanation
- **S08 Cross-cutting regression**; Alerts: all; Priority: Gate; Status: DONE; Acceptance / next action: PR #541 and #542 exact-head CI/CodeQL passed; main #542 CI `37873931842`, CodeQL `37873932201`, Production Verification `37874221628` passed
- **S09 Main re-scan and disposition**; Alerts: all; Priority: Gate; Status: DONE; Acceptance / next action: Authenticated main audit runs `37874569780` and `37874627952` confirm 14 fixed, #7–10 dismissed false positive with individual explanations and ALL_OPEN_SCAN_ALERTS=0
- **S10 Closure**; Alerts: all; Priority: Gate; Status: DONE; Acceptance / next action: Record closure evidence and per-alert reasons below; reopen only upon new reproducible exposure or CodeQL alerts

**Completed in `main`:** S00–S10; PR #530, #532, #539, #540, #541, #542 merged with required CI/CodeQL checks passing.  
**Final disposition:** S00–S10 DONE. Main Code Scanning Alert API confirms 18 historical alerts: 14 `fixed`, 4 `dismissed` (reason `false positive`), zero `open` repository Code Scanning alerts on `main`. The four dismissals are risk-accepted interpretations, **not** claims that those CodeQL query matches were automatically fixed.  
**Code Scanning alert closures:** VERIFIED via the repository's authenticated official Code Scanning REST API (temporary no-checkout Actions audits #37874569780 and #37874627952). 14 fixed and four dismissed with comments; no open alerts on `main` at the verification checkpoint.

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
- **PR-D (S06)**; Scope: #6 Day.js/WordPress escaping; State: MERGED PR #540 at `6e7a857a969158e9a8f3ed30e184e5ac545e1084`
- **PR-E (S04/S07 evidence)**; Scope: Worker error-boundary and HMAC regression tests; State: MERGED #541 at `ada2ae7529c9eaaf20a20e2390f2643dc4af13f1`
- **PR-F (S04 hardening)**; Scope: Redact internal Admin backup recovery exception messages; State: MERGED #542 at `30ccc13a9d3346856d4defd21ed8fd66b68ef132`

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

### PR #540 CI waiting checkpoint (2026-10-09)

- Draft PR #540 opened on `security/codeql-date-literal-pr-d`, targeting `main` at `478ced6570ad49f03221ac4c6bf222867be755e4`; implementation head before this documentation checkpoint: `553e848563d0144ba20c9720cde6b4b1684eeb7f`.
- First PR-head CI run `37871654880` and CodeQL run `37871652824` started. Dependency Preflight passed; other required CI lanes were queued and CodeQL analyzers were running at the latest read. No exact-head green result yet.
- This tracker checkpoint changes the PR head, so **prior runs do not qualify as the final acceptance evidence**. Next session: re-read PR #540 current SHA, inspect its latest CI/CodeQL checks, fix any failure, then merge only if all mandatory lanes pass.
- Main post-#539 CI and CodeQL were still processing at this checkpoint; do not infer #11–18 Code Scanning alert closure. No live services or data were modified by this branch.

## S06 acceptance and S08/S09 review — 2026-10-09

- PR #540 final exact head `44df4c0adfeba5cac51e95d1a5e3337343d1079b`: CI `37871732216` and CodeQL `37871728870` SUCCESS (Actions, JavaScript/TypeScript, quality, dependencies, static, unit, integration, functional E2E, Worker, build, governance). Merged into `main` as `6e7a857a969158e9a8f3ed30e184e5ac545e1084`.
- S04 CodeQL #7: Worker top-level uncaught exceptions are reduced to a static 500 JSON body and a sanitized correlation log. Add a negative unit test asserting that exception stack/message/sensitive sentinel do not appear in the HTTP response or bounded log; keep the generic serializer unchanged absent a demonstrated dataflow. No alert dismissal is authorized from code inspection alone.
- S07 #8–10: authentication diagnostic prints aggregate counters/severity, not identifiers or secrets; rate-limit key derivation uses secret-keyed HMAC-SHA256 for internal map indexes, not passwords; disposable QA credential generation is domain-separated SHA-384 followed by bcrypt cost 12 with a compare check. Add a direct HMAC derivation test. These are **contextual reviews**, not evidence of the alerts' GitHub state.
- S09 hard blocker: The connected GitHub `fetch` capability rejects `GET /repos/yiwssx/new-www.rcat.ac.th/code-scanning/alerts?state=open` as an unsupported API URL (INVALID_ARGUMENT), independent of repository security settings. There is no live alert state available to this tracker. Never mark open counts zero, resolved, fixed, or dismissed based solely on a green CodeQL analysis. S10 cannot be accepted as fully closed until current alert IDs #1–18 are reconciled with a supported read-only export/API access.
- Explicitly avoid changing production environments, D1 schema/data, credentials, Workstream Agent Skills and Organization Chart. CI and CodeQL must pass on any new evidence PR head before it can merge.

## Authenticated main Code Scanning inventory — 2026-10-09

- The GitHub connector directly cannot read Code Scanning Alerts, so a **temporary, no-checkout, read-only GitHub Actions workflow** queried the official GitHub Code Scanning REST API from this repository with `security-events: read`. Audit run: [37872363049](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/37872363049), SUCCESS. The temporary workflow was subsequently removed from the PR branch, without merging into `main`.
- Explicitly verified **fixed** on `refs/heads/main`: #1, #2, #3, #4, #5, #6, #11, #12, #13, #14, #15, #16, #17, #18 (14/18).
- Explicitly verified **open** on `refs/heads/main`: #7 (`js/stack-trace-exposure`), #8 (`js/clear-text-logging`), #9 and #10 (`js/insufficient-password-hash`) — 4/18. No dismissals were performed by the audit.
- Disposition requires supporting evidence: #7 public Worker 500 response regression (PR #541); #8 numeric-only auth anomaly summary; #9 SHA-384 prehash immediately followed by bcrypt cost 12 for a disposable fixture; #10 HMAC-SHA256 rate-limit bucket derivation rather than password hashing. If evidence proves current paths non-exploitable, prefer a documented per-alert false-positive disposition to weakening security controls or hiding scanners; do not claim zero open until a fresh read confirms it.
- The S09 API-access blocker is **resolved for read-only inventory**. S09 remains IN_PROGRESS until the four residual alerts have an evidence-backed disposition and a final main re-scan validates all 18.

## S10 final acceptance and closure — 2026-10-09 (Asia/Bangkok)

**Authoritative final state:** CLOSED. This section supersedes earlier in-progress and blocked checkpoints above. The baseline consisted of 18 CodeQL Alerts; all are accounted for by the official GitHub Code Scanning API on the current `main`. Do not interpret four reasoned dismissals as remediated code defects.

### Merged implementation and evidence PRs

- PR #530 — Actions production verification cache/provenance hardening, merged `14c88c317a6f1f02f127a2055fa29ba91a664c2e`.
- PR #532 — Facebook thumbnail double-decoding remediation, merged `42840c138c4d82d697801dc6b2217a0b4a5201f6`.
- PR #539 — admin E-Service/Settings/Facebook URL validation, merged `478ced6570ad49f03221ac4c6bf222867be755e4`.
- PR #540 — Day.js/WordPress escaped-bracket fallback, merged `6e7a857a969158e9a8f3ed30e184e5ac545e1084`.
- PR #541 — negative HTTP/log stack-trace disclosure test and HMAC-SHA256 key invariants, merged `ada2ae7529c9eaaf20a20e2390f2643dc4af13f1`.
- PR #542 — public-facing Admin backup recovery error sanitization, merged `30ccc13a9d3346856d4defd21ed8fd66b68ef132`.

### Release and regression gates

- PR #542 exact-head `a3d422284b6be7764abdc63eeb99d040f929f4f4`: CI `37873564003` PASS, CodeQL `37873560414` PASS after unused-catch-variable lint repair.
- Post-merge `main` at `30ccc13a9d3346856d4defd21ed8fd66b68ef132`: main CI `37873931842` PASS (Dependencies, Static Quality, Unit, Integration, Functional E2E, Worker, Build, Governance, aggregate `quality`); CodeQL `37873932201` PASS (Actions and JavaScript/TypeScript); Production Verification `37874221628` PASS.
- Production Verification was the existing read-only verification workflow. This workstream did not itself deploy Workers, run D1 migrations, modify protected environments, secrets, live database data or auth password algorithms.

### Final Code Scanning Alert evidence (main)

- **Fixed by analysis:** #1–6 and #11–18 (**14 fixed**).
- **Individual documented false-positive dispositions:** #7–10 (**4 dismissed**). All used the official `dismissed_reason: false positive` and retained a specific explanatory `dismissed_comment`.
- **#7** `js/stack-trace-exposure`: generic `JSON.stringify` response helper reported as a sink; Worker catch returns constant 500 and has negative stack/message/log regression coverage (PR #541). PR #542 removes raw recovery exception messages. Dismissed 2026-10-09 02:22:11 UTC by `github-actions[bot]` after this review.
- **#8** `js/clear-text-logging`: protected authentication anomaly diagnostic logs only numeric totals/severity for failed auth/MFA/locked accounts, with no raw account identifier, credential or event rows. Dismissed 2026-10-09 02:17:15 UTC.
- **#9** `js/insufficient-password-hash`: temporary QA fixture performs domain-separated SHA-384 prehash **followed by bcrypt cost 12** and a bcrypt compare; the final stored credential is not an unprotected SHA-384 digest. Dismissed 2026-10-09 02:17:15 UTC.
- **#10** `js/insufficient-password-hash`: `createHmac("sha256", secret)` is used for pseudonymous rate-limit bucket keys, not password storage or checking; PR #541 tests this invariant. Dismissed 2026-10-09 02:17:16 UTC.
- The independent read-only authenticated main audit [run #37874569780](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/37874569780) confirmed `BASELINE_IDS_COUNT=18`, `BASELINE_IDS_OPEN=0`, `ALL_OPEN_SCAN_ALERTS=0`.
- Follow-up read-only audit [run #37874627952](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/37874627952) verified the four per-alert dismissal reasons, timestamps and explanatory comments; it independently reconfirmed zero open Code Scanning alerts on `main`.
- Both temporary audit workflows were removed from their branches; none is introduced into `main` by this closure. Do not reintroduce privileged token handling or mask alerts through a broad CodeQL exclusion.

### Residual risk and reopening criteria

- Four alerts are **dismissed, not CodeQL-automatically fixed**; their correctness depends on the documented call-chain and security invariants. Re-review and reopen if a future change makes exception details user-visible, logs sensitive auth events, replaces bcrypt with a fast stored hash, or uses HMAC bucket keys as password verification.
- New alerts, alerts against other branch refs, future scans or previously undiscovered sinks are not covered by this historical 18-alert disposition. Continue normal CodeQL on `main` and require CI/CodeQL gates on later PRs.
- Preserve separate paused Agent Skills / code-alignment and Organization Chart workstreams. No changes to those branches or trackers occurred in this closure.
