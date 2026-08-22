# Admin UX Execution Tracker

Status: active

Updated: 2026-08-22 09:31 Asia/Bangkok

This tracker is the durable source of truth for the WordPress-like Admin UX work after the post-P5H production governance baseline.
It exists to avoid long-lived mixed-scope branches, chat context loss, and unsafe all-in-one UX changes.

## Current baseline

- Repository: `yiwssx/new-www.rcat.ac.th`
- Default branch: `master`
- Starting baseline for this tracker: `a1bdd78324d6c386ea675b1b61c334a7c00b3396`
- Baseline PR already merged: `#127 feat(admin-ux): start practical workflow hub`
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
- State: In progress
- Notes: Adds this tracker so future chats can resume from repo state.

### Step 01 — Content editor / News workflow

- Branch: `agent/admin-ux-01-content-workflow`
- PR: Pending
- State: Not started
- Notes: Start only after 00A is merged.

### Step 02 — Media Library

- Branch: `agent/admin-ux-02-media-library`
- PR: Pending
- State: Not started
- Notes: Start after step 01 is merged.

### Step 03 — Document management

- Branch: `agent/admin-ux-03-document-management`
- PR: Pending
- State: Not started
- Notes: Start after step 02 is merged.

### Step 04 — Menu management

- Branch: `agent/admin-ux-04-menu-management`
- PR: Pending
- State: Not started
- Notes: Start after step 03 is merged.

### Step 05 — Admin dashboard

- Branch: `agent/admin-ux-05-admin-dashboard`
- PR: Pending
- State: Not started
- Notes: Start after step 04 is merged.

### Step 06 — Settings / Homepage sections

- Branch: `agent/admin-ux-06-homepage-settings`
- PR: Pending
- State: Not started
- Notes: Start after step 05 is merged.

### Step 07 — User role/capability UX

- Branch: `agent/admin-ux-07-role-capability-ux`
- PR: Pending
- State: Not started
- Notes: Start after step 06 is merged.

### Step 08 — Audit / activity log

- Branch: `agent/admin-ux-08-audit-activity-log`
- PR: Pending
- State: Not started
- Notes: Start after step 07 is merged.

### Step 09 — Preview / revision / autosave

- Branch: `agent/admin-ux-09-preview-revision-autosave`
- PR: Pending
- State: Not started
- Notes: Start after step 08 is merged.

### Step 10 — Mobile admin usability

- Branch: `agent/admin-ux-10-mobile-admin-usability`
- PR: Pending
- State: Not started
- Notes: Start after step 09 is merged; mobile remains a cross-cutting acceptance condition throughout.

## Resume instruction for future chats

If context is lost or a new chat is started, read this file first and continue from the first step whose state is not `Done`.

If an in-progress PR exists, inspect that PR before creating a new branch.

## Acceptance criteria for this tracker

- The tracker records the one-branch-per-item rule.
- The tracker lists the exact branch naming convention for steps 01-10.
- The tracker identifies #127 as the already-merged workflow hub.
- The tracker makes the next step unambiguous: finish 00A, then start step 01.
