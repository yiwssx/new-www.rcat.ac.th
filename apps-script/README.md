# Apps Script Media/File Bridge

Updated: 2026-09-26.

This Apps Script project is retained only for media/file bridge operations and Google Drive file access. Cloudflare Worker + D1 own structured public/admin CMS data and CMS identity/session state.

## Current Scope

Apps Script is used for media metadata, delete operations, resumable upload operations, and Google Drive file access behind the Vercel proxy. Active authenticated `POST` resources are:

- `media`
- `media-delete`
- `media-upload-start`
- `media-upload-chunk`
- `media-upload-status`

The browser must not receive bridge tokens or call the private Apps Script endpoint directly.

## Production Release Governance

A Vercel deploy does not deploy Apps Script. Production Apps Script operations are GitHub Actions only.

Protected GitHub Environment `production` must contain:

- `CLASPRC_JSON`: OAuth credential material from an authorized `clasp login`;
- `CLASP_JSON`: the production `.clasp.json` mapping for the existing project;
- `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID`: the existing production Web App deployment ID.

The canonical workflow is **Deploy / Apps Script**. It pins `@google/clasp@3.3.0`, runs only from `master`, and exposes two explicit operations:

### Read-only preflight

Select `preflight` in **Deploy / Apps Script** before a release or after credential rotation. It verifies contract tests, credential/project configuration, the exact existing deployment, its current immutable version, and the production bridge health endpoint.

The preflight does not push source, create a version, update a deployment, or delete a deployment.

### Production release

Select `release` in **Deploy / Apps Script** only when Apps Script source or manifest behavior must change. The release requires the exact confirmation phrase `DEPLOY_EXISTING_APPS_SCRIPT_WEB_APP` and then:

1. verifies media bridge contracts;
2. captures the existing production deployment version as the rollback target;
3. pushes reviewed `master` source to Apps Script HEAD;
4. creates a new immutable Apps Script version;
5. updates only `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID` to that version;
6. verifies the same deployment now references the new version;
7. runs a read-only production health smoke.

The release must never create a replacement production Web App deployment or change its URL.

### Rollback

Run **Apps Script Production Rollback** with a known previous immutable version and the exact confirmation phrase `ROLLBACK_EXISTING_APPS_SCRIPT_WEB_APP`.

Rollback does not push source and does not create a version. It repoints the same existing deployment to the requested immutable version, verifies that version, and runs the production health smoke.

## Local Development

Local `clasp` usage is development-only. `pnpm gas:push:local` performs a non-force push against the developer's local `.clasp.json`; it is not an approved production release path.

Production version creation, deployment update, and rollback must occur through the protected GitHub Actions workflows so commit SHA, Environment approval, immutable version, and rollback target remain auditable.

Detailed checklist: `docs/deployment/apps-script-deployment-checklist.md`.

## Required Server-Side Bridge Configuration

Configure these outside the repository:

- `GOOGLE_APPS_SCRIPT_URL` or `APPS_SCRIPT_WEB_APP_URL`
- `APPS_SCRIPT_BRIDGE_TOKEN`

Do not expose bridge URLs or tokens through `VITE_` variables.

## Safety Rules

- Do not commit `CLASPRC_JSON`, `CLASP_JSON`, deployment IDs, bridge tokens, spreadsheet IDs, or private Drive URLs.
- Do not reintroduce Apps Script user-management or structured CMS routes as active runtime ownership.
- Do not assume Vercel deployment updates Apps Script.
- Do not create a replacement production Web App deployment when the existing deployment can be updated in place.
- Keep bridge logs free of upload keys, bearer/OAuth tokens, private Google API URLs, and other credentials.
