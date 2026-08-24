# Copilot Instructions

This repository is a React/Vite public website and CMS with Cloudflare Worker/D1 backend paths, Vercel admin proxy paths, and an Apps Script media/file bridge.

Current status: post-P5H production governance baseline with governed dependency maintenance. Admin UX 00-10 is complete.

P5H closed the production-governance hardening sequence. Historical M13-M21 documents remain useful as migration and stabilization evidence, but M21 is not an active or current project phase unless a newer explicit project-status document reopens it. Do not report P6 or M21 as the current phase.

## Current Source Of Truth

Use these files as current project and runtime references:

- `docs/architecture/post-p5h-current-project-state.md`
- `docs/architecture/current-runtime-ownership.md`
- `docs/deployment/runtime-deployment-guide.md`
- `docs/admin/admin-ux-execution-tracker.md`
- `AGENTS.md`
- `README.md`

Use these migration-era documents as historical evidence only:

- `docs/architecture/current-migration-status.md`
- `docs/architecture/m20-cleanup-runtime-ownership.md`
- `docs/architecture/m20-cleanup-ledger.md`
- `docs/architecture/m21-ui-ux-logic-stabilization.md`

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side proxy.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive.

## Current Feedback And UX Standards

- Admin write operations use blocking loading modals while pending, centered success modals requiring acknowledgment, centered error modals requiring acknowledgment, and no short auto-dismiss final-result success toast.
- This standard applies to Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings.
- Urgent marquee speed is normalized by pixels per second with distance-based duration. Reduced motion slows the ticker instead of disabling it.

## Reporting Rule

Status reports and future implementation plans must use this wording unless a newer explicit project-state document changes it:

```text
Current status: post-P5H production governance baseline. Admin UX 00-10 is complete. Ongoing dependency work is governed maintenance.
```

Do not use migration-era M21 wording as the current project state. Do not introduce P6 as a current phase unless an approved project-state document creates it.

## Do Not Reintroduce

- Direct frontend Apps Script user management.
- Direct frontend Apps Script structured-data reads or writes.
- Local bootstrap users.
- Local password-hash user fallback.
- Legacy Apps Script credential login.
- Production auth that depends on direct frontend Apps Script.

## Safety Rules

- Do not commit real secrets, tokens, D1 IDs, Access AUD values, or production credentials.
- Do not mutate production services unless explicitly requested.
- Keep D1 migrations append-only.
- Keep Apps Script only for media/file bridge operations.
- Prefer Cloudflare Worker and D1 for structured public/admin data.

## Sigmap

Sigmap is retained as an AI helper workflow. Use it when useful for repository-aware code navigation.

Common commands:

```bash
pnpm ai:ask
pnpm ai:validate
pnpm ai:map
```
