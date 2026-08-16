# Apps Script Media Bridge Deployment Checklist

Updated: 2026-08-16.

Use this checklist only when a release changes `apps-script/`, Apps Script manifest/scopes, Google Drive media/file operations, or the Apps Script side of the Vercel media/file bridge.

Apps Script is not the current structured public/admin data backend and is not the current user-management backend. Cloudflare Worker + D1 remain the source of truth for structured CMS data and identity/session state.

## Current Scope

The active Apps Script Web App exposes a read-only `GET` health/scope response and these authenticated `POST` resources:

- `media`
- `media-delete`
- `media-upload-start`
- `media-upload-chunk`
- `media-upload-status`

The Vercel media bridge remains the browser-facing boundary. Structured public/admin routes such as `snapshot`, `public-home`, `content`, `users`, `menu`, `site-settings`, `homepage-settings`, `visitor-stats`, and `publish` must remain unavailable from Apps Script.

## Canonical Production Release Path

Production Apps Script release is GitHub Actions only. Do not use a local `clasp push --force`, local version creation, or an ad-hoc deployment as the production release mechanism.

The protected GitHub Environment `production` must contain:

- `CLASPRC_JSON`: OAuth credential JSON from an authorized `clasp login` session;
- `CLASP_JSON`: production `.clasp.json` containing the intended `scriptId` and `rootDir: "."`;
- `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID`: the existing production Web App deployment ID.

Never commit those values. The production workflows pin `@google/clasp@3.3.0`.

The approved workflows are:

- **Apps Script Production Preflight** — read-only target/health verification;
- **Apps Script Production Release** — reviewed source push, immutable version creation, and in-place update of the existing production deployment;
- **Apps Script Production Rollback** — repoint the same existing deployment to a known immutable version without a source push.

## Before Release

Confirm the change is merged to `master`. The production workflows fail closed on any other branch.

Run normal CI and specifically confirm the media bridge contract tests pass:

```powershell
pnpm vitest run src/test/appsScriptCode.test.ts server/appsScriptProxy/handler.test.mjs
```

Confirm no structured Apps Script routes have been restored:

```powershell
rg "auth-login|snapshot|public-home|public-content-list|public-document-list|public-program-list|public-search-index|content-delete|document-delete|carousel-delete|external-service-delete|event-delete|publish|visitor-stats|users-delete|users-reset|site-settings|homepage-settings" apps-script
```

Confirm the Vercel proxy continues to expose only the intended media/file bridge operations and no browser path receives `APPS_SCRIPT_BRIDGE_TOKEN`.

Run **Apps Script Production Preflight** from `master` and approve the protected `production` Environment. It must succeed before the first production release after credential rotation or workflow changes.

Preflight must prove:

- `CLASPRC_JSON`, `CLASP_JSON`, and `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID` are available from the protected Environment;
- the project/deployment configuration parses without placeholders;
- the configured deployment ID exists in the configured Apps Script project;
- that deployment references an immutable version;
- the unchanged production Web App URL returns `{ ok: true, scope: "media-file-bridge" }` with the exact five active resources;
- no source push, version creation, deployment update, or deployment deletion occurs.

## Production Release

Run **Apps Script Production Release** from `master` only when Apps Script source or manifest behavior must change.

Enter the exact confirmation phrase:

```text
DEPLOY_EXISTING_APPS_SCRIPT_WEB_APP
```

An optional release note may be supplied. The workflow records the GitHub SHA in the immutable Apps Script version description.

The workflow sequence is intentionally fixed:

1. verify media bridge contract tests;
2. materialize protected clasp credentials only on the ephemeral runner;
3. verify the exact existing production deployment and capture its current version;
4. `clasp push --force` the reviewed repository source to Apps Script HEAD inside the protected CI boundary;
5. create one new immutable Apps Script version;
6. update only `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID` to that exact version;
7. re-list deployments and verify the same deployment ID references the new version;
8. read the existing production Web App health endpoint and verify the media/file bridge contract;
9. remove temporary clasp credential files from the runner.

The release must not create a new deployment or change the Web App URL. Creating a new Web App deployment can produce a new URL and would require coordinated Vercel server-side configuration; that is outside normal P5G release scope.

If source push succeeds but later version/deployment update fails, the prior immutable deployment remains the user-facing production release. Do not create a replacement deployment. Fix the blocker and rerun the guarded workflow from `master`.

## Post-Release Evidence

Record the successful GitHub Actions run URL. The workflow summary must show:

- `master` commit SHA;
- previous immutable Apps Script version;
- released immutable Apps Script version;
- existing deployment updated in place;
- Web App URL unchanged;
- production health smoke passed.

Do not copy OAuth tokens, script IDs, deployment IDs, bridge tokens, or private Drive identifiers into tickets or docs.

## Rollback

Use **Apps Script Production Rollback** when a newly deployed immutable Apps Script version is proven faulty and rollback is preferable to a forward fix.

Use the previous immutable version recorded by the release summary and enter the exact confirmation phrase:

```text
ROLLBACK_EXISTING_APPS_SCRIPT_WEB_APP
```

Rollback:

1. verifies the requested immutable version exists;
2. verifies it differs from the currently deployed version;
3. updates the same `APPS_SCRIPT_PRODUCTION_DEPLOYMENT_ID` to the requested version;
4. does not run `clasp push`;
5. does not create a new Apps Script version;
6. does not create or delete a deployment;
7. verifies the deployment version after the update;
8. performs the read-only production health smoke.

A rollback changes only which immutable Apps Script version the existing Web App deployment references. Repository `master` remains unchanged; follow with a corrective PR before the next production release.

## Local Development

`pnpm gas:push:local` is development-only and intentionally does not use `--force`. It operates against the developer's local, gitignored `apps-script/.clasp.json`.

Local commands are not the production release audit trail. Production source push, immutable version creation, deployment update, and rollback belong to the protected GitHub Actions workflows above.
