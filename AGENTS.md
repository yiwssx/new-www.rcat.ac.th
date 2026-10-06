# Agent Instructions

This repository is the React/Vite public website and CMS for Roi-Et College of Agriculture and Technology.

## Automatic session bootstrap

For every substantial task, do this automatically before changing code or project state:

1. Determine the current branch and inspect the current repository state.
2. Search `docs/workstreams/` on the current branch for a tracker whose status is `ACTIVE` and whose scope matches the current branch/task.
3. If exactly one matching active tracker exists, read it before doing work and treat it as the cross-session execution state.
4. Treat the current repository, current GitHub PR/Actions state, and the matching tracker as authoritative over conversational recollection.
5. Verify mutable facts such as PR state, branch head, CI result, deployment state, and task completion before acting on them.
6. Do not make the user restate prior progress merely because the conversation is new or a previous response was interrupted.

If no matching tracker exists and the work is expected to span multiple PRs, multiple sessions, or several dependent implementation steps, create a concise tracker under `docs/workstreams/<scope>-tracker.md` automatically. Do not create a tracker for a small one-shot change.

## Automatic checkpointing

When an active workstream tracker exists:

- update it whenever a task changes state, a PR/branch/SHA becomes authoritative, a blocker appears, a decision changes, or a meaningful verification completes;
- before ending a response after meaningful repository changes, ensure the tracker reflects the latest durable checkpoint;
- keep the tracker concise: current state, completed/in-progress/pending work, blockers, decisions/constraints, verification evidence, and next action;
- do not copy verbose command output, secrets, logs, or conversational narrative into the tracker;
- never mark work complete only because code exists; require the workstream's acceptance/verification evidence.

On a new session, interrupted response, or resumed task, reconstruct state from GitHub + the matching tracker rather than trying to resume stale conversational execution state.

## Bounded execution and external waits

Do not keep one agent response alive by repeatedly polling an external system for a long time.

For CI, GitHub Actions, deployments, provider jobs, or other external waits:

- start the external process and capture its run/deployment identifier;
- poll no more than two times or roughly two minutes total in the same response, whichever comes first;
- if it is still pending, write the waiting state and exact next check into the active tracker, then stop at that durable checkpoint;
- on the next turn/session, re-read current GitHub/provider state and continue automatically;
- do not restart or duplicate an already-running job merely because the previous conversation was interrupted.

Prefer several short, durable transactions over one very long execution chain.

## Current project-state sources

Do not embed fast-changing project status in this file. Read only the relevant source when the task requires it.

Stable baseline invariants retained here for repository consistency checks:

- The current baseline is the **v3.3.2 production-governance and governed-maintenance baseline** on `main`.
- The v3.3.2 Content Editor Performance release is complete, production-verified, tagged, and published; do not repeat its Vercel deployment or production verification because an older checkpoint is stale.
- The preceding v3.3.1 Content Operations D1 migrations and Worker release are complete and must not be repeated as later state reconciliation.
- **B1 System Health Dashboard, B2 Runtime Incident Feed, and B3 Health Aggregation are complete and production-verified**.
- **Production environment retirement follow-ups are complete and operator-verified**.
- Phase C is complete; C3 remains a deliberate manual protected operation rather than an automatic release step.
- The v3.3.2 Admin editor bundle and dependency-isolation checks are current regression gates and must not be weakened merely to make CI green.

Canonical references:

- `docs/architecture/current-project-state.md` — canonical current project-state note.
- `docs/releases/v3.3.2-release-baseline.md` — current release baseline and verification evidence.
- `docs/workstreams/v3.3.2-content-editor-performance-tracker.md` — closed v3.3.2 workstream execution record.
- `docs/architecture/post-p5h-current-project-state.md` — preceding 2026-09-20 project-state snapshot; historical after a newer current-state note supersedes it.
- `docs/architecture/reliability-roadmap-v2.md` — Reliability Roadmap v2 definitions/history.
- `docs/operations/environment-retirement-verification-2026-09-11.md` — verified environment-retirement evidence.
- `docs/operations/p6a-production-observability.md` — Production Observability guard and approval constraints.
- `docs/operations/p6b-security-enforcement.md` — completed security controls and current consolidated verification ownership.
- `docs/operations/p6c-recovery-reliability.md` — recovery/reliability controls and current consolidated verification ownership.
- `docs/operations/phase-c-deep-field-verification.md` — completed Phase C and current C3 operation boundary.
- `docs/operations/d1-recovery-drill.md` — current read-only D1 recovery-drill procedure.
- `docs/operations/p6d-product-ux-improvements.md` — completed P6D scope.
- `docs/admin/admin-ux-execution-tracker.md` — completed Admin UX 00-10 sequence.
- `docs/design/mui-tailwind-boundary.md` — MUI/Tailwind ownership boundary.

