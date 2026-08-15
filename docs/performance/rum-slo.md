# Real-User Monitoring And Performance SLO

Updated: 2026-08-15.

RCAT uses Vercel Web Analytics and Speed Insights through the existing lazy Public telemetry boundary so performance decisions can combine build-time governance with real-user field data. P3 formalizes the operating objectives and review process without adding another observability provider or changing telemetry route ownership.

## Scope

The first SLO scope is the public web experience served by Vercel. Admin, CMS authentication, Cloudflare Worker internals, Apps Script, and D1 have separate operational boundaries and must not be inferred from Core Web Vitals alone.

The existing build-time performance budget remains mandatory. RUM does not replace bundle, layout, media, or design governance; it adds field evidence about what real browsers experience.

## Core Web Vitals Objectives

Use the Vercel Speed Insights p75 value as the operating signal for representative production traffic.

| Metric | Initial objective | Interpretation                       |
| ------ | ----------------- | ------------------------------------ |
| LCP    | <= 2.5 s          | Main content becomes visible quickly |
| INP    | <= 200 ms         | User interactions remain responsive  |
| CLS    | <= 0.10           | Layout remains visually stable       |

These are engineering objectives, not contractual guarantees. Segment mobile and desktop when enough samples exist; do not hide a poor mobile distribution behind a blended aggregate.

## Decision Rules

1. Do not optimize a route solely from a single synthetic run when representative RUM shows no user impact.
2. Do not ignore a sustained p75 regression merely because the static bundle budget still passes.
3. Treat a regression as actionable when it persists across representative traffic or correlates with a known release/change.
4. Prefer route-level evidence before broad framework or architecture changes.
5. Preserve privacy: do not add custom telemetry containing credentials, cookies, session identifiers, CSRF/MFA tokens, password-reset/invitation tokens, complaint content, email addresses, or arbitrary query strings.

## Release Review

After a runtime-impacting production release:

1. Confirm the deployment is READY and points at the intended `master` SHA.
2. Review runtime errors first.
3. Review Speed Insights after enough production samples exist.
4. Compare LCP, INP, and CLS against the objectives above and the previous stable period.
5. If a metric regresses, identify the affected route/device class before changing global budgets.

A release does not fail merely because field telemetry has not accumulated enough samples yet. Lack of samples must be reported as insufficient evidence rather than interpreted as a passing SLO.

## Relationship To CSP

Vercel Analytics and Speed Insights remain dynamically loaded by the Public telemetry boundary and use privacy sanitizers defined by the existing telemetry implementation. CSP enforcement remains a separate evidence gate; the SLO contract is not permission to move telemetry into the synchronous application graph or weaken CSP directives.

## Review Cadence

Review RUM at least monthly and after material frontend/runtime changes. Record meaningful regressions and corrective actions in the associated pull request or incident record instead of creating a second mutable performance baseline in this document.
