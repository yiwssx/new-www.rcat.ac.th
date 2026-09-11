# Phase A — Field QA Foundation

Updated: 2026-09-11

Status: complete and production-verified. The deployment-driven browser smoke remains an ongoing operational guard after closure.

## Goal

Phase A adds browser-level production verification on top of the existing P6C HTTP/SSR/Worker/D1 reliability smoke. It is intentionally read-only and uses only repository-owned or already-installed free tooling.

The Phase A browser smoke is not a replacement for CI or P6C. It covers failure classes that static analysis and raw HTTP probes cannot reliably detect, including client-side crashes, hydration/runtime errors, critical browser request failures, and viewport-specific layout problems.

The normal Phase A path is automation-first:

1. a change reaches `master`;
2. repository CI completes successfully for that exact commit SHA;
3. the workflow waits for the GitHub commit-status context `Vercel` on that SHA to report `success` and rejects any status whose description indicates an Ignored Build Step;
4. the production Playwright smoke runs automatically against `https://www.rcat.ac.th`.

`workflow_dispatch` remains available only as an operational fallback for reruns, controlled alternative-URL verification, or recovery checks. It is not the primary operating path.

## Cost boundary

No paid tool or new external SaaS is introduced.

Phase A uses:

- Playwright already present in the repository;
- GitHub Actions already used by the project;
- Vercel's existing GitHub commit deployment status;
- Chromium installed by Playwright on the GitHub-hosted runner;
- GitHub failure artifacts for short-lived trace/screenshot evidence.

No Sentry, BrowserStack, Datadog, New Relic, or other monitoring service is required.

## Production safety boundary

The automated smoke must remain read-only.

Allowed:

- open public production routes;
- submit a public Search GET query;
- open `/login`;
- verify unauthenticated `/admin` protection;
- inspect console, page errors, requests, responses, viewport geometry, and browser-rendered UI.

Not allowed in Phase A automation:

- authenticate with a real CMS account;
- create, edit, publish, unpublish, or delete CMS content;
- upload or delete media/documents;
- mutate D1, Apps Script, Google Drive, Vercel, Cloudflare, DNS, or production settings.

Authenticated disposable write verification is owned by completed Phase C3 and remains manual/protected. It must not be folded into the automatic read-only Phase A smoke without new explicit scope.

## Automated browser coverage

| ID     | Scenario                                               | Desktop | Mobile | Production write |
| ------ | ------------------------------------------------------ | ------- | ------ | ---------------- |
| QA-A01 | Home renders SSR/hydrated public shell                 | Yes     | Yes    | No               |
| QA-A02 | Public Documents route renders                         | Yes     | Yes    | No               |
| QA-A03 | Search no-result state renders and remains interactive | Yes     | Yes    | No               |
| QA-A04 | Login form is reachable                                | Yes     | Yes    | No               |
| QA-A05 | Unauthenticated `/admin` returns to `/login`           | Yes     | Yes    | No               |
| QA-A06 | Detect uncaught browser `pageerror` events             | Yes     | Yes    | No               |
| QA-A07 | Detect same-origin application console errors          | Yes     | Yes    | No               |
| QA-A08 | Detect same-origin failed requests                     | Yes     | Yes    | No               |
| QA-A09 | Detect same-origin HTTP 5xx responses                  | Yes     | Yes    | No               |
| QA-A10 | Detect 4xx document/script/stylesheet failures         | Yes     | Yes    | No               |
| QA-A11 | Detect meaningful horizontal viewport overflow         | Yes     | Yes    | No               |

Completed Phase C extends the production field pipeline with accessibility and synthetic-performance coverage; C3 provides deliberate manual/protected authenticated disposable CMS verification. Those completed capabilities do not change the Phase A read-only safety boundary.

## QA scenario library — preserved regression cases

These scenarios remain explicit regression cases. Some are covered by completed C3 or repository functional/unit/API suites; others remain manual production checks when a safe automated production contract is not warranted.

