# Admin UX Execution Tracker

Status: active

Updated: 2026-08-24 00:48 Asia/Bangkok

This tracker is the durable source of truth for the WordPress-like Admin UX work after the post-P5H production governance baseline.
It exists to avoid long-lived mixed-scope branches, chat context loss, and unsafe all-in-one UX changes.

## Current baseline

- Repository: `yiwssx/new-www.rcat.ac.th`
- Default branch: `master`
- Starting baseline for this tracker: `a1bdd78324d6c386ea675b1b61c334a7c00b3396`
- Baseline PR already merged: `#127 feat(admin-ux): start practical workflow hub`
- Tracker PR already merged: `#128 docs(admin-ux): add execution tracker`
- Project posture: post-P5H production governance baseline with governed Renovate dependency maintenance.

## Execution rule

Use this rule for every UX item below:

1. Sync from latest `master`.
2. Create exactly one branch for exactly one UX item.
3. Keep the branch scope narrow and reversible.
4. Open one PR for that item.
5. Wait for full CI success, including `quality`.
6. Merge into `master` only after CI passes.
7. Update this tracker with the PR number, merge commit, completion state, and any deferred follow-up.
8. Start the next item only after the previous item is merged or explicitly paused.

Do not batch multiple UX items into one implementation branch.

## Non-goals for this UX sequence

Do not change these unless the specific UX item explicitly requires it and the PR documents why:

- Worker/D1 resource identity
- D1 migrations or production data write paths
- Apps Script release path
- Vercel routing or environment variables
- Authentication/session policy
- RBAC policy semantics
- API contract shape
- Package manifests or lockfile, except governed Renovate maintenance or required generated status refresh

## Branch and PR plan

### Step 00 — Workflow hub / execution baseline

- Branch: `agent/admin-ux-practical-workflows`
- PR: `#127`
- State: Done
- Notes: Merged to `master`; adds compact Admin Dashboard UX workflow hub and practical workflow note.

### Step 00A — Durable execution tracker

- Branch: `agent/admin-ux-execution-tracker`
- PR: `#128`
- State: Done
- Notes: Merged to `master` as `79e2ac5cee4d05ebfa66531385b5cadab0e078ff`; future chats should resume from this tracker.

### Step 01 — Content editor / News workflow

- Branch: `agent/admin-ux-01-content-workflow`
- PR: `#129`
- State: Done
- Notes: Merged to `master` as `97266b50baeab9242efa4a539563b88a8ec38eec`; adds a compact Draft → Review → Publish/Schedule guide on the admin content page and improves the empty list message.

### Step 02 — Media Library

- Branch: `agent/admin-ux-02-media-library`
- PR: `#130`
- State: Done
- Notes: Merged to `master` as `79338a9c35fd4cb6ac95510ba6e3d4258f79b807`; adds a compact Upload → Label → Reuse guide without changing backend, API, Drive bridge, or upload policy.

### Step 03 — Document management

- Branch: `agent/admin-ux-03-document-management`
- PR: `#131`
- State: Done
- Notes: Merged to `master` as `e3a0d56f7597ba06cb600fcd1b2a21dfedb85751`; adds a compact Prepare → Describe → Publish/Order guide without changing document APIs, ordering logic, or public document behavior.

### Step 04 — Menu management

- Branch: `agent/admin-ux-04-menu-management`
- PR: `#132`
- State: Done
- Notes: Merged to `master` as `8bf92de161831de8c1b5401c1a5d26af3b14d88a`; adds a compact Structure → Label/Link → Order guide without changing menu APIs, ordering logic, or public navigation behavior.

### Step 05 — Admin dashboard

- Branch: `agent/admin-ux-05-admin-dashboard`
- PR: `#133`
- State: Done
- Notes: Merged to `master` as `b1a4ec95210456c055d30f81243dc0d74e9774a7`; adds a compact Overview → Shortcut → Verify guide without changing dashboard metrics, data loading, API contracts, or runtime behavior.

### Step 06 — Settings / Homepage sections

- Branch: `agent/admin-ux-06-homepage-settings`
- PR: `#134`
- State: Done
- Notes: Merged to `master` as `85b06b360dd02d9a860dc08a6b533c7311cae2a5`; adds a compact Review → Configure → Verify guide without changing settings APIs, data loading, runtime behavior, or public homepage behavior.

### Step 07 — User role/capability UX

- Branch: `agent/admin-ux-07-role-capability-ux`
- PR: `#135`
- State: Done
- Notes: Merged to `master` as `7257bacb0bdf7bbe913e1411824bb6485c599013`; adds a compact Review role → Assign scope → Verify access guide without changing RBAC policy semantics, authentication/session behavior, user APIs, or persistence behavior.

### Step 08 — Audit / activity log

- Branch: `agent/admin-ux-08-audit-activity-log`
- PR: `#136`
- State: Done
- Notes: Merged to `master` as `001d3c993f84c37201fe5fbb8faa6fbebc7508fc`; adds a compact Review → Trace → Record guide without changing backup APIs, audit data loading, runtime behavior, or persistence behavior.

### Step 09 — Preview / revision / autosave

- Branch: `agent/admin-ux-09-preview-revision-autosave`
- PR: `#137`
- State: Done
- Notes: Merged to `master` as `2582921bb7717463868ba9dfc666fd6ca9427654`; adds a compact Preview → Revision → Autosave guide without changing content persistence, preview behavior, revision behavior, autosave storage, or public content behavior.

### Step 10 — Mobile admin usability

- Branch: `agent/admin-ux-10-mobile-admin-usability`
- PR: `#138`
- State: Done
- Notes: Merged to `master` as `1b97bc89559bc8af2254981c50abdd76f44c4d80`; adds a compact Touch → Navigate → Verify guide on the admin dashboard without changing shell drawer behavior, routes, API contracts, runtime behavior, persistence behavior, package manifests, or lockfile.

## Resume instruction for future chats

If context is lost or a new chat is started, read this file first and continue from the first step whose state is not `Done`.

If an in-progress PR exists, inspect that PR before creating a new branch.

## Acceptance criteria for this tracker

- The tracker records the one-branch-per-item rule.
- The tracker lists the exact branch naming convention for steps 01-10.
- The tracker identifies #127 as the already-merged workflow hub.
- The tracker makes the next step unambiguous: finish the in-progress step before starting the next one.
