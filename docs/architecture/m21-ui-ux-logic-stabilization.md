# M21 UI/UX Logic Stabilization

Status: historical / superseded.

Updated: 2026-08-24.

This document is retained as historical evidence for the M20/M21-era UI/UX and logic stabilization pass. It must not be used as the current project status.

Current project status is defined by `docs/architecture/post-p5h-current-project-state.md`:

- post-P5H production governance baseline
- governed Renovate dependency maintenance
- completed Admin UX 00-10 sequence

If this document conflicts with current runtime, deployment, security, governance, toolchain, dependency, or Admin UX tracker documents, the current documents take precedence.

## Historical Interpretation

M21 originally began after the M20 migration/runtime/domain-cutover scope closed. At that time, M21 owned remaining UI/UX and logic stabilization.

That stabilization narrative is now historical. Do not report M21 as open, active, or next unless a newer explicit project-status document reopens it.

## Historical Purpose

Stabilize the public website and admin CMS user experience after the M20 runtime ownership cutover. M21 focused on user-facing behavior, business logic, workflow quality, validation, responsive layout, accessibility basics, Thai wording clarity, and user-facing error messages.

## Historical Scope

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

## Historical Non-Scope

- Cloudflare Worker + D1 migration.
- Apps Script structured data restoration.
- D1 schema migration unless a UI/UX issue proves a data model defect.
- Production cutover rollback unless a critical runtime failure appears.
- Secret or environment restructuring unless a UI/UX issue proves configuration is wrong.
- Moving media, attachments, or binary file storage away from the Apps Script / Google Drive bridge.
- Restoring direct browser-side Apps Script structured reads or writes.

## Reporting Rule

Use this phrasing for current status reports:

```text
post-P5H production governance baseline + governed dependency maintenance + Admin UX 00-10 completed
```

Do not use this historical M21 document to claim that a UI/UX stabilization phase is still open.
