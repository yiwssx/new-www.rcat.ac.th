# Admin Backup And D1 Recovery Runbook

Updated: 2026-09-11.

The CMS provides a logical JSON backup for Cloudflare D1 data, while D1 Time Travel is the documented point-in-time recovery path for destructive production incidents. The backup UI originated during the M21-era work, but M21 is historical; this runbook describes the current post-P5H production operation.

## Canonical Production D1 Identity

The canonical production D1 is the existing data-bearing resource whose historical physical Cloudflare name is `rcat-public-api-preview`. Under the current repository contract it is selected through `--env production`, and its protected UUID in `RCAT_PRODUCTION_D1_DATABASE_ID` is the authoritative release identity.

The old empty D1 named `rcat-public-api-production` was deleted on 2026-08-16 and must not be used in current recovery commands. The `preview` substring in the live D1 name is historical naming only; it does not mean the resource is a Preview environment.

For routine readiness checks prefer the protected repository workflows documented in `docs/deployment/runtime-deployment-guide.md`. A real restore remains a deliberate operator action and is never automatic CI/CD behavior.

## Open The Backup Page

1. Sign in to the CMS as an admin-level user.
2. Open **Admin > สำรองข้อมูล**.
3. Confirm the page title is **สำรองข้อมูลระบบ**.

Editor and viewer accounts can see the page but cannot run count or download actions.

## Check Counts

1. Click **ตรวจนับข้อมูล**.
2. Review the table list, row count, status, and generated time.
3. If a table shows `missing`, confirm whether that table is optional in the current environment before relying on the backup.

## Download Logical Backup

1. Click **ดาวน์โหลดไฟล์สำรองข้อมูล**.
2. Confirm the prompt: `ต้องการสร้างและดาวน์โหลดไฟล์สำรองข้อมูลระบบหรือไม่`.
3. Wait for `กำลังสร้างไฟล์สำรองข้อมูล`.
4. Confirm the downloaded `.json` file opens and contains `schemaVersion`, `generatedAt`, `counts`, and `tables`.

The file name follows `rcat-d1-backup-<environment>-<timestamp>.json`.

## Safe Storage

Backup files may include system data and admin metadata. Store them outside the repository in a restricted location such as an encrypted drive, approved password-manager attachment vault, or organization-controlled private storage.

Do not upload backup files to public websites, public Drive folders, chat channels, source control, or issue trackers.

## Frequency

Recommended baseline:

- before each Worker or D1-affecting deployment;
- before bulk content/admin-data changes;
- weekly during active CMS operation;
- immediately before any future restore/import procedure.

## D1 Time Travel Preflight

Cloudflare D1 Time Travel is the primary point-in-time recovery mechanism for the production database. It does not replace the logical JSON backup because retention is finite and the logical backup remains useful for inspection and longer-lived storage.

Before relying on Time Travel, verify the canonical production database:

```bash
pnpm wrangler d1 info rcat-public-api-preview \
  --config cloudflare/public-api/wrangler.toml \
  --env production \
  --json
```

Confirm the account/resource identity is the expected canonical production D1. Do not run a destructive restore if identity cannot be verified.

Before every production Worker/D1 release, the protected release tooling captures current Time Travel readiness/bookmark information. For a manual incident investigation, the equivalent read-only query is:

```bash
pnpm wrangler d1 time-travel info rcat-public-api-preview \
  --config cloudflare/public-api/wrangler.toml \
  --env production \
  --json
```

Record recovery metadata only in the approved restricted incident/release record. Do not commit real database identifiers, credentials, bookmarks, or sensitive output to the repository.

## Optional SQL Export Before High-Risk Changes

For a schema migration, bulk import, or other high-risk data operation, an operator may also create a full SQL export:

```bash
pnpm wrangler d1 export rcat-public-api-preview \
  --remote \
  --config cloudflare/public-api/wrangler.toml \
  --env production \
  --output ./rcat-production-before-change.sql
```

Store this export using the same restricted-storage rules as the logical JSON backup and delete temporary local copies when the retention requirement is satisfied.

## Recovery Decision Gate

Time Travel restore overwrites the production database in place and cancels in-flight queries/transactions. Treat it as a destructive incident action.

Before restore:

1. Stop or postpone any production Worker/D1 deployment in progress.
2. Identify the incident window and the last known good timestamp/bookmark.
3. Capture the **current** bookmark first so the restore itself can be undone if necessary.
4. Download a fresh logical JSON backup if the admin read path is still usable.
5. Verify the physical resource is `rcat-public-api-preview` in the canonical production role and verify its protected identity through the approved process.
6. Record the intended target timestamp/bookmark and reason for restore.
7. Require an explicit operator decision before running the restore command. Do not place automatic Time Travel restore in CI/CD.

## Restore By Timestamp Or Bookmark

Inspect a point in time before restoring:

```bash
pnpm wrangler d1 time-travel info rcat-public-api-preview \
  --timestamp "<approved-ISO-8601-timestamp>" \
  --config cloudflare/public-api/wrangler.toml \
  --env production
```

Then restore using exactly one approved target.

By timestamp:

```bash
pnpm wrangler d1 time-travel restore rcat-public-api-preview \
  --timestamp "<approved-ISO-8601-timestamp>" \
  --config cloudflare/public-api/wrangler.toml \
  --env production
```

Or by bookmark:

```bash
pnpm wrangler d1 time-travel restore rcat-public-api-preview \
  --bookmark "<approved-bookmark>" \
  --config cloudflare/public-api/wrangler.toml \
  --env production
```

Do not use `--skip-confirmation` for an interactive production recovery.

## Post-Restore Validation

After Time Travel reports success:

1. Re-run `d1 info` and capture the resulting state through the approved incident record.
2. Run read-only public Worker smoke checks before any write test.
3. Verify Admin backup counts against the expected pre-incident baseline.
4. Verify login/session behavior without changing user lifecycle data.
5. Verify representative public content, documents, calendar, and homepage reads.
6. Review Worker/Vercel errors for new 5xx responses.
7. Only resume deployments or bulk writes after the production read path is stable.

If the restore target was wrong, use the pre-restore bookmark captured in the decision gate to restore forward again.

## Recovery Objectives

Working engineering targets for the current architecture:

- **RPO:** use D1 Time Travel to target the last known good point when the incident falls inside Cloudflare retention; retain the weekly logical backup as a secondary longer-lived recovery artifact.
- **RTO:** aim to make the restore decision, execute Time Travel, and complete the read-only validation checklist within 60 minutes of declaring a D1 recovery incident.

These are operational targets, not contractual service-level guarantees. Record actual recovery time and data-loss window after every drill or real incident and revise the targets if they are not realistic.

## Recovery Drill

The repository-owned D1 Recovery Drill is read-only and verifies production Time Travel readiness through the protected production identity. Do not perform a real production restore merely to prove that rollback is possible.

For tabletop exercises:

1. verify current production D1 identity and Time Travel support;
2. resolve read-only Time Travel metadata through the approved workflow or safe operator command;
3. confirm operators know where logical backups are stored;
4. walk through the restore decision gate without restoring production;
5. record blockers, command drift, access gaps, and the observed RTO estimate.

## Restore Status

The CMS Admin UI does not provide a restore/import button. That is intentional: restore is a destructive operator action and remains outside the normal web-admin write path. D1 Time Travel is the documented production point-in-time recovery mechanism; logical JSON/SQL exports are additional recovery and inspection layers.
