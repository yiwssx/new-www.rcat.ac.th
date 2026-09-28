# Phase A — Field QA Foundation

Updated: 2026-09-28

Status: complete and production-verified. Deployment-driven browser smoke remains an ongoing operational guard after closure. Reliability Roadmap v2 is complete.

## Goal

Phase A adds browser-level production verification on top of repository CI and bounded production reliability checks. It is intentionally read-only and uses repository-owned tooling.

The normal path is automation-first:

1. a change reaches `main`;
2. repository CI completes successfully for that exact commit SHA;
3. **Production Verification** classifies the commit diff with the same Vercel runtime-impact rules used by `scripts/vercel-ignore-build.mjs`;
4. an expected Vercel `Ignored Build Step` / `Canceled by Ignored Build Step` status for a non-runtime-only change completes without browser smoke because no new production deployment exists;
5. otherwise, the workflow requires the matching `Vercel` status to report success with a non-empty `target_url`, then runs production Playwright smoke against `https://www.rcat.ac.th`.

`workflow_dispatch` remains available as an operational fallback for reruns, controlled alternative-URL verification, or recovery checks. It is not the primary operating path.

## Production safety boundary

Allowed:

- open public production routes;
- submit a public Search GET query;
- open `/login`;
- verify unauthenticated `/admin` protection;
- inspect console, page errors, requests, responses, viewport geometry, accessibility, and browser-rendered UI.

Not allowed in automatic Phase A verification:

- authenticate with a real CMS account;
- create, edit, publish, unpublish, or delete CMS content;
- upload or delete media/documents;
- mutate D1, Apps Script, Google Drive, Vercel, Cloudflare, DNS, or production settings.

Authenticated disposable write verification remains a separate deliberate protected production operation and must not be folded into automatic read-only smoke without explicit scope.

## Runtime diagnostics

Production browser verification fails on material browser/runtime regressions including:

- uncaught page errors;
- application-origin console errors;
- unexpected same-origin request failures;
- same-origin HTTP 5xx responses;
- critical document/script/stylesheet 4xx failures;
- missing required UI;
- meaningful horizontal viewport overflow;
- configured accessibility/synthetic performance regressions.

Expected unauthenticated API 4xx responses are not treated as browser-smoke failures when `/login` or `/admin` legitimately probes session state without an authenticated user.

## Automatic trigger and Vercel gate

The active workflow is `.github/workflows/production-verification.yml` and listens for successful repository `CI` completion on `main`.

It checks the exact CI `head_sha`, applies the repository's Vercel runtime-impact classifier, and waits for commit status context `Vercel`:

- expected non-runtime ignored build -> successful no-deployment/no-smoke outcome;
- ignored build for a runtime-impacting change -> fail closed;
- successful deployment -> require a non-empty `target_url` before browser smoke;
- Vercel failure/error, missing `target_url`, or bounded wait timeout -> fail closed.

This is a commit-status gate, not a direct Vercel deployment-record lookup. It does not treat unrelated or older deployments as evidence for the target SHA.

## Manual fallback

GitHub Actions → **Production Verification** → **Run workflow** → operation `browser-smoke` is the current deliberate fallback. The default target is `https://www.rcat.ac.th`.

On failure, the workflow retains bounded Playwright report/trace/screenshot evidence. Successful automatic runs do not need failure artifacts.

## Relationship to completed reliability phases

- Phase A owns deployment-driven automatic read-only browser QA.
- Phase B owns explicit-refresh operator visibility and does not replace Phase A scheduling.
- Phase C added accessibility, synthetic-performance, and deliberate protected authenticated regression coverage.
- P6C remains a separate bounded production reliability guard.

Future reliability work requires new explicit scope rather than silently extending completed phases.

## Ongoing completion contract

The implementation remains complete while:

1. desktop/mobile read-only production scenarios remain present;
2. console/page/network diagnostics remain enforced;
3. successful `main` CI uses the same Vercel runtime classifier as production deployment;
4. expected non-runtime ignored builds do not create false failures;
5. unexpected runtime ignored builds still fail closed;
6. a real runtime deployment must match the exact target SHA before smoke begins;
7. manual dispatch remains an operational fallback rather than the normal path;
8. repository CI and governance remain green.

Historical Phase A completion evidence remains in the dated QA/roadmap documents and is intentionally not rewritten during the `master` → `main` migration.
