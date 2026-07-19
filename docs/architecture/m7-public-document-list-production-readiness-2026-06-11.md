# M7 Public Document List Production Readiness - 2026-06-11

> Historical record — checkpoint 2026-06-11 at commit `814ba241d62217a31c3d9440e405df446e7962ee`. Measurements and runtime statements below are preserved as historical evidence, not current state. Current source of truth: [M20 cleanup runtime ownership](./m20-cleanup-runtime-ownership.md).

Status: production-readiness gate only. Production cutover is not approved.

## Purpose

M7 verifies whether `public-document-list` is ready for a future controlled production cutover from Apps Script reads to the Cloudflare public API.

Apps Script remains production source of truth. M7 does not replace Apps Script, does not set production frontend env, and does not deploy a production Worker.

The only endpoint in scope is `public-document-list`.

## Current State

- M6.4 completed the actual non-production preview smoke using external non-committed preview resources.
- Committed `cloudflare/public-api/wrangler.toml` remains placeholder-safe with `database_id = "preview-placeholder"` for `[env.preview]`.
- The Worker provider remains explicit env-only.
- The default frontend provider remains Apps Script.
- Cloudflare remains scoped to the existing explicit `public-document-list` path only.
- No production D1 id, real D1 id, token, secret, production URL, real production data, or real Google Drive URL is committed.

## Production Cutover Preconditions

Every item below must be completed before any production env is changed:

- [ ] Production D1 database exists and is confirmed non-preview.
- [ ] Production D1 schema matches preview schema.
- [ ] Production seed/import plan exists and uses a sanitized and approved data source.
- [ ] Public response contract matches `PublicDocumentListSnapshot`.
- [ ] `/api/public/documents` returns HTTP `200` from the production Worker.
- [ ] Error responses are documented.
- [ ] CORS behavior is verified.
- [ ] Cache behavior is verified.
- [ ] Rollback plan is verified.
- [ ] Monitoring/logging is available.
- [ ] No other endpoints are routed to Cloudflare.
- [ ] Stakeholder approval is recorded outside git.

## Required Evidence Before Cutover

Record the following evidence before approving any production change:

- Preflight result.
- Production D1 migration result.
- Production data import/seed result.
- Worker production deploy result.
- Direct Worker smoke result.
- Vercel production env change plan.
- Browser/network smoke plan.
- Rollback test plan.
- Production safety confirmation.

Evidence may be redacted where needed, but it must prove that production resources were intentionally selected and that no secret, token, real D1 id, or production URL is committed.

## Cutover Plan Draft

Draft only. Do not execute in M7.

Future controlled cutover plan after explicit approval:

- Set `VITE_PUBLIC_API_PROVIDER=cloudflare`.
- Set `VITE_CLOUDFLARE_PUBLIC_API_URL=<production-worker-origin>`.
- Apply production scope only after approval.
- Redeploy the production frontend.
- Verify `/api/public/documents`.
- Verify UI unchanged.
- Verify only `public-document-list` uses Cloudflare.

This draft is not permission to change production env, deploy production Worker, or route production traffic.

## Rollback Plan

Rollback is production frontend env only:

- Remove `VITE_PUBLIC_API_PROVIDER`.
- Or set `VITE_PUBLIC_API_PROVIDER=apps-script`.
- Redeploy the production frontend.
- Verify the frontend returns to Apps Script for `public-document-list`.
- Confirm the Cloudflare Worker remains non-authoritative after rollback.

Rollback must be verified before cutover approval.

## No-Go Conditions

Any condition below blocks production cutover:

- Missing production D1 id.
- Unverified schema.
- Unverified data source.
- Failed direct Worker smoke.
- Failed response contract validation.
- Failed browser smoke.
- Failed rollback.
- Any production URL, secret, or id committed to git.
- Any Apps Script change.
- Any `src/services/googleApi.ts` change.
- Any endpoint beyond `public-document-list` affected.
- Any UI, route, cache key, or cache TTL change.
- Any admin, auth, or media migration included in the cutover.

## Production Safety Confirmation

M7 does not:

- Cut over production.
- Deploy a production Worker.
- Set production Vercel env.
- Commit production identifiers.
- Commit secrets.
- Commit real D1 ids.
- Commit real production data.
- Commit real Google Drive URLs.
- Migrate admin, auth, or media.
- Change Apps Script.
- Change `src/services/googleApi.ts`.
- Change UI, routes, cache keys, or cache TTL.

Production cutover remains deferred until all preconditions and evidence are complete and separately approved.
