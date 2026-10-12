# Organization Chart V2 — execution tracker

GitHub tracking issue: [#574](https://github.com/yiwssx/new-www.rcat.ac.th/issues/574)

Approved: 2026-10-12. Branch: `feature/organization-chart-layout-v2`.
This is a new workstream, independent of the closed Organization Content Phases 0–10 tracker.

## Product specification

- Each published organization page chooses its own layout: legacy cards, **A** portrait rows, or **B** reporting tree.
- Layout A lets editors place positions on arbitrary hierarchical levels, rows, and horizontal order.
- Layout B uses explicit parent-position references. Do **not** infer supervision from departmental nesting or position titles.
- Multiple people may share a position; a person may have multiple simultaneous assignments.
- Legacy pages remain card-based until an editor selects another mode.
- Keep responsive legible portraits, keyboard-accessible non-drag editing, read-only public SSR and privacy projections.

## Implementation decisions

- Reuse `organization_units.settings_json` to store `chartMode` and per-unit `chartLayout`. No new migration/table required.
- Chart records are keyed by existing position IDs and are bounded, validated DTOs; the Worker checks ownership at save.
- Updates retain the original organization unit + content revision CAS and audit trail.
- Keep public contact visibility opt-ins, active assignment checks, and published ancestor chains.
- Admin uses a live preview; photos are resolved from the existing Media Library on the public page.

## Checkpoints

- [x] V2-01: fresh issue and isolated branch
- [x] V2-02: scoped chart placement contracts, persistence and public projection (implementation)
- [x] V2-03: row/tree renderers and admin layout editor (implementation)
- [ ] V2-04: format, lint, typecheck, unit/integration and accessibility regression CI (rerun pending)
- [ ] V2-05: review edge cases, page sizes/long names/mobile, test public permalink and admin save in staging
- [ ] V2-06: documented release gate and owner-authorized merge

## Final acceptance and staged release plan

- **Verified code checks:** GitHub CI covers Worker typecheck, build, format, unit tests, integration tests and Playwright. Confirm the **latest** PR head and final `quality` gate are green after each change.
- **Admin acceptance:** In an isolated test fixture, select one unit, set mode A and edit level/row/order; then switch to mode B and define parent positions. Save at the expected unit revision, refresh, and verify the exact persisted mode/layout.
- **Responsive acceptance:** On a 390px handset and 1280px desktop, verify people and job titles remain readable, horizontal scroll is confined to the chart, connecting lines have correct direction, and keyboard users can reach chart regions.
- **Publishing acceptance:** An unpublished unit and a child under an unpublished parent must never appear in public reads. Default legacy `cards` layout must remain intact until an editor explicitly changes mode.
- **Environment limitation:** The current Cloudflare Worker and D1 are **production-only**. Vercel preview verifies frontend rendering/build only, not real Worker CRUD. Never use production D1 as a staging fixture or interpret the physical suffix `preview` as a safe testing environment.
- **Deploy coupling:** The main-branch frontend may deploy before the production Worker. Coordinate any future merge and protected Worker release during a planned maintenance window. Do not enable mode A/B for live units until the Worker API with chart fields is deployed and verified.
- **Rollback:** On a layout-specific failure, return affected units to legacy `cards` mode using normal revision-guarded editor writes (only if the API is healthy). Frontend rollback must use the project's governed Vercel release path; do not overwrite unit settings, remove assignments or revert D1 data manually.
- **Review gate:** T05 requires owner/operator visual approval and a protected backend test plan. A green CI or READY Vercel preview by itself does not authorize production rollout.

## Release restrictions

No GitHub Actions workflow edits, bypassed CI, production D1 writes, real RCAT personnel imports,
or production releases are authorized by this development branch.
