# Organization Content Workstream Tracker

Status: **ACTIVE / PHASE 1 IMPLEMENTATION IN PROGRESS**

Updated: 2026-10-09 Asia/Bangkok

Repository: `yiwssx/new-www.rcat.ac.th`

Baseline branch: `main`

Recovery source: closed, unmerged [PR #524](https://github.com/yiwssx/new-www.rcat.ac.th/pull/524) (historical planning baseline only)

## Recovery checkpoint

- Restored onto current `main` through a documentation-only PR on 2026-10-08.
- Phase 0 planning is complete; Phase 1 resumed on 2026-10-09; Phases 2-11 have **not** started.
- The Organization workstream was explicitly resumed on 2026-10-09. Implementation is scoped to non-production PRs.
- This tracker restoration does not authorize feature code, D1 migration, deployment, production data population, or other production changes.

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
| 1     | Schema + shared contracts                            | IN_PROGRESS  | Append-only D1 migration, types, validation, indexes, hierarchy/assignment integrity tests                                                                    |
| 2     | Worker repositories + public/admin APIs              | PLANNED      | CRUD/read contracts, recursive unit reads, personnel/position/assignment operations, safe public sanitizer                                                    |
| 3     | RBAC + Admin routing/service layer                   | PLANNED      | Dedicated capabilities, route policy, API facade/query keys, Admin navigation entry                                                                           |
| 4     | Organization list/editor                             | PLANNED      | Dedicated `/admin/organization` list, title/slug/type/parent/status workflow, revision-safe writes                                                            |
| 5     | Personnel directory                                  | PLANNED      | Canonical personnel CRUD, Media Library photo selection, reuse across organization pages                                                                      |
| 6     | Organization builder                                 | PLANNED      | Unit positions, assignment/reassignment, ordering, multiple duties, occupant limits, accessible non-drag controls; drag/drop only if justified                |
| 7     | Public renderer + permalink/SSR/SEO                  | PLANNED      | Published organization slugs resolve through public routing, hierarchy/breadcrumbs render, draft/private fields remain inaccessible                           |
| 8     | Menu/search/sitemap integration                      | PLANNED      | Menu can link to organization pages; search/sitemap behavior is deliberate and tested; generic content lists do not leak organization records unintentionally |
| 9     | Quality, accessibility, performance, backup coverage | PLANNED      | Unit/integration/functional tests, format/lint/build/worker checks, responsive/mobile verification, backup counts/download include new tables where required  |
| 10    | Production migration + release verification          | PLANNED      | Protected migration/deploy sequence completed once, browser verification passes, tracker records release evidence                                             |
| 11    | RCAT content population                              | PLANNED      | Real divisions, works, departments, personnel, positions, and assignments entered only after runtime feature verification                                     |

## Implementation sequence

Use one narrow implementation branch/PR per phase or tightly coupled phase pair. Do not combine schema, Admin UI, public rendering, and production content population into one large PR.

Suggested branch sequence:

- `agent/org-01-domain-schema`
- `agent/org-02-worker-api-rbac`
- `agent/org-03-admin-organization`
- `agent/org-04-personnel-directory`
- `agent/org-05-organization-builder`
- `agent/org-06-public-renderer`
- `agent/org-07-integration-quality`
- release/data-population branches only after all implementation PRs are green on `main`.

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
- Active implementation branch: `agent/org-01-domain-schema`.
- Phase 1 work staged: append-only migration `0020_organization_content_foundation.sql`, shared domain/privacy contracts, Worker row columns, SQLite and contract regression tests.
- Phase 1 **not complete** pending CI verification on its final head and all required gates; Phases 2-11 remain PLANNED.
- Safety: no protected D1 migration, Cloudflare/Vercel deployment, live data, GitHub gate suppression, or pnpm major upgrade.
- Carry forward: Worker CRUD/repository/authorization in Phases 2-3; public rendering and navigation in Phases 7-8. Do not expose Organization content through generic lists prematurely.

## Current blockers

- No product/design blockers identified. Phase 1 implementation requires exact-head CI results before merge.

## Next action

Check the Phase 1 pull request's head SHA and required CI/governance gates, fix any source-backed failures, then merge only when green. Update this tracker with commit/PR and verification evidence before proceeding to Phase 2. Do not apply the schema to production during PR development.
