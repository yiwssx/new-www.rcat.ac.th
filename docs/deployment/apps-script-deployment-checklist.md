# Apps Script Media Bridge Deployment Checklist

Updated: 2026-09-26.

Use this checklist only when a change affects `apps-script/`, Apps Script manifest/scopes, Google Drive media/file operations, or the Apps Script side of the Vercel media/file bridge.

Apps Script is not the structured CMS or identity backend. Cloudflare Worker + D1 remain authoritative for those surfaces.

## Canonical production path

Production Apps Script operations are GitHub Actions only. The protected `production` Environment must contain:

- `CLASPRC_JSON`
- `CLASP_JSON`
- `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID`

Never commit those values. The approved workflows are:

- **Deploy / Apps Script** with operation `preflight` for read-only target and health verification;
- **Deploy / Apps Script** with operation `release` for reviewed source push, immutable version creation, and in-place update of the existing deployment;
- **Apps Script Production Rollback** to repoint the same deployment to a known immutable version without pushing source.

## Before release

1. Confirm the change is merged to `master`.
2. Confirm normal CI is green.
3. Confirm media bridge contract tests pass:

```powershell
pnpm vitest run src/test/appsScriptCode.test.ts server/appsScriptProxy/handler.test.mjs
```

4. Run **Deploy / Apps Script** with operation `preflight` and approve the protected `production` Environment.

Preflight must prove that the protected credentials are present, the configured deployment exists, it references an immutable version, and the production Web App returns the expected media/file bridge health contract. It must not push source, create a version, or mutate a deployment.

## Production release

Run **Deploy / Apps Script** with operation `release` from `master`. Enter:

```text
DEPLOY_EXISTING_APPS_SCRIPT_WEB_APP
```

The guarded release sequence is:

1. verify media bridge contract tests;
2. materialize protected clasp credentials on the ephemeral runner;
3. capture the current immutable production version;
4. run the reviewed `clasp push --force` inside the protected CI boundary;
5. create one new immutable version;
6. update only `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID`;
7. verify the same deployment ID references the new version;
8. run the production bridge health smoke;
9. remove temporary credential files.

The release must not create a replacement deployment or change the Web App URL.

## Post-release evidence

Record the successful GitHub Actions run URL. The summary must identify the `master` SHA, previous immutable version, released immutable version, and successful health smoke without printing credentials or deployment IDs.

## Rollback

Use **Apps Script Production Rollback** when the newly released immutable version is faulty. Enter:

```text
ROLLBACK_EXISTING_APPS_SCRIPT_WEB_APP
```

Rollback verifies the requested immutable version, repoints the same `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID`, verifies the result, and runs the health smoke. It does not run `clasp push`, create a version, create a deployment, or delete a deployment.

## Local development

`pnpm gas:push:local` is development-only and intentionally does not use `--force`. Local commands are not the production audit trail.
