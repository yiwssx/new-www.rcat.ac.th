# Organization Content Workstream Tracker

Status: **PHASES 0–9 COMPLETE / PAUSED BEFORE FINAL MERGE AND PHASE 10 / FEATURE BRANCH ONLY — NO MERGE**

Updated: 2026-10-10 Asia/Bangkok

Repository: `yiwssx/new-www.rcat.ac.th`

Baseline branch: `main`

Recovery source: closed, unmerged [PR #524](https://github.com/yiwssx/new-www.rcat.ac.th/pull/524) (historical planning baseline only)

## Recovery checkpoint

- Restored onto current `main` through a documentation-only PR on 2026-10-08.
- Phases 0–6 are **COMPLETE** on the feature branch. Phase 6 implementation passed CI run [#38068146144](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38068146144) at `c3130f3addf70e1e9679558cab64ec1df1f33bad` before this tracker-only closure commit; CI of this final tracker SHA is the last documentation gate. Phases 7–11 remain PLANNED; pause before Phase 7.
- The Organization workstream was explicitly resumed on 2026-10-09. Implementation is scoped to non-production PRs.
- The original tracker restoration was documentation-only. The later 2026-10-09 implementation authorization covers non-production feature development, not production database changes, deployments, or real-data population.

## Goal

Add a dedicated CMS content type for organizational units and personnel structure. The feature must support:

- a dedicated Admin menu and workflow separate from the generic Content page;
- independently publishable organization pages with user-defined slugs;
- hierarchical units such as division -> work -> sub-unit and department -> program/sub-unit;
- one personnel record reused across multiple divisions, works, departments, positions, and duties;
- multiple assignments for the same person, including multiple duties in the same unit;
- public pages that integrate with the existing Menu system rather than creating a parallel navigation system;
- organization-builder behavior inspired by `MontienNgamkaew/pnpman`, without its hard-coded department/job IDs or fixed role model.

## Architecture decisions

1. **Organization pages are a CMS content type, not a parallel page system.**
   - Reuse the existing `contents` lifecycle, slug uniqueness, revision, publish state, SEO metadata, and permalink infrastructure.
   - Add a dedicated content type such as `organization`, but hide it from the generic Content management workflow and expose it through its own Admin route.

2. **Organization hierarchy is recursive.**
   - Each organization page has an organization-specific record with a parent relationship and unit kind.
   - Initial unit kinds: `division`, `work`, `department`, `program`, `subunit`.
   - The schema must not assume a fixed maximum depth.

3. **Personnel are canonical and global.**
   - A person is stored once and can appear in any number of organization units.
   - CMS user accounts and personnel records remain separate domains.

4. **Duties are assignments, not personnel fields.**
   - Employment/academic position belongs to the personnel profile.
   - Organizational duties such as head of work, assistant head, department head, teacher, officer, coordinator, or other responsibilities belong to organization assignments.

5. **Positions are unit-scoped.**
   - A unit can define its own position groups, ordering, display style, and optional occupant limit.
   - Assignments connect a personnel record to a unit position.
   - Do not use fixed enums for real-world role names.

6. **Existing Menu management remains authoritative for navigation.**
   - Publishing an organization page creates a public destination, not a new menu item automatically.
   - Editors attach those destinations under existing menu groups such as "หน่วยงานภายใน" and "แผนกวิชา".

## Proposed data model

- `contents`
  - add `organization` to the supported content type contract;
  - owns title, slug, summary/body, status, SEO, featured media, timestamps, revision.

- `organization_units`
  - `content_id` (one-to-one with the organization content row)
  - `parent_content_id`
  - `unit_kind`
  - `sort_order`
  - optional presentation/settings JSON where justified.

- `personnel`
  - canonical identity/profile, personnel type, employment/academic position, Media Library photo reference, public contact fields when explicitly enabled, active state, revision.

- `organization_positions`
  - unit/content reference, position name, ordering, optional occupant limit, presentation key, revision.

- `organization_assignments`
  - personnel reference, organization position reference, ordering, note/duty detail, manual enabled/disabled state (no appointment period or automatic expiry), revision.
  - uniqueness must not prevent one person from holding multiple duties in one unit.

## Status tracker

| Phase | Scope                                                | State        | Exit criteria                                                                                                                                                 |
| ----- | ---------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Discovery, pnpman review, domain model, tracker      | **COMPLETE** | Architecture decisions above are recorded and no implementation has started                                                                                   |
| 1     | Schema + shared contracts                            | COMPLETE     | Append-only D1 migration, types, validation, indexes, hierarchy/assignment integrity tests                                                                    |
| 2     | Worker repositories + public/admin APIs              | COMPLETE     | CRUD/read contracts, recursive unit reads, personnel/position/assignment operations, safe public sanitizer                                                    |
| 3     | RBAC + Admin routing/service layer                   | COMPLETE     | Dedicated capabilities, route policy, API facade/query keys, Admin navigation entry                                                                           |
| 4     | Organization list/editor                             | COMPLETE     | Dedicated `/admin/organization` list, title/slug/type/parent/status workflow, revision-safe writes                                                            |
| 5     | Personnel directory                                  | COMPLETE     | Canonical personnel CRUD, Media Library photo selection, reuse across organization pages                                                                      |
| 6     | Organization builder                                 | **COMPLETE** | Unit positions, assignment/reassignment, ordering, multiple duties, occupant limits, accessible non-drag controls; drag/drop only if justified                |
| 7     | Public renderer + permalink/SSR/SEO                  | COMPLETE     | Published organization slugs resolve through public routing, hierarchy/breadcrumbs render, draft/private fields remain inaccessible                           |
| 8     | Menu/search/sitemap integration                      | COMPLETE     | Menu can link to organization pages; search/sitemap behavior is deliberate and tested; generic content lists do not leak organization records unintentionally |
| 9     | Quality, accessibility, performance, backup coverage | COMPLETE     | Unit/integration/functional tests, format/lint/build/worker checks, responsive/mobile verification, backup counts/download include new tables where required  |
| 10    | Production migration + release verification          | PLANNED      | Protected migration/deploy sequence completed once, browser verification passes, tracker records release evidence                                             |
| 11    | RCAT content population                              | PLANNED      | Real divisions, works, departments, personnel, positions, and assignments entered only after runtime feature verification                                     |

## Branch and merge policy — user direction 2026-10-09

- **Keep ALL development for Phases 1-9 in one long-lived Organization feature branch**: `agent/org-01-domain-schema`. The original Phase 1-oriented name is retained to preserve [draft PR #553](https://github.com/yiwssx/new-www.rcat.ac.th/pull/553), its reviews, and CI history. It is the Organization feature branch for the entire implementation, not a Phase 1-only branch.
- Keep PR #553 **Draft**, targeting `main`, until every pre-merge feature phase is implemented, the complete feature is reviewed, and all required CI/security/governance/functional tests pass on its exact final head.
- **Do not merge intermediate phases into `main`**. Each phase is an internal checkpoint/commit series on the same branch; preserve clear phase-level commits, tracker evidence and test coverage.
- Do not auto-merge, mark the PR ready for review prematurely, close/replace the PR just to advance phases, force-push main, or bypass any quality/protected-environment gate.
- As `main` evolves, reconcile upstream changes into the feature branch with an ancestry-preserving integration and rerun the required checks. Never rewrite published feature-branch history unnecessarily.
- **Single final merge gate**: Phases 1-9 complete, production migration/release procedure prepared and rehearsed without changing production, content-population plan ready, no known blockers, and full PR checks/review green. Only then merge the complete feature once into `main`.
- Phases 10 (production migration and deployment) and 11 (real RCAT data population) inherently require the protected production release path **after** this final merge. Do not execute them from a WIP branch or claim they are completed before the feature is merged. They remain tracked as post-merge release/rollout phases.

## Implementation sequence

1. Phase 1 — complete D1 schema/contracts, local migration tests, and revision/integrity gates on the feature branch.
2. Phases 2-3 — Worker repositories, public/admin APIs, RBAC and Admin route/service boundary on the same branch.
3. Phases 4-6 — Organization editor, Personnel directory and hierarchical Organization builder on the same branch.
4. Phases 7-8 — public permalink/SSR/SEO and existing Menu/search/sitemap integration on the same branch.
5. Phase 9 — full automated QA, accessibility, responsive and backup coverage; final regression and release-readiness review on the same branch.
6. After all pre-merge gates pass — change Draft PR #553 to ready, obtain required approvals, **merge exactly once to `main`**.
7. Only after merge and separate protected-environment approval — Phase 10 production release/verification, then Phase 11 real content population.

## Planned dependencies and tool adoption — decision 2026-10-10

**Status: Phase 4 form dependencies INSTALLED; Phase 5 reused them; Phase 6 `@mui/x-tree-view` 9.15.0 plus `@dnd-kit/react` and `@dnd-kit/helpers` 0.5.0 INSTALLED and locked; Phase 7–9 optional tools remain UNINSTALLED.** The initial approval covered tool planning without installing packages or starting Phase 3. Phase 3 was subsequently authorized separately and completed on 2026-10-10. Phase 4 subsequently installed React Hook Form, Zod and its resolver. Remaining tool choices require review during Phases 5–9.

| Phase                                         | Planned dependency/tool choice                                                             | Decision                                                                          | Reason and constraints                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3 — RBAC and Admin routing                    | Existing TanStack Router, TanStack Query, MUI, CMS session/RBAC                            | Reuse; no new dependency                                                          | Add Admin API facade/query keys/navigation with existing route protection.                                                                                                                                                                                                                                                                                                                             |
| 4 — Organization list/editor                  | `react-hook-form`, `zod`, `@hookform/resolvers`                                            | Add when Phase 4 begins, after compatibility review                               | Manage MUI form state, nested field validation, slug/parent/status/publish-date form feedback. Browser validation must never replace Worker/D1 authority.                                                                                                                                                                                                                                              |
| 5 — Personnel directory                       | Reuse Phase 4 form stack, existing TanStack Table and Media Library                        | Reuse; no new dependency                                                          | Canonical personnel editing, media selection, multi-unit reuse and explicit public-contact opt-ins; never build a duplicate upload service.                                                                                                                                                                                                                                                            |
| 6 — Organization builder                      | `@mui/x-tree-view`, `@dnd-kit/react`; `@dnd-kit/helpers` if sortable helpers are required  | Add when Phase 6 begins, subject to compatibility, licensing and prototype review | Hierarchy navigation plus accessible position/assignment reorder and reassignment. MUI X Tree View Community does **not** automatically provide integrated nested drag/drop; MUI's native tree drag/reorder may require a paid Pro license. Dnd-kit integration needs explicit design/testing. Always provide keyboard/touch-friendly non-drag controls and revision-safe transactional server writes. |
| 7 — Public renderer, SSR and SEO              | Existing React/Router/SSR and MUI; optionally **one of** `d3-hierarchy` or `@xyflow/react` | Default reuse; optional only after renderer prototype                             | Prefer lightweight semantic, responsive organization output. Consider d3-hierarchy for tree layout or React Flow for truly interactive graph interactions, not both by default. Check SSR/hydration, bundle impact and accessible fallback.                                                                                                                                                            |
| 8 — Menu/search/sitemap                       | Existing Menu, public search, runtime sitemap and routing                                  | Reuse; no new dependency                                                          | Integrate organization slugs and published-only visibility without a parallel menu/search engine.                                                                                                                                                                                                                                                                                                      |
| 9 — QA, accessibility, performance and backup | `@axe-core/playwright` as a devDependency; existing Vitest/Playwright/CI                   | Add when Phase 9 begins, after compatibility review                               | Automate accessibility assertions alongside existing keyboard, mobile/responsive, security, performance, backup/restore and regression checks; automation does not replace manual accessibility testing.                                                                                                                                                                                               |

### Dependency adoption gates

- **No blanket installation:** no `package.json` or lockfile changes in this planning checkpoint. Install a dependency only after its Phase starts and the chosen feature requires it.
- Before installation, verify package availability, maintenance, license/commercial obligations, React **19**, MUI **9**, Node **24**, and pinned pnpm **10.34.5** compatibility and strict peer dependency resolution; do not force or ignore peer conflicts.
- Evaluate bundle size, performance, supply-chain/security advisories, server-side rendering effects where applicable, and whether existing components can already meet the requirement.
- Keep each dependency introduction scoped to its Phase with focused regression coverage and unchanged required format/lint/typecheck/unit/integration/build/functional/security gates. Do not weaken CI to make dependency installation pass.
- For Phase 6, prototype the accessibility and non-drag workflow first; do not assume that adding tree and drag libraries supplies server-atomic multi-record reorder, cycle prevention, occupant-capacity checks or revision conflict handling. These remain application responsibilities.
- **Governance stays unchanged:** retain the single feature branch `agent/org-01-domain-schema`, Draft PR #553, no intermediate merge, no production migrations/deployments, and no real RCAT personnel data before the approved release path. **This original dependency-planning checkpoint did not authorize Phase 3; later user authorization was received and Phase 3 completed. Pause before Phase 4.**

## Required integrity rules

- no organization cycle: a unit cannot become its own ancestor;
- a parent must reference another organization content record;
- deleting a unit with children requires explicit resolution of descendants;
- deleting personnel referenced by assignments is blocked or requires an explicit reassignment/removal workflow;
- deleting a position with assignments is blocked until assignments are resolved;
- a person may have many assignments across many units and may have multiple duties in the same unit;
- public responses expose only explicitly public personnel/profile fields;
- organization slugs follow the existing content/reserved-route validation contract;
- all writes remain revision-safe and server-authoritative.

## UX constraints

- Keep the existing RCAT Admin visual language and Admin write-feedback standard.
- The hierarchy/list must remain usable on narrow screens without shrinking text to unreadable sizes.
- Drag/drop, if added, must have a keyboard/tap-accessible non-drag alternative.
- Public organization pages must reflow responsively rather than scaling a desktop chart down.
- Reuse the existing Media Library; do not create a separate personnel upload filesystem.

## Execution checkpoint (2026-10-09 Asia/Bangkok)

- Authorized: user explicitly requested current-state analysis and implementation of Organization Chart.
- Baseline: `main` at `ae262072f4c7fe0640a60f8a2dc8db318963be5c`; no open PRs at resumption.
- Single long-lived feature branch: `agent/org-01-domain-schema`; [Draft PR #553](https://github.com/yiwssx/new-www.rcat.ac.th/pull/553). **Do not merge until all pre-merge phases and final gates complete.**
- Phase 1 work staged: append-only migration `0020_organization_content_foundation.sql`, shared domain/privacy contracts, Worker row columns, SQLite and contract regression tests.
- Phase 1 **not complete** pending CI verification on its final head and all required gates; Phases 2-11 remain PLANNED.
- First PR CI attempt passed Build, Worker, Dependencies, Integration Tests and Governance but failed Prettier in two new test files; formatting corrections have been committed. Rerun verification required on the resulting head.
- Safety: no protected D1 migration, Cloudflare/Vercel deployment, live data, GitHub gate suppression, or pnpm major upgrade.
- Carry forward: Worker CRUD/repository/authorization in Phases 2-3; public rendering and navigation in Phases 7-8. Do not expose Organization content through generic lists prematurely.

## Development checkpoint: 2026-10-09 — continue on single feature branch

- Phase 1 formatting failure was reproduced in the exact GitHub Action runner and corrected using a temporary read-only Prettier diff workflow; the diagnostic workflow was removed from the branch after use.
- Phase 2 **in progress**: added `organizationReadRepository.ts` with recursive, ancestor-safe published organization reads, a read-only `GET /api/public/organization` Worker route, and SQLite tests of unpublished ancestors and time-window visibility.
- The new public endpoint returns only unit-level fields; personnel, assignment, Admin CRUD, navigation, editor and renderer contracts are **not** yet implemented.
- Phase 1 exit gate **COMPLETE**: exact-head [CI run 37948555195](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/37948555195) on commit `925f7c9a` passed Dependency Preflight, Static Quality, Unit Tests, Build, Worker, Integration Tests, Governance, Dependencies, Functional E2E and the aggregate Quality Gate. Phase 2 exit gate remains open.
- The PR remains Draft; **do not merge**, deploy, apply production migration or populate RCAT data.

## Further Phase 2 checkpoint: 2026-10-09 (same feature branch)

- Expanded the read-only `GET /api/public/organization` contract to include ordered organization positions and their current enabled assignments. The shared recursive visible-unit CTE still excludes draft, expired, scheduled, and unpublished-ancestor content.
- Current public person projection includes only active personnel and contact fields whose specific public-visibility flag is enabled. Assignment validity windows are checked at read time; disabled personnel/assignments never populate public positions. No new HTTP write endpoint is exposed.
- Added `organizationPublicPositions.test.ts` with SQLite fixtures for ancestor visibility, inactive/disabled/date-filtered assignments, and contact privacy/duplicate duties.
- Added internal `organizationAdminRepository.ts` with bounded Admin reads and revision-compare-and-swap insert/update primitives for units, personnel, positions and assignments; added `organizationAdminRepository.test.ts` with real SQLite data-integrity, revision-conflict and SQL-binding checks.
- These repository primitives are **not authorized API endpoints**. They require Phase 2/3 server-owned input validation, session/RBAC/CSRF/step-up boundaries, immutable audit evidence and dedicated Admin routes before being exposed.
- New code has not yet earned a completed CI gate; latest workflow was queued/in progress during the checkpoint (CI run 37951304214 for commit `2b06a3a`). The tracker-only commit will start a newer exact-head CI run. Diagnose it before closing Phase 2.
- No production D1 migration, Worker/Vercel deploy, public site release, data population or merge was performed.

## Phase 2 continuation checkpoint: 2026-10-10 Asia/Bangkok

- Corrected the missing `contents.summary` column in the public-position SQLite test fixture and resolved the Prettier diagnostics from `organizationAdminRepository.ts`; the temporary read-only diagnostic workflow was removed.
- Full exact-head [CI #38020104219](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38020104219) passed on `90412a6e`, validating the public hierarchy/assignment read and internal D1 CRUD primitives.
- Added server-side `organizationWriteValidation.ts` with strict, field-allowlisted DTO validators for Organization Units, Personnel, Positions, and Assignments. The server rejects protected metadata/mass assignment, invalid references, date ranges, occupant limits, contact flags and non-private default visibility.
- Added `organizationWriteValidation.test.ts` for validation, input integrity, privacy defaults and mutation abuse cases. Exact-head [CI #38020539437](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38020539437) **PASSED** at commit `65c1a53c`: Dependency Preflight, Static Quality, Unit Tests, Worker, Build, Integration Tests, Dependencies, Governance, Functional E2E and aggregate Quality Gate all green.
- **Scope remains Phase 2 IN_PROGRESS**. The new validators are not yet connected to authenticated Admin HTTP CRUD; also outstanding are server-managed content lifecycle, RBAC/CSRF/step-up policies, audit evidence, safe conflict mapping, and reassignment/delete behavior.
- The feature remains only on `agent/org-01-domain-schema` in Draft PR #553. **Never merge intermediate phases; no production migration/deploy or real-person data was performed.**

## Phase 2 Admin API checkpoint: 2026-10-10 Asia/Bangkok

- Added dedicated `organization.read` and `organization.manage` RBAC capabilities; Admin and Editor are authorized, Viewer is denied confidential organization reads. The explicit admin route-policy inventory now covers organization collections and guarded personnel writes.
- Added authenticated `GET /api/admin/organization/{units,personnel,positions,assignments}` collection routes, with bounded maximum 100 rows and `Cache-Control: no-store`. They reuse the central CMS session, origin, CSRF, rate-limit and capability pipeline, not a parallel login.
- Added authenticated, strictly validated `POST /api/admin/organization/personnel` and revision-required `PATCH /api/admin/organization/personnel/:id`. The Worker generates identifiers, rejects system-owned/mass-assigned fields and preserves opt-in public contact visibility.
- Added password reauthentication (step-up) for organization mutations and atomic D1 personnel/audit operations using `DB.batch`. An unsuccessful revision compare-and-swap does not change the record or generate a misleading audit event.
- Added `adminOrganization.test.ts`, `organizationPersonnelRoutes.test.ts`, `organizationPersonnelAudit.test.ts` and extended route-policy regression coverage. Real SQLite tests verify transactional creation, revision conflicts, audit privacy and rollback on audit failure.
- [CI #38022241232](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38022241232) passed Static Quality, Build, Worker, Integration Tests, Dependencies and Governance. Unit Tests found four **expected-contract** regressions in existing fixed RBAC inventories (new capabilities increased the 46-entry registry to 48); Organization-specific tests passed. Updated the exact inventories in `adminCapabilities.test.ts` and `adminMfaManagementRoutes.test.ts`. A fresh exact-head CI rerun is required to verify the corrections.
- The temporary Prettier diagnostic workflow was removed. **No production DB migration, deployment, user data population or intermediate merge occurred.**
- **Phase 2 remains IN_PROGRESS:** organization content lifecycle, position and assignment mutations, archive/reassignment policy, full scope/privacy tests, and Phase 2 exit CI are outstanding.

## Phase 2 position/assignment CRUD checkpoint: 2026-10-10 Asia/Bangkok

- Added authenticated **POST/PATCH** handlers for `/api/admin/organization/positions` and `/api/admin/organization/assignments` on the same long-lived feature branch. They run behind the existing CMS session proxy, CSRF verification, origin checks, admin rate limiting, `organization.manage` RBAC and password reauthentication (step-up).
- New `organizationDutyRepository.ts` persists position/assignment changes and their audit records in the **same D1 batch transaction**. Updates require an exact `X-RCAT-Expected-Revision`, use SQL-level revision compare-and-swap and do not emit audit records for stale writes.
- Server-generated IDs, strict DTO allowlists, required references, occupancy capacity and valid assignment periods are enforced; D1 FK/capacity violations map to safe conflict responses without leaking SQL internals.
- Added route-policy inventory cases and `organizationDutyRoutes.test.ts` for valid and denied mutations, protected fields, revision errors and safe FK/capacity conflicts. Added SQLite-backed `organizationDutyAudit.test.ts` to verify atomic create/update, stale CAS, occupant limits and rollback on invalid references.
- Applied the exact CI-runner Prettier changes, then removed the diagnostic-only workflow. The **full exact-code-head [CI #38025081145](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38025081145) passed** on `00b535e6`: Dependency Preflight, Static Quality, Unit Tests, Worker, Build, Integration Tests, Dependencies, Governance, Functional E2E and aggregate Quality Gate were all successful.
- Phase 2 is **IN_PROGRESS**. Do not claim phase completion yet: organization-unit/content publication lifecycle, controlled delete/reassign operations and their permission/privacy/regression coverage remain unimplemented. Follow-up Phases 3-9 remain subject to the single final merge gate.
- **No merge to `main`, no production D1 migration, no protected deployment, no real RCAT person data population.** PR #553 stays Draft.

## Phase 2 closure — 2026-10-10 Asia/Bangkok

**Status: COMPLETE / PAUSED.** This is the authoritative current phase status. All preceding "IN_PROGRESS" checkpoints are retained as historical evidence and are superseded by this closure.

- **Phase 2 exit contract passed:** additive D1 schema and shared contracts, recursive published-unit hierarchy, active/period-filtered positions and multi-duty assignments, contact opt-in privacy sanitization, authenticated Admin list/detail and create/update/delete APIs for units, personnel, positions and assignments.
- Organization unit CRUD uses the canonical CMS `contents` slug/status/revision and a linked `organization_units` row with **atomic D1 content + unit + audit writes**, server-owned IDs, strict allowlist validation, duplicate-slug rejection, immutable content revision evidence, publish/draft controls, ancestry integrity and optimistic concurrency.
- Personnel, positions and assignments use their own revision-checked D1 transactions with audit logs. Foreign-key restrictions reject implicit cascade; callers must remove or explicitly reassign linked assignments before deleting persons, positions or units. Occupant limits and assignment date windows are guarded at both DTO and D1 levels.
- **Last-mile security closure:** isolated the `organization` type from the generic `/api/admin/content` detail, mutation, paginated list, dashboard/snapshot and bulk publish paths so those routes cannot bypass organization lifecycle revisions or expose confidential unit content to roles without `organization.read`.
- SQLite and Worker regression coverage includes revision conflicts, D1 batch rollback, hierarchy cycles, slug uniqueness, linked-entity deletion, private contacts, RBAC/capabilities, scoped Admin routes and generic-content/dashboard isolation. Required authentication/CSRF/password step-up and rate-limit paths reuse the existing CMS boundary.
- **Exact code-head CI PASS:** [run #38027607847](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38027607847) at `34c4a7908cb6b76fd34d1e1c7a31de33806023e4`. Dependency Preflight, Static Quality (including Prettier), Unit Tests, Integration Tests, Worker, Build, Dependencies, Governance, Functional E2E and aggregate `quality` all succeeded.
- **Prettier improvement:** the same-repository PR autofix [run #38027607853](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38027607853) succeeded on the exact code head without requiring a new format commit. Its stale-ref safeguard prevents forced/outdated pushes. The CI quality gate remains enabled; no lint or security gates were disabled.
- This tracker closure changes **documentation only** after that code-head CI. Reconfirm CI for the resulting documentation HEAD before calling the branch fully green. Do not start Phase 3, mark the PR ready, merge, deploy, apply production D1 migration, or populate RCAT data. PR #553 remains Draft.
- **Deferred to explicit later phases:** Phase 3 Admin facade/nav and complete RBAC application workflow; Phases 4–6 editors/personnel directory/builder UI; Phase 7 public rendering/SEO and complete scheduled-publishing UX; Phase 8 menu/search/sitemap; Phase 9 responsive/accessibility/backup and release preflight.

## Phase 3 closure — 2026-10-10 Asia/Bangkok

**Status: COMPLETE / PAUSED.** The Phase 3 implementation is closed on the single Organization feature branch. This section supersedes historical planning-only and "Phase 3 PLANNED" statements earlier in this tracker.

- **Admin RBAC alignment:** frontend CMS capability registry now recognizes `organization.read` and `organization.manage`, matching the Worker authorization and Admin/Editor versus Viewer policy already delivered in Phase 2. Frontend permission helpers, read-only classification and navigation never substitute for Worker-enforced permissions.
- **Dedicated Admin route:** `/admin/organization` is registered in the existing TanStack Router route tree and lazily loads `OrganizationPage` behind the authenticated CMS shell and `CapabilityGuard capability="organization.read"`. The CMS drawer menu is shown only to users with the dedicated capability, independent of generic `content.read`.
- **Phase 3 landing page:** a responsive, read-only overview uses authenticated Organization collections to display bounded counts for units, personnel, positions and assignments, with loading/error states. It deliberately defers Organization editor, personnel directory and builder UI to Phases 4–6.
- **API service facade:** `src/features/organization-admin/{api,query,index}.ts` exposes typed collection/detail reads, create/update/delete operations, collection-specific TanStack Query keys and targeted invalidation. All requests reuse the existing **same-origin Admin proxy** with session cookie, CSRF enforcement, password step-up and server-side RBAC. Client mutations require valid IDs and revision headers; the shared error bridge recognizes Organization stale-revision and duplicate-slug conflicts.
- **Regression tests:** added/updated capability registry, Admin RBAC utility, CMS navigation capability filtering, guarded route allow/deny, unauthenticated deep-link redirect, organization facade validation/query key isolation, and error mapping tests. Protected query keys are prefixed `admin-` so existing logout/account-switch cache clearing covers Organization data.
- **Exact code-head CI PASS:** [run #38034166955](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38034166955) at `1ae9e4bf970ce743d32b783420df491e0a3562fa`. Dependency Preflight, Static Quality/Prettier, Unit Tests, Integration Tests, Worker, Build, Dependencies, Governance, Functional E2E and aggregate `quality` all succeeded. The existing Prettier autofix [run #38034126164](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38034126164) created the formatting-only commit, and all checks passed on that exact code head.
- **Dependency plan remains uninstalled**; no Phase 4/5/6 form or tree/dnd packages were added. No protected D1 migration, deployment, production data population, PR readiness change or merge to `main` took place.
- **The tracker closure commit is documentation only**; confirm its own exact-head CI separately. PR #553 remains Draft and unmerged.

## Current blockers

- **No known Phase 3 implementation blockers.** The Phase 3 code-head CI passed. This final documentation-only checkpoint requires exact-head CI confirmation.
- Feature completion, final merge and production release remain intentionally blocked until Phases 4–9 are finished, reviewed and validated. Protected production release and RCAT real data population remain Phases 10–11.

## Next action

**PAUSE BEFORE PHASE 6.** Phase 5 code-head CI passed on `dc25e3a4e80ff8c01ba0306966526bcbe5b612dd`. Keep `agent/org-01-domain-schema` and [Draft PR #553](https://github.com/yiwssx/new-www.rcat.ac.th/pull/553) open and unmerged. Do not start Phase 6, deploy, or populate production data until separately authorized.

## Phase 4 active checkpoint — 2026-10-10 Asia/Bangkok

- User reauthorized continuation of the dedicated Organization list/editor on the existing long-lived feature branch. The single-merge gate and Draft PR #553 remain in force.
- Added Phase 4 form dependencies (`react-hook-form`, `zod`, `@hookform/resolvers`), dedicated dialog and list/editor screen with typed lifecycle fields, protected CRUD, Thai-local publication dates and exact optimistic revision headers.
- Implemented bounded incremental loading for the Admin units table via `useInfiniteQuery` and `nextOffset`, with visible Load More and retry feedback rather than a silent 100-unit cap; added pagination regression test.
- Diagnosed CI regressions: repository invalid-pagination assertions expected Promise rejections from synchronous validation, while the Worker requires UTC `toISOString()` but the form initially sent `+07:00` offsets. Both corrections have landed in the active feature branch. Replaced React Hook Form `watch()` with `useWatch()` to satisfy React compiler lint.
- **Verification pending:** Await exact-final-head CI (Unit Tests, Static Quality/Prettier, Worker, Build, Integration, Security/Governance and aggregate Quality) and reconcile any further failures. Do not infer success from prior/cancelled runs.
- **No intermediate merge, production D1 migration, release or real personnel data changes.** Phase 5–11 remain deferred.

## Phase 4 closure — 2026-10-10 Asia/Bangkok

**Status: COMPLETE / PAUSED BEFORE PHASE 5.** This section supersedes the preceding Phase 4 in-progress checkpoint.

- Dedicated `/admin/organization` list and editor now support protected create/edit/delete, title/slug, unit kinds, recursive parent choices, display order, publication state/windows and visible validation errors. Read-only roles cannot access write controls.
- React Hook Form + Zod + resolver adopted under the approved Phase 4 dependency plan; `useWatch` avoids React Compiler lint warnings. Local Thai wall-clock publication times are converted to canonical UTC ISO instants accepted by Worker validation.
- The units list uses offset-based infinite pagination with an explicit Load More action, error feedback and regression coverage. The former misleading 100-record hard-stop warning was removed. Personnel/positions/assignments counters remain bounded previews until their respective phases.
- Revision-safe writes, stale-conflict recovery, hierarchy cycle guards, reserved slugs, validation and publication windows have unit/Worker regression coverage. The Worker remains authoritative for RBAC/CSRF/step-up, D1 writes and privacy.
- **Exact-code-head full CI passed** at `998317d42b6b0204ecc812617a837e45fc4b390a`: [CI run #38038056497](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38038056497). Dependency Preflight, Static Quality/Prettier, Unit Tests, Integration Tests, Worker, Build, Dependencies, Governance, Functional E2E and aggregate Quality all succeeded. Prettier autofix applied formatting-only commit `998317d42b`.
- This tracker closure is documentation-only after the validated code head; verify its own CI separately. **No merge to `main`, protected D1 migration, production deploy or real RCAT data population occurred.** Draft PR #553 remains WIP for Phases 5–9.

## Phase 5 closure — 2026-10-10 Asia/Bangkok

**Status: COMPLETE / PAUSED BEFORE PHASE 6.** This checkpoint supersedes the earlier Phase 5 planning state.

- Added the **canonical personnel directory** within the existing dedicated `/admin/organization` Admin page; personnel records are globally reusable across divisions, works, departments and assignments without cloning profiles or creating a parallel user account.
- Protected create/edit/delete flows reuse the existing `organization.read/manage` RBAC, CMS session, CSRF, origin/step-up protections and optimistic row revisions. Deletes require explicit confirmation and cannot silently cascade through linked assignments.
- Reused Phase 4 **React Hook Form + Zod + MUI** and the existing **Media Library image picker**, without new dependencies or upload services. Worker rejects nonexistent or non-image `photoMediaId` values; profile photos remain references to `media_assets`.
- Public email/phone visibility controls are opt-in per person and default to private. Contacts are not shown in the Admin directory summary; the public Worker sanitizer remains authoritative in Phase 7 rendering.
- Added **paged personnel reads** using bounded `limit`/`offset`, stable name/id ordering and explicit Load More, with validation at the API boundary and Worker repository. Search is clearly scoped to rows loaded in the browser, avoiding a false global-search promise.
- Added targeted tests for personnel directory RBAC/privacy, create/edit/delete, Media Library selection, public-contact validation, pagination, REST path/offset boundaries and image-reference enforcement. The Media Picker test mock uses a real MUI Dialog portal to match accessibility behavior in production.
- **Exact-code-head full CI PASSED:** [CI #38039829166](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38039829166) on `dc25e3a4e80ff8c01ba0306966526bcbe5b612dd` — Dependency Preflight, Static Quality/Prettier, Unit Tests, Integration Tests, Worker, Build, Dependencies, Governance, Functional E2E, aggregate `quality` all successful.
- This tracker closure is documentation-only; its post-write exact-head CI must be checked separately. **Do not merge PR #553, deploy production, apply production D1 migrations, or populate real RCAT personnel.** Phase 6 remains unstarted pending explicit instruction.

## Phase 6 implementation checkpoint — 2026-10-10 Asia/Bangkok

- Phase 6 authorized by the user; still WIP on the existing draft PR #553 branch. No merge, protected release, production data or production migration.
- First prerequisite: enable safe offset pagination for **positions and assignments**, matching existing units/personnel semantics. Without this, the builder silently omits duties after the first 100 rows.
- Add deterministic, cycle-tolerant, accessible hierarchy flattening plus position grouping and unique-enabled-occupant presentation helpers with regression tests.
- Next gates: interactive position/assignment CRUD and reassignment; keyboard/touch-accessible ordering; full-result loading, D1-atomic multi-record reordering if provided, and exact-final-head CI.
- The proposed Tree View / drag packages remain **not installed** pending an accessible prototype and peer/license review. Existing React/MUI controls can provide an immediate non-drag baseline; do not equate drag functionality with a correct transactional reorder API.
- Phase 6 is **IN PROGRESS**, not complete. Preserve historical checkpoint entries above as evidence rather than retroactively rewriting them.

## Phase 6 continuity — 2026-10-10 Asia/Bangkok

- Continued on the latest CI-green feature branch; earlier exact-head run [#38063244786](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38063244786) passed before this checkpoint.
- Hardened builder narrow-screen hierarchy indentation, distinct empty-vs-failed position states, partial-page messaging and unloaded dropdown selection stability.
- Added UI regression tests for paging past the initial 100-position window, failed reads, and stale-revision rejection. Recheck exact new head CI before marking Phase 6 complete.
- No Tree View or drag/drop package installed; keyboard/touch-editable numeric ordering remains the supported accessible path pending any justified atomic batch-reorder requirements.
- Governance: draft PR #553, single branch only, no merge or protected production operations.

## Phase 6 rule correction and hardening — 2026-10-10 Asia/Bangkok

- **Authoritative personnel assignment policy: no appointment-term management.** The organization feature has no assignment `startsAt`/`endsAt` fields, no start/end time form, no expiry scheduler and no temporal visibility filters. Administrators explicitly enable, disable, reassign or remove duties; this does not affect the separate canonical CMS `publishAt`/`unpublishAt` settings for unit pages.
- D1 occupant limits count **distinct personnel attached through enabled duties**, not distinct duty rows. One person may hold multiple duties across positions/units. A capped appointment is freed only when the administrator disables or removes all duties for the outgoing person. D1 revision/audit protections, foreign keys and delete restrictions remain.
- Adopted **`@mui/x-tree-view` 9.15.0** RichTreeView for the hierarchy navigator, with explicit nested data, expand/collapse, selected-unit state, readable wrapping labels, keyboard navigation and mobile-compatible layout. Lockfile regenerated with pnpm 10 strict peers. No MUI X Pro licensed feature is used.
- **No DnD dependency adopted:** Numeric group/position/assignment order is already editable by keyboard and touch under revision-checked single-row writes. Unreviewed cross-parent drag/reorder would need coordinated transactional writes and stronger move/cycle safeguards; keep drag/drop optional instead of shipping a misleading control.
- Regression tests expanded for manually managed handovers, disabled/re-enabled duties, cross-unit reassignment/capacity denial, public visibility, scheduling-field rejection, absent term fields and accessible tree selection. The one-time lockfile repair workflow was removed after lock synchronization to restore the bounded workflow inventory.
- **Phase 6 remains IN PROGRESS until all required checks pass for its final exact code+tracker SHA.** No merge, production migration/deployment or real staff data population. Historical Phase 2/6 checkpoint descriptions of period-based duties are superseded by the policy above.

## Phase 6 final closure — 2026-10-10 Asia/Bangkok

**Status: COMPLETE on the feature branch; PAUSE BEFORE PHASE 7.** This checkpoint supersedes older Phase 6 `IN PROGRESS` and `DnD not installed` historical notes above.

- Installed `@mui/x-tree-view` 9.15.0, `@dnd-kit/react` 0.5.0 and `@dnd-kit/helpers` 0.5.0 with the pnpm 10 strict-peer lockfile. Removed the one-time DnD lockfile generation workflow after successful sync.
- Organization Builder now supports accessible, nested unit navigation, organization-scoped positions, reused canonical personnel, manual duty enabling/disabling, multiple simultaneous roles, cross-unit reassignment, numeric keyboard/touch order editing and same-sibling drag/drop position and duty sorting. No appointment or term expiry is present.
- Added authenticated `POST /api/admin/organization/reorder`, restricted to `organization.manage`. D1 enforces a complete sibling group, matched revisions, transactionally changed rows, and audit records. Sorting never silently moves personnel between groups/positions, and stale/incomplete lists are rejected rather than partially saved.
- Tests cover the Admin facade/route policy, drag handles, complete/stale/conflicting scopes, audit/no-partial-write behavior, manual handovers and D1 occupant limits; supplied a jsdom-only ResizeObserver stand-in for the new drag library. Real browser behavior remains covered by Functional E2E and fuller mobile/accessibility verification remains Phase 9.
- **Verified code-head CI:** [CI run #38068146144](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38068146144) at `c3130f3addf70e1e9679558cab64ec1df1f33bad`: Dependency Preflight, Dependencies, Static Quality, Unit Tests, Integration Tests, Worker, Build, Governance, Functional E2E, and aggregate `quality` all **SUCCESS**.
- **Final tracker SHA CI pending verification after this documentation commit.** Remain on `agent/org-01-domain-schema`; keep [PR #553](https://github.com/yiwssx/new-www.rcat.ac.th/pull/553) Draft, unmerged, and unchanged in production. Phase 7 must start only on a subsequent explicit instruction.

## Phase 7 public organization delivery — 2026-10-10 Asia/Bangkok

**Status: COMPLETE / PAUSED BEFORE PHASE 8.** User authorized Phase 7 after final Phase 6 exact-head CI #38068468945 passed. Phase 7 code was validated by exact-head CI #38069911353. No Phase 8 or 9 work begins here.

- Added published-only Worker endpoint `GET /api/public/organization/:slug` alongside the existing list projection. It yields the requested organization unit, published ancestor breadcrumbs, visible descendants, scoped positions/assignments and image-only Media Library assets; missing/draft/scheduled/unpublished ancestor chains return 404 without private record disclosure.
- Added dedicated React/TanStack Query public organization facade, hydrated SSR loader, and public route `/organization/$slug` with a responsive heading, nested units, position cards, duties, reused canonical people, safely redacted public-contact fields and Media Library portraits. Numeric sorting and manual duty activation remain separate Admin concerns from completed Phase 6.
- Reused centralized route-head infrastructure for dynamic title, summary, canonical permalink, Open Graph metadata, WebPage structured data and ancestor BreadcrumbList JSON-LD. Missing/unavailable detail does not advertise an indexable canonical.
- Reserved the `organization` public route root and ensured generic `/api/public/content/:slug` detail cannot render organization content as an ordinary CMS article. Phase 8 will handle full menu, search and sitemap integration.
- Slugs can contain Thai/Unicode letters, numbers and hyphen-separated words under the **existing CMS form/Worker slug contract**. Shared validation now covers the Worker public permalink and browser facade as well as Admin.
- Regression tests cover public scoped projections, unpublished ancestors, private contacts, disabled/inactive assignments, route-head canonical/JSON-LD and API errors. CI must pass against the exact implementation head before Phase 7 may be marked COMPLETE. Do not merge or deploy from this feature branch.

## Phase 7 closure — 2026-10-11 Asia/Bangkok

**Status: COMPLETE on the Organization feature branch; PAUSED BEFORE PHASE 8.** This closure supersedes prior Phase 7 `IN PROGRESS` notes.

- **Verified exact code-head:** `6d3c26ad8b0d68c3a671066f287581f2420bce33`; [CI run #38069911353](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38069911353) **COMPLETED SUCCESS**. All 10 jobs passed: Dependency Preflight, Dependencies, Static Quality (including Prettier/lint), Unit Tests, Integration Tests, Worker, Build, Governance, Functional E2E and the aggregate `quality` gate.
- Public organization permalinks use the published-only Worker read model with Unicode/Thai slug support, safe ancestor/descendant projections, scoped positions and canonical personnel profiles; private contact fields, draft/hidden ancestors, disabled duties and inactive personnel are excluded.
- Reused established TanStack Router SSR loader/hydration, MUI responsive rendering, Media Library photos, SEO head/canonical, Open Graph, WebPage and BreadcrumbList JSON-LD. Organization slugs are kept separate from generic content permalinks.
- Regression coverage includes published/draft 404 behavior, Thai slug round-trip, hierarchy traversal, SSR/SEO metadata, API contract validation, privacy, and the public React renderer. Phase 8 menu, search and sitemap work and Phase 9 deeper mobile/a11y audits remain intentionally unstarted.
- This final tracker-only documentation commit requires its own exact-head CI confirmation. Keep the existing feature branch and Draft PR unmerged. No production migration, deployment, or real personnel data changes.

## Phase 8–9 final closure — 2026-10-11 Asia/Bangkok

**Status: PHASE 8 COMPLETE / PHASE 9 COMPLETE; PAUSED BEFORE FINAL MERGE / PROTECTED PHASE 10.** This checkpoint supersedes the older Phase 7 `PAUSED BEFORE PHASE 8` statement, retained above for audit history. The user approved both phases together.

- **Exact implementation head validated:** `9bb0c6c98419c5abc38923634684d4d0484bdd1b` by [CI #38072202868](https://github.com/yiwssx/new-www.rcat.ac.th/actions/runs/38072202868), `completed/success`, all 10 jobs SUCCESS: Dependency Preflight, Dependencies, Static Quality, Unit Tests, Integration Tests, Worker, Build, Governance, Functional E2E and aggregate `quality`. Functional suite: 83 passed.
- **Phase 8:** Existing Menu editor now offers published Organization permalinks without adding a parallel navigation system. Public search queries explicitly exclude `type='organization'` in generic content SQL and return separate published-only Organization cards linking to `/organization/<slug>`; runtime sitemap discovers published-only Organization URLs from the authoritative public Worker list, with safe Unicode slug encoding and regression tests. Scheduled units are visible at/after `publishAt` only when their entire ancestor chain is public, and hidden after `unpublishAt`.
- **Phase 9:** Added `@axe-core/playwright` 4.13.0 in the strict pnpm 10 lockfile (and removed the one-time generator). Synthetic-data Playwright/axe accessibility tests cover Thai-slug public pages at 390px and 1280px, no horizontal overflow, headings, links, and missing/unpublished 404; all functional checks passed in code-head CI. Backup counts/download and MFA-controlled portable Merge recovery now include `organization_units`, `personnel`, `organization_positions`, and `organization_assignments`; recovery enforces parent-first order, primary keys and cycle rejection. Tests cover backup rows, ordering, and publishing/search protection.
- **Release readiness:** [Acceptance and release gate](./organization-acceptance-and-release-gate.md) documents private backup handling, production D1 Time Travel, the 4 MiB Merge limitations, isolated migration rehearsals and manual preview browser/keyboard checks. These operator checks remain for the protected release path, not claimed as performed against real production.
- **Final tracker-only SHA CI pending confirmation after this documentation commit.** No merge to `main`, no production D1 migration or deploy, no real RCAT data, and no Phase 10–11 operations. Keep the feature branch, Draft PR, and all production release gates unchanged. The next step is a separate explicit decision on final pre-merge review and protected production cutover.
