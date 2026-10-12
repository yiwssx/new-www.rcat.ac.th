# Organization Management UX V2.1 — execution tracker

**Status:** ACTIVE — NOT RELEASE READY
**Parent:** GitHub issue #576; V2 rollout issue #574
**Draft PR:** #577 — `feature/organization-management-ux-v2-1` into `main`
**Baseline:** `4c602089e602c74405127f7f1b1682d68f3e5bb4`

## Verification-first status

- [x] Current main, V2 #575 merge, existing route/backend architecture inspected.
- [x] Phase 1 implementation: Organization expandable submenu and six protected admin routes.
- [ ] Phase 1 acceptance: responsive/keyboard matrix and green CI.
- [x] Phase 2 partial: route-dependent rendering; overview no longer mounts full personnel and builder; personnel and units are independent routes.
- [x] Phase 2 partial: scoped builder data fetching is enabled only after selecting a unit, with unit-scoped positions/assignments/personnel; pages show action-specific controls and chart-only editing; server-backed unit search selects entries beyond first 100.
- [ ] Phase 2: verify component boundaries and improve positions/assignments independent page UI, loading/revision handling and accessibility.
- [x] Phase 3 partial: server-bounded search/filter and exact-count read implementation for all four collections; personnel directory uses server query/paging.
- [x] Phase 3 partial: Worker adds scoped reads and central personnel lookup within assignment editor; personnel directory search queries all DB records.
- [ ] Phase 3: debounce builder lookup, implement fully server-owned append and robust no-load-all write semantics, unit parent async search, duplicate/multi-duty regression tests, deploy Worker via protected gate.
- [x] Phase 4 partial: per-position level/row/order adjustment buttons in chart editor and non-ranked first-level fallback, existing A/B preview remains.
- [ ] Phase 4: verify tree connector and row usability on desktop/mobile, test save/reload of hierarchy layout and public horizontal responsiveness.
- [ ] Phase 5: fix all CI findings; typecheck, Worker/unit/integration, Playwright, RBAC, conflict/428, accessibility and responsive matrix.
- [ ] Phase 6: verify required approvals and CI on authoritative head, merge to main, verify Vercel deployment, protected Worker release, owner UAT and #574 acceptance.

## Safety / compatibility

- Do not edit workflows or circumvent failed checks.
- No production D1 writes, test personnel records, destructive migrations or auth relaxation.
- **Frontend and Worker must be released in a compatible sequence**: admin totals and filtered personnel use the new Worker query contract `includeTotal=1`.
- Existing `organization.read`, `organization.manage`, CSRF, audited writes, revision CAS, 409/428 guards remain authoritative.
- Keep PR draft and tracker open until all acceptance gates have recorded evidence.
- Prettier autofix can advance the branch head; always re-read the current remote SHA before the next mutation.
- The user explicitly asked for full completion. Do not claim completion or merge while CI/Worker contracts and UAT remain incomplete.

## Latest checkpoint — 2026-10-12

- Initial feature commit `c39d9e57` introduced six navigation routes.
- `02e1a568` introduced bounded Worker search/count and frontend total queries.
- Prettier advanced head to `af6adbb1`; `ace1d032` implemented searchable personnel directory.
- Draft PR #577 opened; initial CI #38232765281 showed Static Quality failure (pre-autofix Prettier), with other lanes running. Later CI on the current head must be checked independently.
- Production/release evidence **none** for V2.1; do not claim completion.

## Checkpoint — 2026-10-12 subsequent implementation

- Head at checkpoint read: `d891800e6288ae9f90545adfdab3547860f4e6e4`.
- Scoped Worker personnel filter: `3ebb19df`; unit-scoped builder and lookup: `23dd25de`.
- Added filtered-read regression tests and view-specific controls: `ed99617d`.
- Removed implied hierarchy rank from `groupSortOrder` (fallback level 1), and updated regression test: `afa9bf39`.
- Server-backed unit search/selection for records beyond page 1: `bd1fce74`.
- Latest examined authored CI #38234307252: Dependency Preflight, Dependencies, Build, Worker, Integration Tests, Governance SUCCESS; Static Quality FAILURE on unformatted OrganizationBuilder.tsx; Unit/E2E IN PROGRESS. Autofix #38234307264 was active. This is **not** a passed gate and CI on newest head must be verified.
- PR #577 remains draft and should not be merged; no verified production Worker release, Vercel deploy, or UAT for V2.1.
- Next: inspect autofix and latest authored CI results, fix any new test/type failures, complete unfinished Phase 2/3/4 then acceptance gates, release Worker safely ahead of frontend code.

## 2026-10-12 — Incremental QA fix: legacy pagination

- Focus: Phase 5 regression repairs only; no workflow or production changes.
- Feature commit: `70306568486c49a5ad7f16370a32c926b60894b5`.
- Corrected duplicate unit “load more” buttons when the legacy combined view renders both list and builder; keep the dedicated button for the new builder-only routes.
- Kept the legacy three-argument `getOrganizationCollection` call in the builder; scoped V2.1 queries retain their fourth options argument.
- Evidence: prior full CI `38234599814` failed exactly two Organization unit tests, and Static Quality failed because this tracker had unformatted Markdown. An autofix commit subsequently appeared.
- New CI `38236207097` and Prettier autofix `38236207188` were queued when recorded. **Verification pending:** check the latest post-autofix branch commit, Static Quality, Unit Tests and all other required jobs before treating this checkpoint as accepted.

## 2026-10-12 — CI-only static quality repair

- CI run `38236261959`: all primary jobs passed except Static Quality. Unit Tests, Build, Worker, Integration, E2E, Dependencies and Governance succeeded.
- Static Quality failure: ESLint `no-control-regex` in `cloudflare/public-api/src/routes/adminOrganization.ts:34`; Prettier passed.
- Commit `915e5072` replaces the regex with the equivalent control-character code point check; no security rule, workflow or production behavior weakened.
- Verification: CI run `38236986296` and Prettier autofix `38236986424` started. Their final status remains unverified at this checkpoint.
- Pause requested by owner after CI is green. PR #577 remains draft; no merge or production deploy.
