# M20 Production Readiness Gate

Status: M20-P0 repository-owned production readiness gate scaffolding only. M20 remains BLOCKED until external operator gates pass. This is not production cutover readiness.

## Current State After M19

M19 is closed for repository-owned parity remediation and must not be reopened for M20-P0. Public-read parity, structured admin preview routes, provider adapters, and local readiness checks exist in the repository. Post-M19 external operator evidence records restored public frontend loading, verified preview admin proxy login and snapshot, and a passed preview admin write smoke. A distinct post-M19 public-read preview smoke result still requires operator evidence.

Apps Script remains the fallback and rollback provider. Google Drive binary media operations remain in the Apps Script bridge. Ordered migration 0005_m19_structured_admin_parity.sql exists but is not applied by M20-P0.

## Scope Of M20-P0

M20-P0 creates repository-owned scaffolding for the future production readiness review:

- readiness gate documentation
- operator runbook
- offline local readiness script
- tests for the local readiness script
- package scripts for local readiness checks
- correction of root-level cutover command wording where existing docs were ambiguous

The only executable result of M20-P0 is a local repository readiness review. REPOSITORY_READY_FOR_M20_REVIEW means the repository contains the scaffolding needed for operator review; it does not mean production is ready.

## Non-goals

- no production cutover
- no production Worker deploy
- no production D1 migration, import, query, or write
- no Vercel production environment mutation
- no Apps Script mutation
- no Google Drive mutation
- no provider default change
- no authentication, authorization, CORS, session, smoke-token, preview-gate, or production-context weakening
- no UI, route, cache key, or cache TTL change
- no movement of Google Drive binary media operations out of the Apps Script bridge
- no commitment of live endpoints, ids, tokens, record payloads, screenshots, exact timestamps, or infrastructure identifiers

## Production Safety Boundaries

M20-P0 may read repository files only. It must not run remote commands, perform network requests, write D1, deploy Workers, mutate Vercel, mutate Apps Script, mutate Google Drive, or start production traffic changes.

The committed Worker production configuration must remain placeholder-safe:

- production environment marker remains explicit
- preview write gate remains disabled in production
- smoke-token gate remains disabled in production
- production D1 binding remains a placeholder in committed files

Any local operator configuration outside git must stay uncommitted.

## External Operator Blockers

The following items remain EXTERNAL_OPERATOR_BLOCKER before M20 execution can begin:

- post-M19 public-read preview smoke evidence
- preview-only migration verification evidence
- preview admin write smoke evidence for the exact candidate deployment
- full structured source-data inventory
- cross-provider reconciliation report
- media bridge ownership, permission, quota, compensation, and recovery approval
- identity and RBAC approval, including MFA, role mapping, revocation, and emergency access
- backup rehearsal evidence
- restore rehearsal evidence
- rollback rehearsal evidence
- monitoring and alert threshold approval
- final cutover authority, operator, and support-window approval

These blockers require external evidence. Repository code must not invent values for them.

## Required Evidence Format

Evidence must be recorded in redacted form only. Each evidence item should include:

- checkpoint label
- environment label such as <preview> or <production-review>
- operator role label
- command label, not command output containing identifiers
- pass, fail, or blocked result
- redacted target labels
- counts only when they do not expose records
- first public item ids only when approved as non-sensitive
- validation issue labels
- rollback availability

Evidence must not include live URLs, D1 ids, account ids, deployment ids, run ids, tokens, secrets, record payloads, screenshots, exact timestamps, Google Drive file URLs, Apps Script URLs, or infrastructure identifiers.

## Required Rehearsal Flow

The required rehearsal flow is:

1. Confirm pnpm worker:m20:readiness reports repository readiness.
2. Confirm pnpm worker:m19:readiness still reports repository readiness.
3. Run post-M19 public-read preview smoke against an approved preview Worker origin.
4. Verify preview-only migrations against a confirmed non-production D1 database.
5. Run preview admin write smoke against the exact candidate preview Worker.
6. Produce full structured data inventory from the current source of truth.
7. Reconcile structured source data against Cloudflare D1 preview output.
8. Verify the Apps Script media bridge remains operational and recoverable.
9. Obtain identity and RBAC approval.
10. Rehearse backup, restore, and rollback.
11. Approve monitoring thresholds and response ownership.
12. Record cutover authority before any future production execution.

## Backup / Restore / Rollback Expectations

Before any future M20 production execution, the operator must provide:

- backup procedure for D1 structured data
- restore procedure tested against non-production data
- rollback procedure to return frontend provider behavior to Apps Script
- rollback procedure for Worker and D1 configuration
- confirmation that rollback does not require Google Drive mutation
- named support owner and escalation path
- acceptable RTO and RPO values

M20-P0 does not execute any backup, restore, or rollback command.

## Cutover Authority Requirements

Future production execution requires:

- explicit operator approval phrase for the exact checkpoint
- approved monitoring window
- confirmed owner for rollback authority
- confirmed owner for identity/RBAC decisions
- confirmed owner for Google Drive media bridge recovery
- confirmed production Worker and D1 resources outside git
- confirmed Vercel production environment change plan

No approval is implied by this document.

## Go / No-Go Checklist

Go requires every item below to be true:

- M19 remains closed.
- M20-P0 readiness gate reports repository readiness.
- Post-M19 public-read preview smoke passed.
- Preview-only migration verification passed.
- Preview admin write smoke passed for the candidate deployment.
- Full structured data inventory is approved.
- Cross-provider reconciliation is approved.
- Media bridge verification is approved.
- Identity/RBAC approval is recorded.
- Backup rehearsal passed.
- Restore rehearsal passed.
- Rollback rehearsal passed.
- Monitoring thresholds are approved.
- Final cutover authority is recorded.

No-go applies if any item is missing, blocked, stale, or unapproved.

## Rollback Checklist

Rollback must remain available before any future production cutover:

- Apps Script fallback provider remains available.
- Frontend provider can be returned to Apps Script by approved environment change.
- Cloudflare provider can be disabled without UI, route, cache key, or cache TTL changes.
- D1 structured data can be restored from approved backup.
- Worker deployment can be reverted by approved platform process.
- Google Drive media bridge remains unchanged.
- Operator communications and support owner are ready.

## Redacted Evidence Policy

All committed evidence must be redacted. Commit only labels and outcomes, never values. Use placeholders such as <preview-worker-origin>, <preview-d1-database-name>, <redacted-count>, and <operator-role>.

Evidence that contains a live endpoint, identifier, token, secret, record payload, screenshot, exact timestamp, or real infrastructure value must stay outside git.
