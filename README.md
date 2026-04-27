# RCAT CMS Template

React CMS frontend template for an education website. The app is designed for a zero-cost stack: Vercel for frontend hosting and Google Apps Script plus Google Sheets, Drive, and Docs as the backend layer.

## Stack

- React + TypeScript strict mode
- Vite
- Tailwind CSS v4
- MUI (for complex data UI and base components)
- TanStack Router
- Redux Toolkit + React Redux
- TanStack Query and Table
- JWT-ready auth scaffolding with bcryptjs hashing
- Google Apps Script service adapter

## Project Settings

Project settings live in `src/config/project-settings.json`. Update site name, logo path,
theme colors, query behavior, storage keys, bootstrap users, role permissions, and Apps Script
resource names there instead of hard-coding them in components or services. The Apps Script URL
can be supplied through `VITE_GOOGLE_APPS_SCRIPT_URL` or `api.googleAppsScriptUrl` in that JSON file.

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

## Local URLs

- Public website: `http://127.0.0.1:5173/`
- Admin CMS: `http://127.0.0.1:5173/admin`
- Login: `http://127.0.0.1:5173/login`

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
VITE_CMS_SITE_NAME="RCAT CMS"
VITE_GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/..."
VITE_PUBLIC_SITE_URL="https://preview-placeholder.example.invalid"
```

When `VITE_GOOGLE_APPS_SCRIPT_URL` is empty, CMS data requests fail with a visible configuration message.
The frontend no longer serves bundled CMS records, so real environment testing always uses the Apps Script
backend.

## Google Apps Script Backend

Apps Script backend code and setup instructions are in `apps-script/`.

The backend uses a Google Sheet for CMS records and exposes a web app endpoint for the React frontend:

- `GET ?resource=snapshot`
- `GET ?resource=health`
- `GET ?resource=menu`
- `POST ?resource=content`
- `POST ?resource=content-delete`
- `POST ?resource=media`
- `POST ?resource=media-delete`
- `POST ?resource=publish`
- `POST ?resource=menu`
- `POST ?resource=event`
- `POST ?resource=event-delete`
