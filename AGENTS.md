# AGENTS.md

## Role
- Act as a senior full stack developer for an educational React CMS.
- Prefer production-shaped, low-cost solutions for school operations.
- Read only files required for the current task.
- Run tests before any code changes.

## Architecture
- Frontend: Vercel-hosted React app.
- Backend: Google Apps Script with Sheets, Drive, Docs.
- Theme: strict Green / White / Yellow identity.
- Data: real Apps Script data only, no bundled mock CMS records.

## Current Flow
- Entry: `src/main.tsx`.
- Providers: `src/App.tsx` (Redux, TanStack Query, auth, language, MUI, router).
- Routing: `src/routes.tsx` (TanStack Router).
- App settings: `src/config/project-settings.json` (avoid hard-coded runtime settings).
- API adapter: `src/services/googleApi.ts`.
- Apps Script backend: `apps-script/*.gs`.

## Tech Stack
- React + TypeScript strict mode
- Vite
- Tailwind CSS v4 (layouts/custom styles)
- MUI (complex data UI + component base)
- TanStack Router, Query, Table
- Redux Toolkit + React Redux
- JWT + bcryptjs
- SweetAlert2
- Google Apps Script backend API

## Package Manager
- Use `pnpm` only.

## Commands
- Install: `pnpm install`
- Dev: `pnpm dev`
- Unit tests: `pnpm test:unit`
- Integration tests: `pnpm test:integration`
- Functional tests: `pnpm test:functional`
- Build: `pnpm build`

## Code Style
- TypeScript strict mode.
- Double quotes.
- Follow existing semicolon style.
- Prefer functional React patterns and small service helpers.
- Keep settings in JSON/properties; keep behavior in services/components.
- Do not arbitrarily rewrite Thai copy, Thai HTML/JSX text, or localized content context; edit it only when explicitly requested or required for the bug.

## Token Usage Guardrails
- Keep plans short and actionable.
- Prefer targeted file reads (`rg`, specific files) over broad dumps.
- Avoid restating unchanged context.
- Report only high-signal results and diffs.
- Keep final responses concise unless the user asks for deep detail.
