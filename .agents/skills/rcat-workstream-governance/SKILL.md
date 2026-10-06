---
name: rcat-workstream-governance
description: RCAT-specific execution governance for multi-step, multi-PR, resumed, CI-gated, release-adjacent, or long-running repository work. Use when continuing phases/waves/tasks, creating or updating workstream trackers, reconciling branch/PR/CI state, deciding whether work is actually complete, or handing work across sessions.
metadata:
  owner: rcat
  version: '1.0.0'
---

# RCAT Workstream Governance

Use this skill to execute repository work as a durable state machine instead of relying on chat history.

Root `AGENTS.md`, the current repository/GitHub state, and current canonical project-state documents are authoritative. This skill narrows those rules into an execution procedure; it never overrides them.

## Trigger this skill when

- the user says continue/resume/finish a phase, wave, task sequence, or existing branch;
- work spans multiple dependent steps, multiple PRs, or more than one session;
- a tracker under `docs/workstreams/` exists or should exist;
- CI, release, deployment, migration, or production verification determines completion;
- current branch/PR/SHA/status must be reconciled before deciding the next action;
- a previous response was interrupted and durable progress must be recovered.

Do not create a tracker for a small one-shot change that can be implemented and verified atomically.

## Canonical state sources

Read only the sources relevant to the current task, in this order:

1. current GitHub branch, PR, commit, and Actions state;
2. root `AGENTS.md`;
3. exactly one matching active tracker under `docs/workstreams/`, when one exists;
4. `docs/architecture/current-project-state.md`;
5. the current release baseline under `docs/releases/` when release state matters;
6. the implementation, tests, workflows, and operational docs for the affected area.

Historical trackers, dated audits, and old conversation state are evidence, not authority, when newer current-state sources supersede them.

## Bootstrap procedure

Before changing code or project state:

1. Identify the current/default branch and the task branch.
2. Inspect open PRs relevant to the task and confirm their actual heads.
3. Inspect current CI for the exact head SHA rather than assuming an older run still applies.
4. Search `docs/workstreams/` for a matching `Status: **ACTIVE**` tracker.
5. If exactly one matching tracker exists, read it and reconcile it with GitHub.
6. If the task will span multiple PRs/sessions and no tracker exists, create a concise tracker.
7. Establish scope, out-of-scope items, acceptance criteria, and any production boundary before implementation.

Never ask the user to restate progress that can be reconstructed from these sources.

## Tracker contract

A workstream tracker should contain only durable execution state:

- status;
- scope and explicit out-of-scope items;
- ordered tasks/checkpoints;
- authoritative branch, PR, and relevant SHA references;
- completed / in-progress / pending / blocked state;
- decisions and constraints that affect later work;
- verification evidence;
- exact next action when blocked or waiting.

Do not paste secrets, verbose logs, chat narrative, raw stack traces, or temporary speculation into the tracker.

Update the tracker whenever:

- a task changes state;
- a branch/PR/SHA becomes authoritative;
- CI verification materially changes;
- a blocker is found or cleared;
- a decision changes;
- a release/deployment/migration boundary changes;
- a response ends after meaningful repository work.

## Execution rules

- Prefer small scoped branches and commits.
- Do not reopen a completed historical workstream because an old document says it was once pending.
- Do not mark code as complete merely because files exist.
- Do not merge through a failing required gate.
- Do not weaken a quality, dependency, security, bundle, governance, or release threshold merely to make a branch green.
- Distinguish a task regression from an inherited repository blocker before changing scope.
- If an inherited blocker prevents required CI, fix it only when the remediation is safe, narrow, and consistent with repository policy; otherwise record the blocker.
- Do not repeat a deployment, migration, production verification, or protected operation that newer state proves already completed.
- Keep production mutations separate from implementation unless the user explicitly authorized the production action.

## CI and verification

The current workflow definitions are authoritative. Do not hard-code an old lane inventory into task logic.

For a normal repository PR:

1. verify the exact head SHA;
2. inspect all required jobs/checks;
3. investigate each failure at the failing step/log;
4. fix root cause without bypassing the gate;
5. require the current head to satisfy repository-required CI/governance before merge.

When the change affects an area with additional gates, run or require those gates too. Examples include Worker/D1, SSR, Admin editor bundle, design governance, or production-readiness checks.

## External waits

Follow root `AGENTS.md` bounded-wait rules.

- Capture the external run/deployment identifier.
- Avoid unbounded polling.
- If the external system remains pending at the response boundary, write the durable waiting state and exact next check into the tracker.
- On resume, re-read the live state; do not restart work simply because the earlier response ended.

## Completion semantics

A workstream can be marked complete only when its acceptance criteria are met and the tracker contains the evidence required by that workstream.

Typical completion evidence includes:

- implementation merged to the intended base;
- required CI/governance green on the authoritative head;
- migration/deployment/production verification only when explicitly in scope;
- release/tag only when the workstream requires them;
- tracker status updated to `COMPLETE` with final branch/PR/SHA evidence.

Do not infer release or production completion from a successful code merge alone.

## Anti-patterns

Do not:

- resume from conversational memory without checking GitHub;
- maintain competing active trackers for the same scope;
- copy fast-changing PR or deployment state into root `AGENTS.md`;
- merge red PRs because the failure looks unrelated without resolving or formally handling the blocker;
- spin on CI/deploy status indefinitely;
- restart completed production operations;
- bundle unrelated feature work into a maintenance workstream.

## Related skills

Use together with the domain skill for the implementation area:

- `rcat-cloudflare-d1` for Worker/D1 work;
- `rcat-admin-ui` for Admin UI work;
- `rcat-public-routing-ssr` for Public routing/SSR work;
- vendored security, accessibility, Vite, Vitest, Router/Query, architecture, and Worker skills as applicable.
