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

GitHub creates an Environment deployment record whenever a job references the protected `production` environment, even when the job is only using that environment as a credential gate. After the read-only readiness job finishes, a separate cleanup job resolves exactly the Environment deployment created for the current workflow attempt, marks it inactive, and deletes that pseudo-deployment. The workflow run itself remains the audit record. The cleanup job fails closed if it cannot identify exactly one matching deployment and does not interact with Cloudflare resources.

Deployment matching lives in the unit-tested `scripts/resolve-d1-drill-environment-deployment.mjs` helper rather than inline workflow code. It requires the exact master SHA, actor, GitHub Actions app, Environment classification, and run-time window.

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
9. retires and deletes only the GitHub Environment pseudo-deployment created for the current drill attempt while retaining the workflow run as audit evidence.

Missing credentials, insufficient D1 Read permission, D1 identity mismatch, failure to retrieve a Time Travel bookmark, Wrangler command incompatibility, or an ambiguous GitHub Environment deployment match is a drill failure. Do not bypass the boundary by restoring the privileged production token to this workflow.

## Evidence To Record

For every quarterly drill, record outside source control when it contains account-specific information:

- drill date/time;
- operator;
- workflow run URL;
- whether the exact production D1 identity resolved;
- whether production metadata resolved;
- whether Time Travel returned a current bookmark;
- whether the transient GitHub Environment deployment record was retired successfully;
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
