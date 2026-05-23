# Apps Script Deployment Checklist

Use this checklist whenever a release changes `apps-script/*.gs`, Apps Script manifest/scopes, public API resources, CMS write resources, sheet/storage behavior, cache wrappers, site-view tracking, visitor stats, or public documents backend behavior.

Related stabilization release report: [`docs/releases/stabilization-release-2026-05-23.md`](../releases/stabilization-release-2026-05-23.md).

## Deployment Overview

- The frontend/Vercel deployment and the Google Apps Script backend deployment are separate release steps.
- A Vercel deploy does not push, version, or redeploy Apps Script source.
- Changes under `apps-script/` must be pushed to Google Apps Script, saved as a new version, and assigned to the existing Web App deployment.
- The production frontend must use the correct Apps Script Web App URL through `VITE_GOOGLE_APPS_SCRIPT_URL`.
- Prefer updating the existing Web App deployment. Creating a new Web App deployment usually changes the URL and requires a coordinated frontend environment update.

## Pre-Deploy Checklist

- Confirm the current branch:

  ```powershell
  git branch --show-current
  ```

- Pull the latest production branch before release:

  ```powershell
  git pull --ff-only
  ```

- If `pnpm-lock.yaml` changed, install with the lockfile:

  ```powershell
  pnpm install
  ```

- Run the full quality gate:

  ```powershell
  pnpm quality
  ```

- Confirm there are no unintended local changes:

  ```powershell
  git status --short
  ```

- Confirm whether Apps Script files changed:

  ```powershell
  git diff --name-only HEAD -- apps-script
  ```

- Confirm Vercel has `VITE_GOOGLE_APPS_SCRIPT_URL` configured for production.
- Confirm the URL uses the intended deployed Apps Script Web App endpoint, for example:

  ```text
  https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
  ```

- Confirm the deploying Google account has access to:
  - the Apps Script project
  - the linked spreadsheet
  - the configured Drive and Docs folders
  - the existing Web App deployment

## Command-Line Deployment

Use the package scripts first. They run `clasp` from the `apps-script` directory.

1. Push local Apps Script source:

   ```powershell
   pnpm gas:push
   ```

2. Create a new Apps Script version:

   ```powershell
   pnpm gas:version
   ```

   Note the version number printed by `clasp`.

3. List existing deployments and find the production Web App deployment ID:

   ```powershell
   pnpm gas:deployments
   ```

4. Deploy the new version to the existing Web App deployment:

   ```powershell
   cd apps-script
   pnpm dlx @google/clasp deploy --deploymentId <WEB_APP_DEPLOYMENT_ID> --versionNumber <NEW_VERSION_NUMBER> --description "<description>"
   ```

5. Return to the repository root:

   ```powershell
   cd ..
   ```

## Manual `clasp` Commands

If the package scripts are unavailable, run the equivalent commands directly:

```powershell
cd apps-script
pnpm dlx @google/clasp push --force
pnpm dlx @google/clasp version "release description"
pnpm dlx @google/clasp deployments
pnpm dlx @google/clasp deploy --deploymentId <WEB_APP_DEPLOYMENT_ID> --versionNumber <NEW_VERSION_NUMBER> --description "<description>"
cd ..
```

If authentication has expired:

```powershell
pnpm gas:login
```

## Apps Script UI Fallback

Use this path when `clasp deploy` is unavailable or the release needs manual confirmation in the Apps Script UI.

1. Open the Apps Script project for this repository.
2. Confirm the editor shows the pushed source changes.
3. Select **Deploy**.
4. Select **Manage deployments**.
5. Edit the existing Web App deployment.
6. Select the latest version created for this release.
7. Deploy.
8. Confirm the Web App URL remains the same.
9. If the URL changes intentionally, update `VITE_GOOGLE_APPS_SCRIPT_URL` in Vercel production settings and redeploy the frontend.

## Production Verification Checklist

Always verify production after deploying Apps Script.

1. Open the production website.
2. Open DevTools Network and filter for `script.google.com`.
3. Confirm public requests use the expected Apps Script Web App URL from `VITE_GOOGLE_APPS_SCRIPT_URL`.
4. Check the public home endpoint:

   ```text
   <WEB_APP_URL>?resource=public-home
   ```

