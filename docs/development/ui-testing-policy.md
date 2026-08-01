# UI Testing Policy

Updated: 2026-08-01.

This document defines the feedback-loop policy for UI/UX changes in this repository.

## Problem

A small UI change must not require an hour-scale first test run.

Broad UI verification can become dominated by full repository suites, render-heavy component tests, debounced query state, fake-timer interactions, query retries, repeated global setup, and unrelated browser suites.

A previous workflow still exceeded approximately 15 minutes after partial optimization and was terminated by an external timeout. The correct response is not to raise the timeout indefinitely. The first validation loop must be reduced to the changed behavior.

## Principle

Use the smallest test layer that can prove the behavior:

1. pure unit test;
2. focused component test;
3. focused integration test;
4. focused browser test;
5. broad suite;
6. release suite.

Do not invert this order for routine UI edits.

## Pure Logic First

Move deterministic UI transformation logic into pure modules when it has no rendering dependency.

Examples include menu tree construction, flattening, sibling ordering, URL normalization, filtering, label lookup, and simple payload mapping.

Pure tests avoid DOM, MUI mounts, QueryClient, timers, and network mocks.

## Component Tests

Component tests should verify rendering and interaction only: hierarchy, controls, dialogs, selections, mutation payloads, and visible error/result state.

Avoid using component tests to re-prove pure sorting/string logic.

## Timers

Do not introduce fake timers unless production behavior genuinely depends on time.

If fake timers are required:

- restore real timers in cleanup;
- advance only the required interval;
- avoid unnecessary `userEvent` delay plus fake timers;
- ensure intervals/listeners are cleaned up.

A UI test that does not need debounce or polling should not inherit them from a generic abstraction.

## TanStack Query

For focused component tests:

- disable retries unless retry behavior is the test;
- use isolated `QueryClient` instances;
- avoid long stale/refetch loops;
- mock only the API boundary required by the component;
- wait for one deterministic UI condition rather than sleeping.

Never use arbitrary multi-second sleeps as correctness.

## Admin Menu Specific Policy

Focused command:

```bash
pnpm exec vitest run src/admin/pages/menuPageModel.test.ts src/admin/pages/MenuPage.test.tsx
```

The primary Menu UI test must not depend on server pagination, debounced search, 15-minute watchdogs, browser navigation, or full project fixtures.

## Recommended Validation Ladder

### Stage 1 — changed tests

```bash
pnpm exec vitest run <affected-test-files>
```

### Stage 2 — build/type safety

```bash
pnpm build
```

### Stage 3 — repository format/lint

```bash
pnpm format:check
pnpm lint:strict
```

### Stage 4 — broader unit/integration

```bash
pnpm test:unit
pnpm test:integration
```

### Stage 5 — functional/browser

```bash
pnpm test:functional
```

### Stage 6 — release gates

```bash
pnpm quality
pnpm quality:full
pnpm quality:release
```

These broad gates are not the default first test after editing one component.

## Timeout Policy

A timeout is a failure signal, not a success criterion.

Do not make a hanging test acceptable by repeatedly increasing Vitest, Playwright, CI, or external execution timeouts.

When a focused UI test approaches minute-scale runtime:

1. identify open handles;
2. inspect retries/timers;
3. split pure logic from rendered tests;
4. remove unrelated global fixtures;
5. reduce query/network orchestration;
6. run the test alone and measure again.

## Regression Coverage

Optimization must not delete meaningful coverage. Move coverage to the correct layer instead.

For Menu, prefer separate pure tree/URL tests plus small component tests rather than one large test that waits through pagination, debounce, edit, reorder, delete, and refetch behavior.

## CI and Reporting

This policy does not remove repository quality gates. It improves the development feedback loop before expensive suites run.

Report exact commands that actually ran. Do not claim a full suite passed when only focused tests ran. If a broad suite was stopped by an external timeout, state that explicitly and report the focused evidence that completed.
