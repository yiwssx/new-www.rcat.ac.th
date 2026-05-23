# Stabilization Release Report

Date: 2026-05-23

## Executive Summary

This was a stabilization cycle, not a feature expansion cycle. The project had grown into a combined public website, CMS admin, Google Apps Script backend, spreadsheet storage layer, visitor tracking system, cache layer, and mixed MUI/Tailwind frontend. The goal of this cycle was to reduce visible UX defects, reduce dependency risk, document deployment process, and control project complexity before adding more features.

The release should be treated as ready only after the quality gate, production smoke checks, and Apps Script deployment verification pass. New feature work should remain paused until those checks are complete.

## Changes Completed

### A. Public UX Fixes

- Urgent marquee now uses stable keyframes, starts immediately, loops continuously, and avoids an initial blank delay.
- Urgent marquee no longer stops completely on machines with `prefers-reduced-motion: reduce`; it keeps moving with a slower duration.
- Urgent marquee keeps hover pause, the duplicated ticker structure, and the duplicate group marked `aria-hidden="true"`.
- `VisitorStatsCard` mobile layout was fixed so the title/subtitle and updated chip do not overlap on narrow screens.
- `VisitorStatsCard` keeps the Thai subtitle readable, keeps the total views card prominent, and keeps all secondary stats visible.
- Floating Messenger overlap was checked by adding/using safe bottom spacing where the homepage can show the visitor stats card below the fold.

### B. Site View And Visitor Stats

- Site-view tracking was added for public pages.
- The browser creates an anonymous visitor id stored in local storage.
- Public routes are tracked; `/login`, `/admin`, and `/admin/*` are excluded.
- Duplicate page views are throttled to avoid StrictMode double effects and repeated refresh inflation.
- Tracking is fire-and-forget and must not block public page rendering.
- `site-view` does not invalidate public snapshots on every page view.
- Visitor stats are counted automatically from real public site views.
- Admin visitor numbers are read-only except for the enable/disable setting.

### C. Backend And Apps Script Reliability

- Public API cache diagnostics were added behind `debugPerformance=1`.
- Debug diagnostics report cache hit/miss, payload size, write status, and cache write skip reasons without exposing private data.
- Apps Script public cache wrappers now cover key public endpoints such as `public-home`, public content lists, public document list, program list, search index, and content detail.
- A complete Apps Script deployment checklist was added at [`docs/deployment/apps-script-deployment-checklist.md`](../deployment/apps-script-deployment-checklist.md).
- The deployment checklist documents stale deployment detection and rollback to a previous Apps Script version.

### D. Developer Workflow And Quality Gates

- Vite environment variables are typed through `src/vite-env.d.ts`.
- Environment variable documentation clarifies that `VITE_` values are public and that `VITE_GOOGLE_APPS_SCRIPT_URL` is production-critical.
- Husky and `lint-staged` provide lightweight staged-file checks on commit.
- `vite-plugin-checker` provides development-time TypeScript diagnostics during `pnpm dev`.
- `pnpm quality` remains the final release gate because it runs formatting, linting, unit tests, integration tests, and build.

### E. Dependency And Styling Governance

- FontAwesome was removed after a zero-usage audit.
- MUI Icons were kept because they are actively used across public and admin UI.
- MUI icon imports remain per-icon path imports that Vite/Rollup can tree-shake.
- MUI/Tailwind usage boundaries were documented in [`docs/design/mui-tailwind-boundary.md`](../design/mui-tailwind-boundary.md).
- The project keeps MUI for forms, dialogs, tables, menus, admin CMS UI, stateful controls, and existing icon surfaces.
- Tailwind/RCAT classes remain appropriate for page shells, broad spacing, containers, simple surfaces, and static layout.

### F. Architecture Stabilization

- The project simplification audit was added at [`docs/architecture/project-simplification-audit-2026-05-23.md`](../architecture/project-simplification-audit-2026-05-23.md).
- The audit includes a feature inventory across public website, CMS admin, Apps Script resources, sheets/storage, cache behavior, and test coverage.
- God-project risks were documented: root layout breadth, Apps Script route breadth, `Storage.gs` responsibility breadth, broad shared types, broad public-home snapshot, cache invalidation coupling, and feature changes touching too many files.
- Future feature guardrails were documented: no new sheet without a feature RFC, no new global provider without justification, no high-frequency cache invalidation, no new dependency without audit, no new styling system, and tests for public/admin/backend changes.

## Verification Checklist

### Public