Historical M13-M21 documents are evidence/history only unless a newer explicit project-state decision reopens their scope.

## Runtime ownership boundaries

Preserve these architectural boundaries unless the task explicitly redesigns them:

- Public structured reads: Cloudflare Worker + D1.
- Public analytics/site/content/visitor data: Cloudflare Worker + D1.
- Admin structured reads/writes: Cloudflare Worker + D1.
- Admin access: Cloudflare RBAC + D1 `app_admin_users`.
- Admin session proxy: Vercel server-side admin proxy.
- B3 health aggregation: server-owned `/api/health-aggregation`, explicit refresh only, with public GitHub metadata resolved from current `main`.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive behind the approved Apps Script bridge.
- Complaint path: Vercel `/api/complaint` to the dedicated complaint Apps Script via server-only `COMPLAINT_API_URI`.

Do not restore browser-side direct Apps Script structured reads/writes.

## Reliability and security ownership

- `.github/workflows/production-verification.yml` owns deployment-driven read-only production browser QA plus the consolidated scheduled security/reliability checks.
- P6A owns D1 utilization observability and remains manual-only / approval-gated through Production Verification operation `observability`.
- P6B owns security, WAF, CSP, rate-limit, and anomaly-enforcement contracts; manual auth-anomaly diagnosis uses Production Verification operation `auth-anomaly`.
- P6C owns bounded six-hour SSR → Worker → D1 reliability verification through Production Verification.
- Phase B B1/B2/B3 are complete; B3 remains explicit-refresh server-owned aggregation.
- Phase C is complete; C3 remains manual-only through `.github/workflows/production-data-operations.yml` operation `authenticated-cms-field`.
- Read-only D1 recovery readiness lives in `.github/workflows/maintenance-recovery.yml`; destructive restore remains incident-only.
- Reuse `X-RCAT-Request-ID`; do not create a parallel request-correlation identifier.
- Do not add a parallel paid observability stack merely to recreate existing controls.

## Do not restore or silently redesign

Unless explicitly approved as new scope, do not restore:

- legacy Apps Script user-management backend or direct frontend Apps Script user CRUD;
- local bootstrap/password-hash user-account fallbacks;
- legacy Apps Script credential login;
- browser-side Apps Script structured-data reads/writes;
- retired `VITE_COMPLAINT_API_URI` or legacy-only CMS-auth environment values in live production;
- deleted `rcat-public-api-production` as a current Worker/D1 target;
- a persistent Cloudflare Preview tier / `--env preview` procedure;
- retired branch-mutating `format-guard.yml`;
- retired phase-specific/duplicate workflows such as `phase-a-production-browser-smoke.yml`, `phase-c3-authenticated-cms-field.yml`, `p6b-production-security.yml`, `p6c-production-reliability.yml`, `production-observability.yml`, `d1-recovery-drill.yml`, or standalone dependency-monitoring workflows;
- twice-hourly P6C Search/D1 polling;
- duplicate scheduled WAF probes;
- scheduled D1 auth-anomaly polling;
- Worker → C3 automatic dispatch;
- B3 browser-side infrastructure credentials or background polling.

Keep pnpm on the repository-approved v10 toolchain unless a newer explicit repository decision changes that constraint.

## Production safety

- Never commit real secrets, tokens, D1 IDs, Access AUD values, private credentials, Time Travel bookmarks, or production-only identifiers.
- Do not mutate production Cloudflare, Vercel, Apps Script, Google Drive, D1, DNS, or protected GitHub environments unless explicitly requested and authorized by the task.
- Keep D1 migrations append-only.
- Keep Apps Script scoped to approved media/file operations, except the separately isolated complaint Apps Script boundary.
- Reuse existing credentials and GitHub Environments before considering new ones.
- Preserve protected production approvals and existing release gates.
- Prefer small, scoped commits and task branches.

