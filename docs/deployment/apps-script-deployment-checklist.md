# Apps Script Media Bridge Deployment Checklist

Use this checklist only when a release changes `apps-script/`, Apps Script manifest/scopes, Google Drive media/file operations, or the Apps Script side of the Vercel media/file bridge.

Apps Script is not the current user-management backend.

## Current Scope

Apps Script is retained for:

- media/file bridge operations
- Google Drive file access
- file upload/delete/list workflows behind the Vercel proxy

Apps Script must not be restored as:

- frontend credential login backend
- direct frontend user-management backend
- local bootstrap user fallback
- password-hash user-account fallback

## Deployment Overview

- Vercel frontend deployment and Apps Script deployment are separate release steps.
- A Vercel deploy does not push, version, or redeploy Apps Script source.
- Changes under `apps-script/` must be pushed to Google Apps Script, saved as a new version, and assigned to the intended Web App deployment.
- The current production frontend should not depend on `VITE_GOOGLE_APPS_SCRIPT_URL` for admin auth or user management.
- The server-side media bridge should use server-only Apps Script bridge configuration, such as `GOOGLE_APPS_SCRIPT_URL` or `APPS_SCRIPT_WEB_APP_URL`.
- Prefer updating the existing Web App deployment. Creating a new Web App deployment usually changes the URL and requires a coordinated server-side environment update.

## Pre-Deploy Checklist

- Confirm the current branch:

  ```powershell
  git branch --show-current
  ```
