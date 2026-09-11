# Agent Notes

This project is a React/Vite public website and CMS for Roi-Et College of Agriculture and Technology.

## Current Project Status

Current status: post-P5H production governance baseline with Production Observability configured behind the protected `production` Environment reviewer gate, completed P6B Security Enforcement, completed P6C Recovery & Reliability, completed P6D Product/UX Improvements, completed Admin UX 00-10, and ongoing governed dependency maintenance. There is no active P6 feature-development phase.

Reliability Roadmap v2 is separate from P6 and is complete. Phase 0 Development Quality Gate, Phase A Field QA Foundation, Phase B Operational Visibility, and Phase C Deep Field Verification are complete. Within Phase B, B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete and production-verified. There is no active Reliability Roadmap v2 phase; future reliability work requires a new explicit scope.

Production environment retirement follow-ups are complete and operator-verified. On 2026-09-11 the operator directly inspected Vercel and Cloudflare: live Vercel Production uses `COMPLAINT_API_URI`, retired `VITE_COMPLAINT_API_URI` is absent, and legacy-only CMS-auth environment values are retired from the applicable live environments. Treat `docs/operations/environment-retirement-verification-2026-09-11.md` as the evidence record. Server-side compatibility parsing does not make a retired variable current configuration.

Use `docs/architecture/post-p5h-current-project-state.md` as the canonical current project-state note and `docs/architecture/reliability-roadmap-v2.md` for reliability phase definitions.

P5H closed the original production-hardening sequence. The active baseline includes Cloudflare Worker/D1 runtime ownership, governed Apps Script media bridge release, CMS link integrity validation, request correlation governance, D1 credential-boundary hardening, protected production audit/release procedures, the Production Observability D1 usage guard, completed P6B security controls, completed P6C recovery controls, completed P6D public UX controls, completed Admin UX 00-10, completed Phase 0/A/B/C reliability work, the verified environment-retirement state, and the current post-P5H maintenance posture.

The Production Observability guard completed its activation gate on 2026-08-29. It is configured on a six-hour schedule, but scheduled runs remain reviewer-gated by the existing `production` Environment and therefore must not be described as unattended monitoring. Reuse the existing Environment and credentials; do not request or create a duplicate Environment/secret merely because an imagined monitoring name differs. Use `docs/operations/p6a-production-observability.md` for closure evidence and operational constraints.

P6B Security Enforcement completed on 2026-08-29. Preserve its CSP, Vercel WAF, sensitive Admin/Auth rate-limit, and privacy-preserving anomaly-detection boundaries. Scheduled D1 auth polling is retired; password-threshold signaling is event-driven and deeper D1 aggregate diagnosis is manual-only. Use `docs/operations/p6b-security-enforcement.md` for closure evidence.

P6C Recovery & Reliability completed on 2026-08-30. Preserve its D1 Time Travel readiness and protected rollback boundaries. Its ongoing unattended end-to-end reliability smoke runs every six hours, not twice hourly, and retains one bounded Search/Worker/D1 dependency probe per run. P6B owns scheduled WAF verification; do not duplicate the WAF probe in P6C. Use `docs/operations/p6c-recovery-reliability.md` for closure evidence and current guard ownership.

P6D Product/UX Improvements completed on 2026-08-30 as the final planned P6 development phase. Preserve its public not-found/error recovery and public search-state/no-result usability improvements. Use `docs/operations/p6d-product-ux-improvements.md` for closure evidence. Do not reopen architecture, security, recovery, or completed Admin UX work under the P6D label.

Admin UX 00-10 is complete. Use `docs/admin/admin-ux-execution-tracker.md` for the completed Admin UX sequence. Do not treat that sequence as a reopened M21 phase.

Phase B is complete and production-verified. B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete. B3 completion is backed by PR #270 merged as `cda947149fee0e79791bfc401efbc5c33f3adbb9`, CI #2007 (`34547284821`) on final implementation head `b10ab8c99117fa1e254bd420df3f69de5ec77182`, READY Vercel production deployment `dpl_94AZDYbaLc61t2XbmxMFCw1GQZyP`, and production endpoint verification preserving the fail-closed CMS-session, `no-store`, Request ID, and P6B security boundary. Do not report Phase B as active or B3 as planned unless a newer explicit project-state decision opens new scope.

Phase C is complete. C3 authenticated disposable CMS verification passed its protected production field run and deterministic zero-row cleanup. C3 remains manual-only after closure and must not be automatically dispatched by normal Worker production releases unless a new explicit scope reopens that behavior.

M13-M21 documents are retained as historical planning, migration, and stabilization records only. They must not be treated as the current active project phase unless a newer explicit project-status document says so. Legacy M21 active-ownership or open-stabilization wording must never be surfaced as current status.

Governed Renovate dependency maintenance is expected to continue. It is not considered feature, runtime, or stabilization-scope expansion when it follows the repository dependency policy and passes the required CI/governance gates.

## Status Reporting Rule

When reporting current project status, use:

```text
post-P5H production governance baseline + Production Observability configured/approval-gated + P6B Security Enforcement completed + P6C Recovery & Reliability completed + P6D Product/UX Improvements completed + governed dependency maintenance + Admin UX 00-10 completed + Reliability Roadmap v2 complete (Phase 0 + Phase A + Phase B/B1-B3 + Phase C complete) + production environment retirement follow-ups completed/operator-verified (2026-09-11)
```

