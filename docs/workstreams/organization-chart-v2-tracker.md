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
- [ ] V2-04: format, lint, typecheck, unit/integration and accessibility regression CI
- [ ] V2-05: review edge cases, page sizes/long names/mobile, test public permalink and admin save in staging
- [ ] V2-06: documented release gate and owner-authorized merge

## Release restrictions

No GitHub Actions workflow edits, bypassed CI, production D1 writes, real RCAT personnel imports,
or production releases are authorized by this development branch.
