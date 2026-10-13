# Organization Chart V2.2 — Phase 6 release and field acceptance

Related: issue #580, PR #581. Production source of truth is protected `main`.

## Verified pre-merge gates

- The feature branch contains only frontend organization rendering, Admin UX, tests
  and this release handoff; no Worker, schema, permission, workflow or dependency changes.
- Require the latest PR-head `quality` check on the **pull_request** event to pass.
  Also verify CodeQL (actions and JavaScript/TypeScript), Static Quality,
  Unit, Integration, Build, Worker, Governance and Functional E2E results.
- A manually dispatched CI run does not replace the required PR check.
- Merge through the standard protected pull request. Do not use an admin bypass
  or deploy from a feature branch.
- A Worker redeploy is **NOT REQUIRED** for this frontend-only release.
- Confirm the Vercel production deployment commit corresponds to the merged
  `main` commit before asking the owner to inspect the live website.

## Owner field-acceptance checklist (after main deployment)

- [ ] Open an actually published `/organization/<slug>` on the production site.
- [ ] Confirm a parent organization has horizontal sibling units and that a
      three-or-more-level parent-to-child path retains its connecting lines.
- [ ] On mobile (approximately 390px), scroll the chart horizontally; ensure
      the entire webpage does not expand horizontally or clip Thai headings.
- [ ] On desktop (approximately 1280–1440px), confirm sibling alignment,
      connectors and independent chart scroll regions.
- [ ] Verify each unit's saved mode: A/Rows, B/Tree or classic Cards.
      People and positions must appear inside their assigned unit only.
- [ ] Check one individual assigned to multiple positions or units:
      each distinct duty should remain visible without duplicate rendering.
- [ ] Check empty positions, missing portraits, and optional qualifications.
      Education text should appear only for departments when supplied.
- [ ] In Admin > Organization > Chart, preview hierarchy, choose a unit,
      save a layout and reload to confirm revision/state. Use owner-approved data.
- [ ] Confirm users with read-only organization permissions cannot modify data.
      Organization remains a six-page submenu with distinct navigation icons.
- [ ] Report any live-field regression to issue #580 before closing that issue.

## Closure boundary

CI approval and the pull request merge are not production acceptance.
Leave #580 open until the owner has confirmed the live-field checklist.
Do not automatically mutate production organization records during QA.