Do not report M20, M21, P6B, P6C, P6D, or Reliability Roadmap v2 Phase B as the current active feature-development/reliability phase. P6B, P6C, P6D, Phase 0, Phase A, Phase B, and Phase C are completed. Production Observability remains an operational guard whose scheduled executions are reviewer-gated rather than unattended.

For future feature, product, or reliability work, report the new branch and PR scope directly rather than extending P6D, Phase B, or M21 implicitly.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- B2 Runtime Incident Feed ingest and protected aggregate reads: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side admin proxy.
- B3 Health Aggregation: Vercel server-owned `/api/health-aggregation`, explicit refresh only.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive behind the Apps Script media/file bridge.
- Complaint path: Vercel `/api/complaint` to the dedicated Complaint Apps Script using live server-only `COMPLAINT_API_URI`.

Do not restore browser-side direct Apps Script structured reads/writes. Apps Script is retained only for the media/file bridge/Google Drive operations, plus the separately isolated complaint Apps Script behind its Vercel proxy.

## Admin Operation Feedback Standard

Admin write operations use:

- blocking loading modal while pending
- centered success modal requiring acknowledgment
- centered error modal requiring acknowledgment
- no short auto-dismiss toast for final admin write results

The standard applies to Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings.

## Reliability Ownership

- Phase A owns deployment-driven read-only production browser QA.
- P6A owns D1 utilization observability and remains approval-gated.
- P6B owns security/WAF/CSP enforcement checks.
- P6C owns bounded six-hour SSR → Worker → D1 reliability verification.
- Phase B B1/B2/B3 are complete; B3 remains explicit-refresh, server-owned aggregation through `/api/health-aggregation`.
- Phase C is complete; C3 is manual-only.
- Reuse `X-RCAT-Request-ID`; do not create duplicate correlation identifiers.
- Do not add a parallel paid observability stack merely to recreate existing controls.

## Keep

- Cloudflare Worker and D1 runtime paths.
- Vercel admin proxy paths.
- Apps Script media/file bridge.
- Google Drive file storage bridge.
- D1 migration history.
- M13-M21 milestone records as historical evidence.
- P5H production governance baseline documents.
- Production Observability D1 usage guard and its existing read-only analytics credential boundary.
- Completed P6B security controls and P6B-owned scheduled WAF smoke.
- Completed P6C recovery/reliability controls and bounded six-hour public reliability guard.
- Completed P6D public product/UX controls.
- Completed Phase A production browser QA pipeline.
- Completed Phase B1/B2/B3 operator visibility controls.
- Completed Phase C checks and manual-only C3 deep-production regression tool.
- Verified production environment-retirement evidence and the current `COMPLAINT_API_URI` / CMS-auth retirement boundary.
- Sigmap AI helper workflow.
- Governed Renovate dependency maintenance under the repository dependency policy.

## Do Not Restore

- Legacy Apps Script user-management backend.
- Direct frontend Apps Script user CRUD.
- Local bootstrap user fallback.
- Local password-hash user-account fallback.
- Legacy Apps Script credential login path.
- Browser-side Apps Script structured-data reads or writes.
- Retired `VITE_COMPLAINT_API_URI` in live Vercel Production.
- Legacy-only CMS-auth environment values retired by the final cutover.
- The deleted `rcat-public-api-production` Worker/D1 as a current target; production is the existing `rcat-public-api-preview` physical resource under `env.production`.
- A persistent Cloudflare Preview tier or `--env preview` operational procedure unless explicitly redesigned as new scope.
- Twice-hourly P6C Search/D1 polling.
- A duplicate scheduled WAF probe inside P6C.
- Scheduled D1 auth-anomaly polling.
- M20/M21 active-phase wording in current-facing guidance.
- Worker → C3 automatic dispatch or one-time C3 release scaffolding.
- B3 browser-side infrastructure credentials or background polling.

## Safety Rules

- Do not commit real secrets, tokens, D1 IDs, Access AUD values, private credentials, or production-only identifiers.
- Do not mutate production Cloudflare, Vercel, Apps Script, Google Drive, D1, or DNS unless explicitly requested.
- Keep D1 migrations append-only.
- Keep Apps Script scoped to approved media/file bridge operations, except the separately isolated complaint Apps Script boundary.
- Reuse existing credentials and Environments before considering any new one.
- Prefer small, scoped commits.

## Formatting and Remote Write Rule

- Repository Prettier is authoritative; use the repository-pinned Prettier version and `.prettierrc.json`.
- Local commits are protected by Husky and `lint-staged`, which format supported staged files before commit.
- GitHub API, connector, and other remote file writes bypass local Git hooks. Before every remote commit, format every changed supported file with the repository Prettier rules; do not rely on CI as the first formatter.
- Before merge, `pnpm format:check` and `pnpm lint:strict` must pass.

## React Performance Skill

For React frontend work, use the installed `vercel-react-best-practices` skill as a review and implementation guide.

Apply the rules selectively to this React/Vite application:

- prioritize eliminating request waterfalls
- preserve React Query cache and invalidation semantics
- reduce unnecessary re-renders
- avoid unnecessary bundle growth
- lazy-load heavy routes or components when measurable value exists
- preserve accessibility and existing user-visible behavior
- prefer evidence from profiling, bundle analysis, or tests over speculative optimization

Do not apply Next.js-only rules to this Vite application.

Do not perform broad performance refactors during authentication or security tasks unless the affected React code is directly in scope.

Security, correctness, authorization, session integrity, and data consistency take priority over performance optimization.

## Sigmap Workflow

Use sigmap for repository-aware AI assistance when available.

Common commands:

```bash
pnpm ai:ask
pnpm ai:validate
pnpm ai:map
```
