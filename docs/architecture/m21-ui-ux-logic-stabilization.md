# M21 UI/UX Logic Stabilization

Status: open.

M20 is closed for migration/runtime ownership. M21 owns remaining UI/UX and logic stabilization.

M21 begins after the M20 migration/runtime/domain-cutover scope closed. M20 closure does not mean UI/UX completion, defect-free production behavior, or final acceptance of every public and admin workflow.

## Purpose

Stabilize the public website and admin CMS user experience after the M20 runtime ownership cutover. M21 focuses on user-facing behavior, business logic, workflow quality, validation, responsive layout, accessibility basics, Thai wording clarity, and user-facing error messages.

## Scope

- Public homepage display logic.
- Navigation and menu behavior.
- News and content detail flow.
- Documents display and download UX.
- Carousel and marquee behavior.
- Calendar display.
- External services display.
- Media library UX.
- Admin loading, error, and empty states.
- Admin validation behavior.
- Save, publish, and delete workflows.
- Responsive and mobile layout.
- Accessibility basics.
- Thai wording clarity.
- User-facing error messages.

## Non-Scope

- Cloudflare Worker + D1 migration.
- Apps Script structured data restoration.
- D1 schema migration unless a UI/UX issue proves a data model defect.
- Production cutover rollback unless a critical runtime failure appears.
- Secret or environment restructuring unless a UI/UX issue proves configuration is wrong.
- Moving media, attachments, or binary file storage away from the Apps Script / Google Drive bridge.
- Restoring direct browser-side Apps Script structured reads or writes.

## Entry Criteria

- M20 migration/runtime/domain-cutover scope is closed.
- `www.rcat.ac.th` is connected to the Vercel production deployment.
- Cloudflare Worker allowed origins include the production custom domain.
- Cloudflare Worker and D1 own structured public and admin data.
- Apps Script remains scoped to the media/file bridge.
- No D1 migration blocker, Apps Script structured-data blocker, or runtime ownership blocker remains from M20.
- Remaining issues are classified as UI/UX, business logic, workflow, usability, validation, layout, content-presentation, Thai wording, or user-facing error issues.

## Exit Criteria

- Public homepage sections render the intended content with stable empty and loading behavior.
- Navigation and menus work consistently on desktop and mobile.
- News/content detail paths, document downloads, calendar entries, external services, carousel, marquee, and media library flows are verified.
- Admin loading, error, empty, validation, save, publish, and delete states are explicit and understandable.
- Responsive layout passes representative desktop, tablet, and mobile checks.
- Accessibility basics are reviewed for keyboard access, focus visibility, labels, heading structure, alt text, and contrast.
- Thai wording and user-facing errors are clear enough for public and admin users.
- Known remaining issues are either fixed or recorded as follow-up work outside M21.

## Risk Areas

- Homepage composition may hide valid D1 content when optional fields are empty or partially populated.
- Menu hierarchy and mobile navigation can diverge from desktop behavior.
- Content detail links may fail when slugs, IDs, publish state, or category filters are inconsistent.
- Document download controls may expose confusing states for missing files, private Drive links, or unavailable media bridge responses.
- Carousel and marquee timing can become unreadable on small screens or reduced-motion settings.
- Admin write workflows can leave users uncertain if validation, save, publish, delete, or media operations partially fail.
- Thai labels and error messages can be technically accurate but unclear to real users.

## Verification Checklist

- [ ] Public homepage display logic.
- [ ] Navigation/menu behavior.
- [ ] News/content detail flow.
- [ ] Documents display and download UX.
- [ ] Carousel/marquee behavior.
- [ ] Calendar display.
- [ ] External services display.
- [ ] Media library UX.
- [ ] Admin loading/error/empty states.
- [ ] Admin validation behavior.
- [ ] Save/publish/delete workflows.
- [ ] Responsive/mobile layout.
- [ ] Accessibility basics.
- [ ] Thai wording clarity.
- [ ] User-facing error messages.
