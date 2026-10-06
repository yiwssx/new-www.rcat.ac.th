---
name: rcat-admin-ui
description: RCAT-specific Admin UI/UX guidance for React, Material UI, Tailwind, responsive layouts, dialogs, tables, row actions, forms, operation feedback, loading/error/empty states, accessibility, design tokens, icons, and Admin bundle governance.
metadata:
  owner: rcat
  version: '1.0.0'
---

# RCAT Admin UI

Use this skill for Admin frontend changes so new UI follows the existing RCAT design-system boundary and operational UX contracts.

Also load `frontend-accessibility-best-practices`, `material-ui-tailwind`, and `vercel-react-best-practices` when applicable.

## Trigger this skill when

- editing `src/admin/`;
- adding/changing Admin pages, dialogs, forms, tables, filters, pagination, row actions, toolbars, editors, pickers, or settings;
- fixing responsive overflow, clipped actions, hidden controls, cramped tables, or mobile/tablet Admin UX;
- changing loading, empty, error, destructive, or success behavior;
- changing MUI/Tailwind ownership, design tokens, icons, focus behavior, or Admin bundle composition.

## Canonical sources

Read the relevant current files:

- root `AGENTS.md`;
- `docs/design/mui-tailwind-boundary.md`;
- `src/design-system/tokens.ts`;
- `src/design-system/componentStyles.ts`;
- `src/theme.ts`;
- `src/styles.css`;
- `docs/design/icon-system.md`;
- completed Admin UX tracker/docs only as regression evidence;
- current Admin page/component tests;
- Admin editor bundle governance scripts when editor code is affected.

Do not duplicate fast-changing token values inside this skill.

## MUI/Tailwind ownership

RCAT uses both systems, but one element must not have competing owners.

MUI owns:

- controls and control state;
- forms, validation, helper text, Selects;
- dialogs, drawers, menus, popovers, tooltips;
- tables, filters, tabs, pagination;
- dense Admin widgets;
- hover/selected/focus-visible/disabled/error/loading/destructive states;
- component-local responsive behavior via `sx`.

Tailwind/RCAT structural utilities own:

- page/container structure;
- broad responsive layout;
- section spacing;
- simple static wrappers;
- prose/print/static content layout.

Do not express the same border, radius, shadow, focus, overflow, width, or breakpoint behavior in both `className` and `sx` on the same element.

Use `src/design-system/tokens.ts` as the semantic source instead of local color/spacing literals.

## Responsive Admin contract

Admin controls must remain reachable without browser zoom tricks.

For tables, toolbars, and action clusters:

- the full page must not horizontally overflow because of row actions;
- intentionally wide data tables may scroll inside an explicit table scroll container;
- View/Edit/Delete and equivalent primary row actions must not be clipped behind the viewport or a fixed column;
- prefer responsive composition over shrinking controls below usable target sizes;
- on narrow widths, allow action groups to wrap, collapse to an accessible menu, or move into a responsive detail/card pattern when that better preserves readability;
- keep destructive actions visually and semantically distinct;
- every icon-only action requires an accessible name;
- do not hide an operation merely because the viewport is small.

Validate at representative desktop, tablet, and narrow mobile widths whenever layout behavior changes.

## Admin operation feedback

All Admin write operations follow the root feedback standard:

- blocking loading modal while pending;
- centered success modal requiring acknowledgment;
- centered error modal requiring acknowledgment;
- no short auto-dismiss toast as the final result of a write.

Preserve this for content, media, documents, menu, users, calendar, carousel, e-service, settings, and new comparable write surfaces.

Read-only filters/navigation may use lighter feedback where existing patterns support it.

## Dialog and form behavior

- Keep labels, validation, helper text, and errors visible and associated with their fields.
- Preserve keyboard navigation and predictable focus.
- On open, focus a meaningful control or dialog container according to current patterns.
- On close, return focus to the trigger when practical.
- Do not let sticky headers/footers cover active fields or action buttons.
- Destructive confirmation must clearly identify the action/target and must not default focus to a destructive control without reason.
- Preserve unsaved-state and revision/conflict semantics where the current feature uses them.

## Loading, empty, error, and disabled states

Every data-driven Admin surface should deliberately define:

- initial loading;
- refetch/in-flight mutation behavior;
- empty data;
- recoverable error;
- permission/disabled state where relevant.

Do not leave a blank panel as the error or empty state.

Avoid layout shifts that move destructive/primary actions unexpectedly while data loads.

## Icons and interaction styling

- Use direct per-icon imports.
- Use the MUI Outlined family for semantic application icons unless an established state/geometry exception applies.
- Reuse design-system focus and interactive-surface helpers rather than inventing local focus outlines.
- Preserve canonical target sizes and density rules from the theme/tokens.
- Do not use decorative institutional accent colors as normal foreground text when the token system provides the correct semantic role.

## Performance and bundle governance

Admin editor/media features can be heavy.

- preserve current route/component lazy-loading boundaries;
- do not pull editor/media dependencies into unrelated Admin entry paths;
- avoid broad barrel imports that grow the Admin bundle;
- keep React Query cache/invalidation semantics correct before optimizing renders;
- if editor composition changes, run the repository Admin editor bundle governance check and relevant tests;
- do not raise bundle budgets solely to make a regression pass.

## Verification

For changed Admin UI, use the current relevant subset of:

- component/unit tests;
- accessibility/focus/interaction tests;
- responsive functional/E2E tests where layout is affected;
- `pnpm lint:strict`;
- `pnpm design:check`;
- `pnpm build`;
- editor bundle check when editor code/dependencies are affected;
- normal repository CI/governance.

A visual fix is not complete if required actions remain inaccessible at supported viewport sizes.

## Anti-patterns

Do not:

- use browser zoom as the solution to clipped UI;
- solve overflow by making text/controls illegibly small;
- duplicate MUI surface styling with RCAT/Tailwind card classes;
- hide row actions without an accessible replacement;
- use toast-only write completion;
- hard-code arbitrary focus rings or colors;
- introduce a second design token source;
- break SSR/Emotion/CSP behavior to resolve a local style issue.

## Related skills

- `rcat-workstream-governance` for multi-step UI work;
- `frontend-accessibility-best-practices`;
- `material-ui-tailwind`;
- `vercel-react-best-practices`;
- `security-guidance` for Admin auth/input/data changes.
