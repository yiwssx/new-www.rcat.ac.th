# Admin UX Practical Workflows

Status: started on branch `agent/admin-ux-practical-workflows`.

Updated: 2026-08-22.

This document records the first practical UX pass after the post-P5H production governance baseline. The intent is to keep runtime and backend ownership stable while improving the admin experience toward a WordPress-like CMS through field-tested workflows.

## Current Project State

- Current baseline: post-P5H production governance baseline with governed Renovate dependency maintenance.
- Runtime/source boundary: do not change Worker/D1 identity, Apps Script release path, Vercel routing/env, migrations, or auth/session policy as part of this UX pass.
- UX method: expose the 1-10 workflow map in Admin Dashboard first, then improve each workflow from real production feedback.

## Implemented in this branch

- Added an Admin Dashboard workflow hub named `แผนปรับ UX จากการใช้งานจริง`.
- Added ten workflow cards matching the practical UX order:
  1. Content editor / News workflow
  2. Media Library
  3. Document management
  4. Menu management
  5. Admin dashboard
  6. Settings / Homepage sections
  7. User role/capability UX
  8. Audit / activity log
  9. Preview / revision / autosave
  10. Mobile admin usability
- Added direct links from each workflow card to the most relevant existing admin page.
- Kept mobile admin usability as a cross-cutting workflow condition instead of treating it only as the final step.

## Deferred / pending field-tested work

These items are intentionally not expanded in this first branch because they need production feedback before changing deeper UX behavior:

1. Content editor / News workflow
   - Review real editor pain points before changing fields, preview behavior, publish flow, or autosave behavior.

2. Media Library
   - Observe upload/search/select behavior from real content creation before changing media selection or metadata flow.

3. Document management
   - Observe how staff distinguish public documents, media files, and downloadable announcements before changing document UI.

4. Menu management
   - Keep current governed menu behavior stable. Do not add drag-and-drop until ordering and hierarchy pain points are confirmed.

5. Admin dashboard
   - This branch starts the dashboard as a workflow control center. Further metrics should be added only if they answer real admin questions.

6. Settings / Homepage sections
   - Defer homepage-section UX changes until content/media/document flows are observed.

7. User role/capability UX
   - Defer capability UI changes unless staff report confusion or access-denied cases.

8. Audit / activity log
   - Defer visible audit UX until there is a real review/audit workflow or incident requirement.

9. Preview / revision / autosave
   - Defer deeper editor changes until real draft loss, revision conflict, or preview confusion is observed.

10. Mobile admin usability
    - Treat as an acceptance condition for every workflow: content, media, documents, menus, and settings should remain usable on staff mobile devices.

## Acceptance criteria for this branch

- Dashboard renders the 1-10 workflow map without requiring new backend data.
- Existing dashboard publish queue behavior remains unchanged.
- No runtime/API/database/deployment configuration is changed.
- Existing CI gates must pass before merge.
