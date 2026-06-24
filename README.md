# RCAT Public Website And CMS

React/Vite public website and CMS for Roi-Et College of Agriculture and Technology.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side admin proxy.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive behind the Apps Script media/file bridge.

## Stack

- React + TypeScript strict mode
- Vite
- Tailwind CSS v4
- MUI
- TanStack Router
- TanStack Query and Table
- Vercel frontend and server-side proxy routes
- Cloudflare Worker and D1
- Apps Script media/file bridge
- Google Drive file storage

## Project Settings

Project settings live in `src/config/project-settings.json`.

Use that file for checked-in non-secret defaults such as site name, canonical public site URL, logo path, theme colors, query behavior, storage keys, role permissions, and resource names.

Do not store secrets, tokens, production credentials, Access AUD values, D1 IDs, or private deployment URLs in project settings.

## Commands

```bash
pnpm install
pnpm dev
pnpm test:unit
pnpm test:integration
pnpm test:functional:install
pnpm test:functional
pnpm test:all
pnpm build
```
