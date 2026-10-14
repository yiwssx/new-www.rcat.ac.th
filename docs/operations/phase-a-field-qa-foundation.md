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
5. otherwise, the workflow first checks the matching `Vercel` commit status, then GitHub Deployments for the exact-SHA `Production` success, and finally checks a **no-store release witness served by the canonical production origin**. This witness is built from Vercel-supplied Git metadata only during the production build and must prove the target SHA, the `main` ref, GitHub source repository and Vercel production environment; wrong or missing metadata fails closed. Only after the gate passes can production Playwright smoke run against `https://www.rcat.ac.th`.

For documentation and test-contract purposes, an expected ignored build is a non-runtime-only change that the shared classifier intentionally permits Vercel to skip. A runtime-impacting change that is ignored remains a fail-closed condition.

### CodeQL Actions trust boundary (2026-10-08)

For post-CI `workflow_run` events, browser smoke accepts only a successful `push` CI on `main` from this repository (not a same-named branch from a fork). The checked-out and executed verification scripts always come from the trusted default-branch `github.sha`, with persisted checkout credentials disabled. The triggering CI `head_sha` is **data only**: it must be a 40-hex commit reachable from the trusted `main` revision, and it remains the target for change classification and the exact-SHA Vercel deployment status gate. Untrusted revisions are never checked out and executed in the cache-capable browser job.

The full-history checkout enables the ancestry check and a diff of `TARGET_SHA^..TARGET_SHA`, rather than accidentally classifying a newer verification-code commit. A commit that is no longer reachable from the event's trusted default-branch revision fails closed. Tests can come from a newer trusted `main` revision while deployment matching remains tied to the original CI SHA; this is intentional and recorded in logs.

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

The primary gate uses Vercel's GitHub **commit status**. A documented connector delay can leave it permanently `pending` even while Vercel has a `READY` Production deployment and has assigned the public domain. In that case a **read-only GitHub Deployments API** fallback verifies the same exact 40-character SHA, the Production environment, Vercel App ownership, latest terminal Deployment Status, and HTTPS deployment URL. A pending, other-app, wrong-SHA, wrong-environment, stale or failed status does not pass. The fallback does **not** skip read-only browser smoke, broaden to untrusted commits, change Worker/D1, or require a Vercel token. No unrelated or older deployment is accepted.

### Canonical Vercel release witness — 2026-10-14

When both GitHub reporting channels stay pending (run 38545987281), the build script `scripts/prepare-ssr-cutover-output.mjs` writes `dist/rcat-release.json` _after_ Vite finishes. The only accepted source of identity is Vercel's build-time `VERCEL_GIT_*` metadata. The generator does not read local `.env` secrets, authenticate visitors, or change site data. Preview builds do not emit this production witness.

The exact-SHA checker reads `https://www.rcat.ac.th/rcat-release.json?sha=<40-hex>` over HTTPS with no redirects, validates JSON identity (`provider=vercel`, `environment=production`, `repository=yiwssx/new-www.rcat.ac.th`, `ref=main`) and the requested SHA. It requires no-store response headers; an absent/stale marker waits, while invalid or unexpected metadata fails closed. The check is only used when the release is runtime-impacting and both native GitHub evidence channels have not completed. It cannot substitute an ignored-build success or bypass the actual Playwright browser tests.

A real GitHub `Vercel` success, a matching Vercel GitHub Deployment success, or a matching canonical production release witness may satisfy the release readiness gate; all still require read-only browser verification. This third path needs no new GitHub Actions secret, no GitHub Checks mutation and no provider integration write access.

**Operational boundary:** A failed historic run remains failed. Once this correction is merged to protected `main`, inspect the newly triggered Vercel READY deployment, aliases, and the new Production Verification run. Record real field-test/Console outcomes, not just CI completion. If Vercel System Environment Variables are disabled, the production build fails closed rather than writing unverified SHA information.

## Manual fallback

GitHub Actions → **Production Verification** → **Run workflow** → operation `browser-smoke` is the current deliberate fallback. The default target is `https://www.rcat.ac.th`.

On failure, the workflow retains bounded Playwright report/trace/screenshot evidence. Successful automatic runs do not need failure artifacts.

## Relationship to completed reliability phases

- Phase A owns deployment-driven automatic read-only browser QA.
- Phase B owns explicit-refresh operator visibility and does not replace Phase A scheduling.
- Phase C added accessibility, synthetic-performance, and deliberate protected authenticated regression coverage.
- Phase C3 is a manual/protected authenticated disposable CMS regression tool and remains separate from automatic read-only Phase A smoke.
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
