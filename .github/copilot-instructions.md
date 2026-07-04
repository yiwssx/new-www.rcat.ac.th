# Copilot Instructions

This repository is a React/Vite public website and CMS with Cloudflare Worker/D1 backend paths, Vercel admin proxy paths, and an Apps Script media/file bridge.

Current status: cleanup completed; preview field verification in progress. M20 production cutover remains gated. Do not mark M20 closed or claim production approval.

## Current Source Of Truth

Use these files as current runtime references:

- `docs/architecture/m20-cleanup-runtime-ownership.md`
- `docs/architecture/m20-cleanup-ledger.md`
- `AGENTS.md`

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
