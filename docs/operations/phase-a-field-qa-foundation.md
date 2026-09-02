# Phase A — Field QA Foundation

Updated: 2026-09-03

## Goal

Phase A adds browser-level production verification on top of the existing P6C HTTP/SSR/Worker/D1 reliability smoke. It is intentionally read-only and uses only repository-owned or already-installed free tooling.

The Phase A browser smoke is not a replacement for CI or P6C. It covers failure classes that static analysis and raw HTTP probes cannot reliably detect, including client-side crashes, hydration/runtime errors, critical browser request failures, and viewport-specific layout problems.

The normal Phase A path is automation-first:

1. a change reaches `master`;
2. repository CI completes successfully for that exact commit SHA;
3. the workflow waits for the matching GitHub commit status `Vercel` to report a successful deployment;
4. the production Playwright smoke runs automatically against `https://www.rcat.ac.th`.

`workflow_dispatch` remains available only as an operational fallback for reruns, controlled preview verification, or recovery checks. It is not the primary operating path.

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

Authenticated write scenarios remain manual until a separately isolated test account and disposable data contract are approved.

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

## QA scenario library — preserved regression cases

These scenarios should become automated when their safety prerequisites exist. Until then they remain explicit manual field-QA cases instead of being forgotten after a bug fix.

| ID     | Regression scenario                                                      | Current mode                                           | Automation prerequisite                                   |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------- |
| QA-R01 | Content Save progress remains visible above editor dialog                | Manual + existing unit/E2E regression                  | Isolated authenticated browser session                    |
| QA-R02 | Auth 428 / reauthentication dialog can appear above Save progress        | Existing functional E2E + manual production check      | Safe authenticated production-like session                |
| QA-R03 | Facebook thumbnail source fallback reports real attempt progress         | Existing unit/API regression + manual production check | Disposable content record                                 |
| QA-R04 | Facebook thumbnail failure still allows content Save                     | Existing unit/API regression + manual production check | Disposable content record                                 |
| QA-R05 | Existing featured media skips automatic thumbnail creation               | Existing unit/API regression + manual production check | Disposable content record                                 |
| QA-R06 | Session expiry during an admin write recovers without duplicate mutation | Existing functional coverage + manual production check | Safe disposable mutation target                           |
| QA-R07 | CMS desktop/mobile navigation has no blocking overlay or blank route     | Manual                                                 | Isolated authenticated browser session                    |
| QA-R08 | Slow network does not make long-running Save look frozen                 | Manual                                                 | Browser throttling against isolated authenticated session |

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

## Automatic trigger and deployment gate

The workflow listens for completion of the repository `CI` workflow. It runs automatically only when:

- the completed CI run is for `master`; and
- the CI conclusion is `success`.

The workflow then checks the GitHub combined commit status for the same `head_sha` and waits for context `Vercel` to report `success`. This prevents browser QA from racing ahead of the production deployment and prevents a later commit's deployment from being mistaken for the commit under test.

If the matching Vercel deployment reports `failure` or `error`, or never reaches a successful state inside the workflow's bounded wait, Phase A fails closed and does not run the browser smoke against an unconfirmed deployment.

## Manual fallback

GitHub Actions → `Phase A Production Browser Smoke` → `Run workflow` remains available for deliberate reruns and controlled alternative HTTPS targets.

The default target is `https://www.rcat.ac.th`.

On failure, the workflow keeps Playwright HTML report, trace, and screenshot evidence for seven days. Successful runs do not upload artifacts.

## Relationship to later phases

Phase A now owns automatic read-only browser verification after successful production deployment. It remains separate from the existing six-hour P6C reliability schedule: P6C is an unattended periodic reliability checkpoint, while Phase A is deployment-driven browser QA.

Phase B can reuse the same scenario IDs and diagnostics vocabulary in `/admin/system-health` and runtime error reporting.

Later phases may extend the same automation chain with authenticated disposable-data scenarios, performance budgets, or accessibility checks without reverting the normal path to manual execution.

## Completion criteria

Phase A is complete when:

1. the production Playwright configuration is merged;
2. desktop and mobile read-only production scenarios are present;
3. console/page/network diagnostics are enforced;
4. the QA scenario library is stored in the repository;
5. successful `master` CI automatically waits for the matching successful Vercel deployment and then runs production browser smoke;
6. manual dispatch remains only a fallback;
7. repository CI and governance remain green.
