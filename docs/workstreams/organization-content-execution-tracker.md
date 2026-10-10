# Organization Content Workstream Tracker

Status: **PAUSED / PHASE 1 COMPLETE / PHASE 2 COMPLETE / PHASE 3 PLANNED / FEATURE BRANCH ONLY — NO MERGE**

Updated: 2026-10-10 Asia/Bangkok

Repository: `yiwssx/new-www.rcat.ac.th`

Baseline branch: `main`

Recovery source: closed, unmerged [PR #524](https://github.com/yiwssx/new-www.rcat.ac.th/pull/524) (historical planning baseline only)

## Recovery checkpoint

- Restored onto current `main` through a documentation-only PR on 2026-10-08.
- Phase 0 and Phase 1 are complete. Phase 2 **COMPLETE / PAUSED** as of 2026-10-10 after the exact-head all-green exit gate. Phases 3-11 remain planned; do not start the next phase without a new instruction.
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
  - personnel reference, organization position reference, ordering, note/duty detail, active dates where needed, enabled state, revision.
  - uniqueness must not prevent one person from holding multiple duties in one unit.

## Status tracker

| Phase | Scope                                                | State        | Exit criteria                                                                                                                                                 |
| ----- | ---------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Discovery, pnpman review, domain model, tracker      | **COMPLETE** | Architecture decisions above are recorded and no implementation has started                                                                                   |
| 1     | Schema + shared contracts                            | COMPLETE     | Append-only D1 migration, types, validation, indexes, hierarchy/assignment integrity tests                                                                    |
| 2     | Worker repositories + public/admin APIs              | COMPLETE     | CRUD/read contracts, recursive unit reads, personnel/position/assignment operations, safe public sanitizer                                                    |
| 3     | RBAC + Admin routing/service layer                   | PLANNED      | Dedicated capabilities, route policy, API facade/query keys, Admin navigation entry                                                                           |
| 4     | Organization list/editor                             | PLANNED      | Dedicated `/admin/organization` list, title/slug/type/parent/status workflow, revision-safe writes                                                            |
| 5     | Personnel directory                                  | PLANNED      | Canonical personnel CRUD, Media Library photo selection, reuse across organization pages                                                                      |
| 6     | Organization builder                                 | PLANNED      | Unit positions, assignment/reassignment, ordering, multiple duties, occupant limits, accessible non-drag controls; drag/drop only if justified                |
| 7     | Public renderer + permalink/SSR/SEO                  | PLANNED      | Published organization slugs resolve through public routing, hierarchy/breadcrumbs render, draft/private fields remain inaccessible                           |
| 8     | Menu/search/sitemap integration                      | PLANNED      | Menu can link to organization pages; search/sitemap behavior is deliberate and tested; generic content lists do not leak organization records unintentionally |
| 9     | Quality, accessibility, performance, backup coverage | PLANNED      | Unit/integration/functional tests, format/lint/build/worker checks, responsive/mobile verification, backup counts/download include new tables where required  |
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

## Current blockers

- **No outstanding Phase 2 implementation or CI blocker.** Phase 2 exit criteria are complete and its exact-code-head required CI passed. This documentation-only closing commit starts a new exact-head run for confirmation.
- The final merge/deployment remains intentionally blocked until all pre-merge Phases 1–9 are finished, reviewed and validated. Production D1 apply/deploy and real data population remain Phases 10–11 after the single final merge.

## Next action

**PAUSE HERE.** Do not begin Phase 3 without new user authorization. Preserve `agent/org-01-domain-schema` and Draft PR #553. Upon resumption, implement Phase 3 Admin navigation/service layer on the same branch, without intermediate merge. Protected production migration/deployment and real-person data population remain post-merge phases.