5. If auth or user changes were deployed, sign in through `/login` and verify admin access.
6. If CMS write resources changed, perform one safe admin save operation and confirm the row updates in the expected sheet.
7. If site-view tracking changed, open a public route and confirm a non-blocking `POST` with `resource=site-view`.
8. If public API cache diagnostics changed, append `debugPerformance=1` to a cacheable public endpoint and confirm the response includes `debugPerformance`.
9. If public documents changed, verify:

   ```text
   <WEB_APP_URL>?resource=public-document-list
   ```

   Confirm published documents appear and drafts do not.

10. If cache or snapshot behavior changed, check at least:

    ```text
    <WEB_APP_URL>?resource=snapshot
    <WEB_APP_URL>?resource=public-content-list&kind=news
    <WEB_APP_URL>?resource=public-program-list
    <WEB_APP_URL>?resource=public-search-index
    ```

11. Confirm normal public responses do not expose secrets, auth tokens, private sheets, unpublished records, or debug metadata unless `debugPerformance=1` was explicitly requested.

## Stale Deployment Detection

Production is likely running an old Apps Script deployment when:

- A feature works in source or local tests but production still behaves like the previous release.
- `debugPerformance=1` is missing after deploying cache diagnostics.
- `POST ?resource=site-view` returns `Unknown route` or does not update visitor stats.
- `GET ?resource=public-document-list` returns `Unknown route`.
- The backend response shape does not match the current source code or TypeScript API expectations.
- Old Apps Script errors continue after a Vercel deploy.
- Vercel has deployed successfully, but `script.google.com` responses still lack the new resource, field, or cache diagnostic.

Confirm stale deployment by listing deployments:

```powershell
pnpm gas:deployments
```

Then compare the production Web App deployment version with the new version created for the release.

## Rollback Plan

Roll back by redeploying a previous working Apps Script version to the same Web App deployment ID.

1. List deployments:

   ```powershell
   pnpm gas:deployments
   ```

2. Identify the previous working version number.
3. Redeploy that version to the same Web App deployment:

   ```powershell
   cd apps-script
   pnpm dlx @google/clasp deploy --deploymentId <WEB_APP_DEPLOYMENT_ID> --versionNumber <PREVIOUS_VERSION_NUMBER> --description "rollback: <reason>"
   cd ..
   ```

4. Confirm the production Web App URL did not change.
5. Confirm Vercel production still points to the same URL through `VITE_GOOGLE_APPS_SCRIPT_URL`.
6. Repeat the production verification checklist for the affected resources.
7. Record the rollback reason and follow-up fix in the release log.

## Cache Notes

- Public Apps Script responses use `CacheService`; public cache TTL can make visible data appear stale for a few minutes.
- Cache delay is not the same as a failed deployment. Verify with `debugPerformance=1` where supported.
- Cacheable public routes include `snapshot`, `public-home`, `public-content-list`, `public-document-list`, `public-program-list`, `public-search-index`, and `content-detail`.
- Editorial/admin writes can invalidate public snapshots.
- High-frequency public events such as `site-view` and `content-view` must not invalidate public snapshots.
- Do not add cache diagnostics to normal responses without an explicit debug flag.

## Schema And Sheet Notes

For releases that add sheets, headers, or storage fields:

- Verify the target spreadsheet exists and the Apps Script account can access it.
- Run or verify the setup path that initializes sheets and headers, currently `setupCmsBackend()`.
- Confirm required sheets exist, such as `Content`, `Carousel`, `ExternalServices`, `Media`, `Events`, `Documents`, `Menu`, `Users`, `Settings`, and `VisitorStats`.
- Confirm new headers are present in the expected order before testing admin writes.
- Verify admin save operations create or update the expected rows.
- Verify public endpoints return only published/public records where applicable.
- Verify drafts, disabled items, private data, and auth-only fields are excluded from public responses.

## Release Log Template

Copy this block into the release notes or deployment ticket.

```text
Date:
Git commit SHA:
Frontend deployment:
Apps Script version number:
Apps Script deployment ID:
Description:
Changed Apps Script files:
VITE_GOOGLE_APPS_SCRIPT_URL confirmed:
Verification result:
Rollback notes:
```

## Do Not Do

- Do not create a new Web App deployment unless intentionally changing the production URL.
- Do not deploy Apps Script with uncommitted local changes.
- Do not assume a Vercel deploy updates Apps Script.
- Do not invalidate public cache from high-frequency public events.
- Do not expose secrets, auth tokens, spreadsheet IDs, private URLs, or private configuration values in docs, screenshots, tickets, or chat logs.
- Do not change OAuth scopes without verifying the Apps Script consent and production deployment path.
- Do not skip production verification after backend changes.