| ID     | Regression scenario                                                      | Current mode                                           |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| QA-R01 | Content Save progress remains visible above editor dialog                | C3/functional coverage + manual production check       |
| QA-R02 | Auth 428 / reauthentication dialog can appear above Save progress        | Existing functional E2E + manual production check      |
| QA-R03 | Facebook thumbnail source fallback reports real attempt progress         | C3/unit/API regression + manual production check       |
| QA-R04 | Facebook thumbnail failure still allows content Save                     | Existing unit/API regression + manual production check |
| QA-R05 | Existing featured media skips automatic thumbnail creation               | Existing unit/API regression + manual production check |
| QA-R06 | Session expiry during an admin write recovers without duplicate mutation | Existing functional coverage + manual production check |
| QA-R07 | CMS desktop/mobile navigation has no blocking overlay or blank route     | Manual                                                 |
| QA-R08 | Slow network does not make long-running Save look frozen                 | Manual                                                 |

## Runtime diagnostics policy

The browser smoke fails on:

- uncaught page errors;
- application-origin console errors, excluding generic browser `Failed to load resource` duplication;
- same-origin request failures other than intentional `net::ERR_ABORTED` cancellation;
- any same-origin HTTP 5xx response;
- HTTP 4xx for a document, script, or stylesheet;
- missing required page UI;
- horizontal overflow beyond a small subpixel tolerance.

Expected unauthenticated API 4xx responses are not treated as browser-smoke failures because `/login` and `/admin` protection can legitimately probe session state without an authenticated user.

## Automatic trigger and Vercel commit-status gate

The workflow listens for completion of the repository `CI` workflow. It runs automatically only when:

- the completed CI run is for `master`; and
- the CI conclusion is `success`.

The workflow then queries the GitHub combined commit status for the same `head_sha`, reads both the `state` and `description` of context `Vercel`, and waits for a non-ignored `success` before running the browser smoke.

Vercel can report a success-like commit status when an Ignored Build Step cancels creation of a new deployment. Phase A now fails closed when the Vercel status description contains `Ignored Build Step`; it does not continue to Playwright and does not treat the currently served older production deployment as exact-SHA evidence. B3 independently distinguishes the same condition in its deployment metadata, and C3 continues to fail closed for its exact-deployment mutable verification.

If the Vercel commit status reports `failure` or `error`, reports an Ignored Build Step, or never reaches an acceptable `success` inside the workflow's bounded wait, Phase A fails closed and does not run the browser smoke.

## Manual fallback

GitHub Actions → `Phase A Production Browser Smoke` → `Run workflow` remains available for deliberate reruns and controlled alternative HTTPS targets.

The default target is `https://www.rcat.ac.th`.

On failure, the workflow keeps Playwright HTML report, trace, and screenshot evidence for seven days. Successful runs do not upload artifacts.

## Relationship to completed reliability phases

Reliability Roadmap v2 is complete.

- Phase A owns deployment-driven automatic read-only browser QA.
- Phase B B1/B2/B3 owns explicit-refresh operator visibility in `/admin/system-health`; it does not replace Phase A scheduling.
- Phase C C1/C2 extended the field pipeline with accessibility and synthetic-performance checks.
- Phase C3 is a manual/protected authenticated disposable CMS regression tool after closure.
- P6C remains a separate bounded six-hour SSR → Worker → D1 reliability guard.

Future reliability work requires a new explicit scope rather than extending completed Phase A/B/C implicitly.

## Completion criteria

Phase A is complete because:

1. the production Playwright configuration is merged;
2. desktop and mobile read-only production scenarios are present;
3. console/page/network diagnostics are enforced;
4. the QA scenario library is stored in the repository;
5. successful `master` CI automatically waits for the matching SHA's Vercel commit-status context, rejects Ignored Build Step statuses, and then runs the production browser smoke only for an acceptable success;
6. manual dispatch remains only a fallback;
7. repository CI and governance remain green.

The hardened Ignored Build Step handling is an operational guard improvement after Phase A closure; it does not reopen the completed reliability roadmap.
