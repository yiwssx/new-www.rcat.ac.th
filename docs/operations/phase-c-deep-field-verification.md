# Phase C Deep Field Verification

Status: active.

Started: 2026-09-04.

## Goal

Phase C extends the completed development-quality, field-QA, and operational-visibility baseline with deeper production verification without reopening P6 or introducing paid observability/browser services.

## C1 — Automated accessibility

Status: validation in progress.

The production Playwright suite audits representative public routes plus the unauthenticated Admin boundary on the existing desktop/mobile Chromium projects. The field audit is read-only and checks a bounded semantic baseline: document language/title, public h1 structure, image alt attributes, form-control labels, interactive accessible names, duplicate IDs, and positive tabindex values.

C1 reuses `.github/workflows/phase-a-production-browser-smoke.yml` and `playwright.production.config.ts`. No commercial browser service, production credential, or mutable CMS operation is required.

## C2 — Synthetic performance regression

Status: planned.

Add bounded release-oriented synthetic budgets that complement the repository build-time performance governance and existing Vercel Speed Insights/Web Analytics.

## C3 — Authenticated disposable CMS field test

Status: planned.

C3 must establish an isolated QA identity and a deterministic disposable-data lifecycle before authenticating against a field environment. Normal Admin credentials must not be committed to test code and ordinary production content must not be mutated merely to prove the test.

## Closure rule

Phase C closes only when C1, C2, and C3 have merged implementation plus passing repository/field evidence, with deterministic cleanup for every mutable C3 test artifact.
