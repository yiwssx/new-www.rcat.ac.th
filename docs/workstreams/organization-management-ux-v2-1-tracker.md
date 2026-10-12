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
- [ ] Phase 2: extract positions, assignments and chart into distinct focused managers; avoid global builder fetches and preserve every CRUD path.
- [x] Phase 3 partial: server-bounded search/filter and exact-count read implementation for all four collections; personnel directory uses server query/paging.
- [ ] Phase 3: deploy Worker with existing protected release gate; scope builder reads by unit; async personnel selection; server-owned append order; dedupe and multi-duty regression coverage.
- [ ] Phase 4: row/level editor enhancements, preview and public responsiveness; mode A/B remains existing V2 implementation for now.
- [ ] Phase 5: fix all CI findings; typecheck, Worker/unit/integration, Playwright, RBAC, conflict/428, accessibility and responsive matrix.
- [ ] Phase 6: verify required approvals and CI on authoritative head, merge to main, verify Vercel deployment, protected Worker release, owner UAT and #574 acceptance.

## Safety / compatibility

- Do not edit workflows or circumvent failed checks.
- No production D1 writes, test personnel records, destructive migrations or auth relaxation.
- **Frontend and Worker must be released in a compatible sequence**: admin totals and filtered personnel use the new Worker query contract `includeTotal=1`.
- Existing `organization.read`, `organization.manage`, CSRF, audited writes, revision CAS, 409/428 guards remain authoritative.
- Keep PR draft and tracker open until all acceptance gates have recorded evidence.
- Prettier autofix can advance the branch head; always re-read the current remote SHA before the next mutation.

## Latest checkpoint — 2026-10-12

- Initial feature commit `c39d9e57` introduced six navigation routes.
- `02e1a568` introduced bounded Worker search/count and frontend total queries.
- Prettier advanced head to `af6adbb1`; `ace1d032` implemented searchable personnel directory.
- Draft PR #577 opened; initial CI #38232765281 showed Static Quality failure (pre-autofix Prettier), with other lanes running. Later CI on the current head must be checked independently.
- Production/release evidence **none** for V2.1; do not claim completion.