## Admin operation feedback standard

Admin write operations use:

- blocking loading modal while pending;
- centered success modal requiring acknowledgment;
- centered error modal requiring acknowledgment;
- no short auto-dismiss toast as the final result of an admin write.

This applies to Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings.

## Formatting and remote-write rule

Repository Prettier is authoritative. Use the repository-pinned Prettier version and `.prettierrc.json`.

GitHub API/connector writes bypass local Git hooks. Before every remote commit, format every changed supported file according to repository rules rather than relying on CI as the first formatter.

Before merge, the relevant quality gates must pass, including `pnpm format:check` and `pnpm lint:strict` when applicable.

## React performance guidance

For React frontend work, use the installed `vercel-react-best-practices` skill when available. Apply it selectively to this React/Vite application:

- eliminate measurable request waterfalls;
- preserve React Query cache/invalidation semantics;
- reduce unnecessary re-renders;
- avoid unnecessary bundle growth;
- lazy-load heavy routes/components only when evidence supports it;
- preserve accessibility and user-visible behavior;
- prefer profiling, bundle analysis, or tests over speculative optimization.

Do not apply Next.js-only rules to this Vite application. Security, correctness, authorization, session integrity, and data consistency take priority over performance optimization.

## Material UI + Tailwind guidance

Use the vendored `.agents/skills/material-ui-tailwind` guidance, subject to repository policy:

- `src/design-system/tokens.ts` is the canonical semantic token source;
- MUI owns interactive controls/forms/component state/focus/overlays/portal UI/dense Admin widgets;
- Tailwind/RCAT utilities own page layout, responsive structure, spacing, prose, print, and static wrappers;
- do not give MUI and Tailwind competing border/radius/shadow/focus/state/responsive ownership on the same element;
- SSR and client styling must use the same shared runtime/provider and runtime-owned Emotion cache;
- cascade changes must preserve critical CSS extraction, CSP nonce behavior, hydration, accessibility/focus policy, portals, and theme overrides;
- repository architecture/security/accessibility/design rules override generic skill examples.

## Repository Agent Skills

Repository-scoped skills live under `.agents/skills/`. Load the relevant skill
before substantial work in its area, while treating this root `AGENTS.md` and
the current repository state as authoritative when generic guidance conflicts.

- `workers-best-practices`: use for Cloudflare Worker implementation, review,
  bindings, runtime behavior, and Wrangler configuration. Preserve this
  repository's Worker/D1 ownership, production resource identity, deployment
  gates, and append-only migration policy.
- `router-query`: use when changing TanStack Router + TanStack Query
  integration, route loaders, preloading, SSR request isolation, dehydration,
  or hydration. Its vendored `router-core` and `react-router` skills are
  support dependencies.
- `codebase-design` and `improve-codebase-architecture`: use for architecture
  analysis and approved refactoring. Do not use them as permission for
  repository-wide speculative rewrites; preserve explicit runtime ownership and
  feature boundaries unless the task intentionally redesigns them.
- `vite`: use for Vite configuration, build behavior, SSR, plugins, asset
  handling, environment behavior, Rolldown migration concerns, and bundling.
- `vitest`: use for Vitest configuration, mocking, environments, coverage,
  concurrency, fixtures, and test isolation.
- `security-guidance`: use automatically for work involving user input,
  authentication, authorization, persistence, network boundaries, file
  handling, cryptography, browser security, or other security-sensitive
  behavior. Repository security policy and existing production controls take
  precedence over generic recommendations that would recreate retired paths.
- `frontend-accessibility-best-practices`: use for new or changed UI,
  interaction, forms, navigation, responsive controls, focus/keyboard behavior,
  announcements, reduced motion, and touch targets.

The vendored source pins and update notes are recorded in
`.agents/skills/README.md`.

## Dependency maintenance

Governed Renovate maintenance is expected and does not by itself reopen completed feature/reliability phases. Dependency PRs must still satisfy repository dependency policy and required CI/governance gates.

## Sigmap

Use sigmap for repository-aware AI assistance when available:

```bash
pnpm ai:ask
pnpm ai:validate
pnpm ai:map
```
