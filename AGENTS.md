# Agent Notes

This project is a React/Vite public website and CMS for Roi-Et College of Agriculture and Technology.

## Current Project Status

Current status: post-P5H production governance baseline with an active Production Observability guard and ongoing governed dependency maintenance.

Use `docs/architecture/post-p5h-current-project-state.md` as the current project-state note.

P5H closed the current production-hardening sequence. The active baseline includes Cloudflare Worker/D1 runtime ownership, governed Apps Script media bridge release, CMS link integrity validation, request correlation governance, D1 credential-boundary hardening, protected production audit/release procedures, the Production Observability D1 usage guard, and the current post-P5H maintenance posture.

The Production Observability guard completed its activation gate on 2026-08-29. Treat it as completed requested work under the post-P5H baseline, not as a reopened P6 phase. Use `docs/operations/p6a-production-observability.md` for closure evidence and operational constraints.

Admin UX 00-10 is complete. Use `docs/admin/admin-ux-execution-tracker.md` for the completed Admin UX sequence. Do not treat that sequence as a reopened M21 phase.

M20/M21 documents are retained as historical planning, migration, and stabilization records only. They must not be treated as the current active project phase unless a newer explicit project-status document says so.

Governed Renovate dependency maintenance is expected to continue after P5H. It is not considered feature, runtime, or stabilization-scope expansion when it follows the repository dependency policy and passes the required CI/governance gates.

## Status Reporting Rule

When reporting current project status, use:

```text
post-P5H production governance baseline + Production Observability guard active + governed dependency maintenance + Admin UX 00-10 completed
```

Do not report P6, M20, or M21 as the current active phase unless a newer explicit project-status document reopens one of them.

For future work, report the new branch and PR scope directly instead of framing it as P6 or M21.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side admin proxy.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive behind the Apps Script media/file bridge.

Do not restore browser-side direct Apps Script structured reads/writes. Apps Script is retained only for media/file bridge and Google Drive operations.

## Admin Operation Feedback Standard

Admin write operations use:

- blocking loading modal while pending
- centered success modal requiring acknowledgment
- centered error modal requiring acknowledgment
- no short auto-dismiss toast for final admin write results

The standard applies to Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings.

## Keep

- Cloudflare Worker and D1 runtime paths.
- Vercel admin proxy paths.
- Apps Script media/file bridge.
- Google Drive file storage bridge.
- D1 migration history.
- M13-M21 milestone records as historical evidence.
- P5H production governance baseline documents.
- Production Observability D1 usage guard and its read-only analytics credential boundary.
- Sigmap AI helper workflow.
- Governed Renovate dependency maintenance under the repository dependency policy.

## Do Not Restore

- Legacy Apps Script user-management backend.
- Direct frontend Apps Script user CRUD.
- Local bootstrap user fallback.
- Local password-hash user-account fallback.
- Legacy Apps Script credential login path.
- Browser-side Apps Script structured-data reads or writes.

## Safety Rules

- Do not commit real secrets, tokens, D1 IDs, Access AUD values, private credentials, or production-only identifiers.
- Do not mutate production Cloudflare, Vercel, Apps Script, Google Drive, D1, or DNS unless explicitly requested.
- Keep D1 migrations append-only.
- Keep Apps Script scoped to media/file bridge operations.
- Prefer small, scoped commits.

## React Performance Skill

For React frontend work, use the installed
`vercel-react-best-practices` skill as a review and implementation guide.

Apply the rules selectively to this React/Vite application:

- prioritize eliminating request waterfalls
- preserve React Query cache and invalidation semantics
- reduce unnecessary re-renders
- avoid unnecessary bundle growth
- lazy-load heavy routes or components when measurable value exists
- preserve accessibility and existing user-visible behavior
- prefer evidence from profiling, bundle analysis, or tests over speculative optimization

Do not apply Next.js-only rules to this Vite application.

Do not perform broad performance refactors during authentication or security
tasks unless the affected React code is directly in scope.

Security, correctness, authorization, session integrity, and data consistency
take priority over performance optimization.

## Sigmap Workflow

Use sigmap for repository-aware AI assistance when available.

Common commands:

```bash
pnpm ai:ask
pnpm ai:validate
pnpm ai:map
```
