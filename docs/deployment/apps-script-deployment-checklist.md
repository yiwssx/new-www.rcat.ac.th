# Apps Script Media Bridge Deployment Checklist

Use this checklist only when a release changes `apps-script/`, Apps Script manifest/scopes, Google Drive media/file operations, or the Apps Script side of the Vercel media/file bridge.

Current status: M20 migration/runtime/domain-cutover scope is closed; M21 stabilization is open. This checklist applies only when Apps Script media/file bridge source changes.

Apps Script is not the current structured public/admin data backend and is not the current user-management backend.

## Current Scope

Apps Script is retained for:

- media upload/update operations
- media delete operations
- Google Drive file access
- file upload/delete workflows behind the Vercel proxy

The active Apps Script source is pruned to:

- `POST ?resource=media`
- `POST ?resource=media-delete`

Structured public/admin data routes were removed from Apps Script source. Cloudflare Worker and D1 remain the source of truth for public structured reads, admin structured reads/writes, user profiles, settings, menu, content, documents, carousel, E-Service, calendar, analytics, and visitor stats.

Apps Script must not be restored as:

- frontend credential login backend
- direct frontend user-management backend
- local bootstrap user fallback
- password-hash user-account fallback

## Deployment Overview

- Vercel frontend deployment and Apps Script deployment are separate release steps.
- A Vercel deploy does not push, version, or redeploy Apps Script source.
- Changes under `apps-script/` must be pushed to Google Apps Script, saved as a new version, and assigned to the intended Web App deployment.
- The Apps Script manifest currently needs only the Google Drive scope for the active media/file bridge.
- The current production frontend should not depend on `VITE_GOOGLE_APPS_SCRIPT_URL` for admin auth or user management.
- The server-side media bridge should use server-only Apps Script bridge configuration, such as `GOOGLE_APPS_SCRIPT_URL` or `APPS_SCRIPT_WEB_APP_URL`.
- `VITE_GOOGLE_APPS_SCRIPT_URL` must not be used as server runtime configuration.
- Prefer updating the existing Web App deployment. Creating a new Web App deployment usually changes the URL and requires a coordinated server-side environment update.

## Pre-Deploy Checklist

- Confirm the current branch:

  ```powershell
  git branch --show-current
  ```

- Confirm no structured Apps Script routes remain in active source:

  ```powershell
  rg "auth-login|snapshot|public-home|public-content-list|public-document-list|public-program-list|public-search-index|content-delete|document-delete|carousel-delete|external-service-delete|event-delete|publish|visitor-stats|users-delete|users-reset|site-settings|homepage-settings" apps-script
  ```

- Confirm the Vercel proxy still maps only media resources:

  ```powershell
  rg "APPS_SCRIPT_RESOURCES|media-delete|deleteMedia" server/appsScriptProxy
  ```

- Run the media bridge contract tests before deploying Apps Script:

  ```powershell
  pnpm vitest run src/test/appsScriptCode.test.ts server/appsScriptProxy/handler.test.mjs
  ```
