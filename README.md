# RCAT Public Website And CMS

React/Vite public website and CMS for Roi-Et College of Agriculture and Technology.

## Current Runtime Ownership

- Public structured reads: Cloudflare Worker and D1.
- Public analytics, site view, content view, visitor presence, and live visitor stats: Cloudflare Worker and D1.
- Admin structured reads and writes: Cloudflare Worker and D1.
- Admin user access: Cloudflare RBAC plus D1 `app_admin_users`.
- Admin session proxy: Vercel server-side admin proxy.
- Media/file bridge: Apps Script behind the Vercel proxy.
- File storage: Google Drive behind the Apps Script media/file bridge.

## Current Project Status

M20 is closed for migration/runtime ownership. M21 owns remaining UI/UX and logic stabilization.

M20 closure is limited to migration, runtime ownership, and domain cutover scope. It does not mean the UI/UX is complete, the system is defect-free, or all business workflows are final. Remaining public, admin, workflow, validation, layout, Thai wording, and user-facing error issues are tracked under M21.

The production custom domain `www.rcat.ac.th` is connected to the Vercel production deployment, the Cloudflare/Vercel redirect loop was resolved at the provider configuration layer, and the Cloudflare Worker allowed origins include the production custom domain. Apps Script is retained only for the media/file bridge and Google Drive operations. Browser-side direct Apps Script structured reads/writes and legacy Apps Script user-management paths have been removed.

## Admin Operation Feedback

Admin CMS write operations now use blocking loading modals while pending, centered success modals requiring acknowledgment, and centered error modals requiring acknowledgment. Final admin write results must not use short auto-dismiss success toasts.

The standardized feedback applies to Media, Content, Documents, Menu, Users, Calendar, Carousel, E-Service, and Settings. It was completed by:

- `7f5f95083b5df18c5c73939bf2b1e251c3880a97` `fix(admin): make media operation results explicit`
- `8aa55b3b22dd6a121fbaa799899670766f776abb` `fix(admin): standardize operation feedback`

## Public UX Updates

Urgent marquee speed is device-independent. The ticker uses distance-based animation duration, reduced-motion slows the ticker instead of disabling it, and the change did not require Worker, D1, or Apps Script updates.

- `4b8f01a2162ef8de002a8c2c46c69110f7b749e2` `fix(ui): normalize marquee speed across devices`

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
