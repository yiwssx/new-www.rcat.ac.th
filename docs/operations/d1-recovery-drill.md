# D1 Recovery Drill

Updated: 2026-08-16.

This drill verifies that the current operator path can resolve the canonical production D1 metadata and Time Travel information without exercising a destructive restore or any database write.

## Safety Boundary

The GitHub Actions workflow `.github/workflows/d1-recovery-drill.yml` is intentionally limited to the canonical production D1 physical resource `rcat-public-api-preview`. The legacy `preview` label is retained by design; the protected `RCAT_PRODUCTION_D1_DATABASE_ID` is authoritative. The workflow contains no `d1 time-travel restore`, migration apply, D1 write/import, or Worker deploy command.

The workflow may run only from `master` after explicit acknowledgement that the production readiness drill is read-only. It uses the protected GitHub `production` Environment as the credential boundary for:

- `CLOUDFLARE_ACCOUNT_ID`;
- `CLOUDFLARE_D1_READ_TOKEN`;
- `RCAT_PRODUCTION_D1_DATABASE_ID`.

`CLOUDFLARE_D1_READ_TOKEN` is a dedicated account-scoped token with D1 Read only. The drill must never fall back to the privileged `CLOUDFLARE_API_TOKEN` used by cleanup/migration/release/deploy workflows.

The read-only readiness job uses the protected `production` Environment with `deployment: false`. GitHub still applies the Environment's credential and approval boundary, but no GitHub Deployment object is created for this verification-only run. The workflow run remains the audit record, and no deployment-history cleanup job is required.

The authoritative Time Travel readiness gate is successful execution of `wrangler d1 time-travel info rcat-public-api-preview --json` together with a non-empty bookmark. The bookmark is retained only in runner temporary storage and is not printed or committed.

A production restore remains a separate manual incident action governed by `docs/operations/admin-backup.md`. A restore must require an explicit incident decision, a captured pre-restore bookmark, an approved target, and post-restore validation.

## Running The Drill

Run **D1 Recovery Drill** manually from GitHub Actions on `master`, set `acknowledge_read_only_production=true`, and approve the protected `production` environment when requested.

The workflow:

1. installs the repository's pinned Node/pnpm dependencies;
2. verifies the protected account ID, dedicated D1 read token, and protected production D1 UUID are present;
3. scans itself for destructive restore commands;
4. lists account-scoped D1 resources and verifies the exact physical resource + protected UUID identity;
5. resolves metadata for `rcat-public-api-preview`;
6. invokes Wrangler's read-only Time Travel info command;
7. requires a non-empty current bookmark as readiness proof;
8. writes a summary confirming no restore or production D1 write occurred;
9. retains the workflow run as audit evidence without creating a GitHub Deployment object.

Missing credentials, insufficient D1 Read permission, D1 identity mismatch, failure to retrieve a Time Travel bookmark, or Wrangler command incompatibility is a drill failure. Do not bypass the boundary by restoring the privileged production token to this workflow.

## Evidence To Record

For every quarterly drill, record outside source control when it contains account-specific information:

- drill date/time;
- operator;
- workflow run URL;
- whether the exact production D1 identity resolved;
- whether production metadata resolved;
- whether Time Travel returned a current bookmark;
- whether the run completed without creating a GitHub Deployment object;
- credential/access blockers;
- command drift or Wrangler incompatibility;
- elapsed time from drill start to successful readiness confirmation;
- follow-up action and owner for every blocker.

Do not commit real database IDs, bookmarks, Cloudflare account IDs, tokens, or sensitive backup contents.

## RPO/RTO Interpretation

The existing production recovery objectives remain working engineering targets:

- RPO: target the last known good minute when the incident is inside D1 Time Travel retention;
- RTO: restore decision, execution, and read-only validation within 60 minutes after a D1 recovery incident is declared.

This read-only drill validates operator/tooling readiness but does **not** prove destructive restore duration. Record its elapsed time as a readiness signal, not as a production restore benchmark.

## Escalation

If Time Travel readiness cannot be resolved, fix the dedicated D1 Read token, exact production resource resolution, protected UUID mapping, Wrangler command drift, D1 availability, or GitHub Environment deployment cleanup before the next high-risk production migration/import. Do not weaken the credential boundary merely to make the drill pass.