- [ ] Homepage loads in production.
- [ ] Urgent marquee moves on normal motion settings.
- [ ] Urgent marquee still moves slowly with reduced motion enabled.
- [ ] `VisitorStatsCard` is readable on mobile.
- [ ] Floating Messenger button does not cover important visitor stats content.
- [ ] Carousel works.
- [ ] IntroGate works when enabled and stays hidden when disabled/dismissed.
- [ ] News, announcements, and detail pages work.
- [ ] `site-view` POST fires on public routes.
- [ ] `site-view` does not fire on `/login`, `/admin`, or `/admin/*`.

### Admin

- [ ] Login works.
- [ ] Admin dashboard works.
- [ ] Settings page works.
- [ ] Visitor stats values are read-only except enable/disable.
- [ ] Content save works.
- [ ] Media page works.
- [ ] Document page works if the public documents module is present in the release.

### Backend

- [ ] Apps Script deployment version is current.
- [ ] `?resource=public-home` works.
- [ ] `?resource=snapshot` works.
- [ ] `debugPerformance=1` works on cacheable public endpoints where expected.
- [ ] `POST ?resource=site-view` works.
- [ ] `?resource=public-document-list` works if public documents are present in the release.

## Commands

Run these before declaring the stabilization release ready:

```powershell
pnpm format:check
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm build
pnpm quality
```

`pnpm quality` is the final gate. It must pass before GO.

## Deployment Notes

Use the Apps Script deployment checklist:

- [`docs/deployment/apps-script-deployment-checklist.md`](../deployment/apps-script-deployment-checklist.md)

Deployment reminders:

- Vercel deploy does not deploy Apps Script.
- Apps Script changes require push, version, and deploy.
- Use the same Web App deployment unless intentionally changing the URL.
- Production frontend must point to the current Apps Script Web App URL through `VITE_GOOGLE_APPS_SCRIPT_URL`.

## Risk Assessment

| Area                                  | Risk        | Notes                                                                 |
| ------------------------------------- | ----------- | --------------------------------------------------------------------- |
| Docs/tooling cleanup                  | Low         | Mostly documentation and local workflow guardrails.                   |
| Public UX fixes                       | Medium      | Visible homepage surfaces need real browser and mobile verification.  |
| Site-view tracking and public API     | Medium-high | Public endpoints and Apps Script deployment must be verified.         |
| Public cache diagnostics              | Medium      | Diagnostics must remain debug-only and not expose private data.       |
| MUI/Tailwind/dependency cleanup       | Medium      | Boundaries are documented; avoid broad UI migration during stabilize. |
| Public documents backend/module paths | Medium      | Confirm sheet/header setup and published-only public responses.       |

Mitigations:

- Unit and integration tests cover public pages, content detail, site-view tracking, Apps Script routes, storage helpers, public cache helpers, and public documents.
- Site-view tracking is non-blocking and fire-and-forget.
- High-frequency public tracking does not invalidate public snapshots.
- Apps Script deployment checklist covers stale deployment detection and rollback.
- Public cache diagnostics require `debugPerformance=1`.

## Known Remaining Issues And Follow-Ups

- Verify the urgent marquee fix on the computers that previously did not animate.
- Verify the urgent marquee in both normal and reduced-motion browser settings.
- Verify `VisitorStatsCard` mobile layout on real phones with Messenger enabled.
- Continue public documents full archive route only after stabilization.
- Review the feature inventory and mark features as core, support, optional, or deferred.
- Avoid adding new features until production smoke passes.
- Keep watching the repo-wide formatting baseline; the release gate requires `pnpm quality` to pass before GO.

## Go / No-Go Decision

### GO If

- `pnpm quality` passes.
- Production smoke passes.
- Apps Script deployment is verified if backend files changed.
- No public route blockers remain.
- No admin login or admin save blockers remain.

### NO-GO If

- Apps Script deployment is stale.
- Auth/login fails.
- Homepage public data fails.
- Site-view tracking causes blocking behavior or visible errors.
- Visible mobile homepage defects remain.
- `pnpm quality` fails.

## Next Recommended Tasks

1. Verify urgent marquee fix in normal and reduced-motion machines.
2. Verify `VisitorStatsCard` mobile layout with Messenger enabled.
3. Use the Apps Script deployment checklist for backend-affecting releases.
4. Review the feature inventory and mark features core/support/optional/deferred.
5. Continue the public documents module only after stabilization.

## Release Log Template

Copy this block into the release ticket or deployment notes:

```text
Date:
Git commit SHA:
Frontend deployment URL:
Apps Script version number:
Apps Script deployment ID:
Changed areas:
Verification result:
Known risks:
Rollback notes:
```
