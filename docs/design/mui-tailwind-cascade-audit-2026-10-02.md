# MUI + Tailwind CSS v4 Cascade Audit

Date: 2026-10-02

Status: complete. Runtime migration, deployment-level preview verification, and durable boundary documentation are closed through PRs #472–#475.

## Scope

This document preserves the pre-change baseline and records the completed Material UI + Tailwind CSS v4 cascade-layer migration. The migration was deliberately split across separate pull requests so agent guidance, the CSS contract, runtime/SSR integration, and deployment verification could be reviewed independently.

The baseline sections below remain historical evidence. The active architecture is described under **Current implementation** and in `docs/design/mui-tailwind-boundary.md`.

## Current stack

The repository uses:

- Material UI `^9.4.0`
- Material UI Icons `^9.4.0`
- Tailwind CSS `^4.3.3`
- `@tailwindcss/postcss` `^4.3.3`
- Emotion cache/react/server/styled `11.x`
- React `^19.3.0`
- Vite `^8.3.0`
- TanStack Router SSR

`postcss.config.cjs` runs `@tailwindcss/postcss`. The project is on the Tailwind v4 path; Tailwind v3 interoperability guidance is not applicable to the runtime architecture.

## Existing ownership boundary

`src/design-system/tokens.ts` remains the canonical semantic design-token source. The policy in `docs/design/mui-tailwind-boundary.md` separates responsibilities deliberately:

- MUI owns interactive controls, forms, component state, focus behavior, dialogs, drawers, menus, tables, tabs, pagination, and dense Admin workflows.
- Tailwind/RCAT utilities own broad page layout, responsive containers, section spacing, simple static wrappers, print, and prose structure.
- A surface must not receive competing border, radius, shadow, focus, state, or the same responsive/layout property from both systems.

The cascade-layer integration strengthens this boundary; it does not permit unrestricted Tailwind overrides of MUI internals.

## Pre-change CSS baseline

Before PR B/PR C, `src/styles.css` imported Tailwind directly and did not declare the Material UI layer order:

```css
@import "tailwindcss";
```

Several application rules were unlayered, including `:root`, the universal selector, `html`, `body`, `a`, `#root`, `.table-scroll`, `.content-summary`, `.form-shell`, `#status`, and `@keyframes cardIn`.

This mattered because normal unlayered author CSS outranks normal author CSS inside named cascade layers. Enabling `@layer mui` without classifying those rules could have silently changed precedence.

## Pre-change runtime and SSR baseline

The application was already using one runtime-owned Emotion cache for both server and client rendering:

- `src/main.tsx` imports `src/styles.css` and delegates mounting to `mountClientApp`.
- `src/entry-client.tsx` creates an application runtime and passes its Emotion cache through the shared provider tree.
- `src/entry-server.tsx` creates the same runtime shape for SSR and finalizes HTML through `createEmotionSsrResponseFinalizer`.
- `src/runtime.ts` creates one `emotionCache` per application runtime through `createAppEmotionCache()`.
- `src/emotionSsr.ts` extracts critical styles from that exact runtime cache.

The cache originally used the repository key only:

```ts
createCache({ key: "css" });
```

A generic client-only `StyledEngineProvider enableCssLayer` integration would therefore have risked creating a second styling path that SSR extraction did not own.

## Current implementation

The active author-layer contract is:

```css
@layer theme, base, mui, components, utilities;
```

The responsibilities are:

1. `theme` — Tailwind/theme declarations and RCAT token aliases.
2. `base` — intentionally classified global/reset rules.
3. `mui` — Material UI/Emotion component styles.
4. `components` — RCAT structural/static component classes.
5. `utilities` — Tailwind utilities, constrained by the repository ownership policy.

`src/styles.css` declares the order before the Tailwind import, maps RCAT aliases in `theme`, places global/reset rules in `base`, and places RCAT structural rules in `components`.

`src/emotionCache.ts` keeps `APP_EMOTION_CACHE_KEY = "css"` and wraps Emotion-generated styles in `@layer mui`. Explicit layer-order declarations are preserved instead of being wrapped. Server and client use the same cache factory, so SSR critical CSS extraction and CSR hydration observe the same MUI layer ownership.

No `StyledEngineProvider`, second Emotion cache, new styling dependency, or `--mui-*` semantic token bridge was introduced.

Layer order is deterministic cascade machinery, not permission to define one property twice. The PR C regression on the CMS shell demonstrated this directly: a Tailwind `w-full` declaration and responsive MUI `sx.width` on the same flex item competed after layering. The fix removed duplicate width ownership and added `minWidth: 0` so the MUI-controlled flex main can shrink correctly.

## Token policy

The upstream skill documents a `--mui-*` to Tailwind `@theme` bridge. RCAT does not adopt that bridge as a second source of truth.

The canonical direction remains:

```text
src/design-system/tokens.ts
        ↓
MUI theme + designTokenCssVariables
        ↓
RCAT CSS variables
        ↓
Tailwind @theme aliases where needed
```

Material UI CSS variables may be used later only where there is a demonstrated integration need. They must not replace RCAT semantic tokens or create duplicate semantic color/spacing/shape authorities.

## Agent-skill adoption

The official `mui/material-ui` `material-ui-tailwind` skill is vendored under `.agents/skills/material-ui-tailwind/` from pinned upstream commit `0cb3c247c59d960e15216ebc4c2e12538b750804`.

The upstream files remain unmodified. Repository-specific constraints live in root `AGENTS.md` and `docs/design/mui-tailwind-boundary.md` so upstream updates remain reviewable and local policy is not hidden inside a forked skill.

The skill is guidance, not the highest repository authority. RCAT-specific architecture, SSR, design-token, accessibility, security, and quality rules take precedence over generic snippets.

## Migration work and gates

### PR A — baseline and guidance — complete (#472)

- Vendored the pinned official Material UI skill.
- Recorded upstream provenance and this audit.
- Added the RCAT-specific skill overlay to root `AGENTS.md`.
- Made no runtime or CSS behavior change.

### PR B — cascade contract scaffolding — complete (#473)

- Declared `@layer theme, base, mui, components, utilities;` before Tailwind processing.
- Reserved the `mui` layer without yet changing Emotion output.
- Added focused regression coverage for the exact order and placement.

### PR C — atomic CSS classification and MUI/Emotion integration — complete (#474)

- Classified RCAT/global rules into named layers.
- Wrapped MUI/Emotion output in `@layer mui` through the existing shared runtime cache.
- Preserved the Emotion cache key, SSR critical CSS extraction, hydration path, token source, and repository ownership boundary.
- Added layer-contract, SSR, hydration, and architecture regression coverage.
- Removed the conflicting CMS `w-full` ownership exposed by functional E2E and retained MUI responsive width ownership with `minWidth: 0`.

PR #474 merged as `aee7a3931fce5b3280155f298988f8c9f8b1c57c`. Its post-merge CI run #3072 completed successfully, followed by Production Verification run #92. The read-only browser field QA waited for the matching Vercel production deployment and completed successfully without mutating production data.

### PR D — preview, production verification, and closure — complete (#475)

The repository intentionally disables Git deployments for non-`main` branches and skips documentation-only Vercel builds. To obtain a real deployment-level preview without weakening that policy globally, PR D temporarily enabled only `docs/close-mui-tailwind-cascade-migration` and used a semantic-no-op CSS comment to force one preview build.

Verification snapshot:

- Git SHA: `43985acaf9963ef1038a52ad511fd240f933603c`
- Vercel deployment: `dpl_547Dp1AnuN27oChGVZjGoMC2tanw`
- Target: Preview; deployment reached `READY` for the exact PR branch/head.
- Read-only HTTP verification returned `200` for `/`, `/news`, `/login`, and `/admin/content`.
- `/news` returned SSR HTML with Emotion critical CSS emitted inside `@layer mui`.
- `/login` and `/admin/content` retained the expected CSR/no-store/noindex boundary.
- Functional E2E on the same PR snapshot completed successfully.
- No production CMS content or production data was mutated.

The first verification snapshot also proved the static layer guard was effective: placing a comment before the canonical `@layer` statement caused `muiTailwindLayerContract.test.mjs` to fail because the repository requires the layer declaration to be the first statement. The comment was removed rather than weakening the test.

Before protected merge, both temporary verification-only changes were fully reverted:

- `src/styles.css` again begins exactly with the canonical layer declaration.
- `vercel.json` again enables Git deployment only for `main` with all other branches disabled.
- The final PR merge diff contains documentation only; no styling runtime, Vercel policy, dependency, Worker/API/D1/auth, or production-data change remains.

The protected PR CI is the merge gate for the final documentation head. After merge, normal `main` CI and the repository's Production Verification workflow provide the immutable operational closeout record in GitHub Actions; exact run identities remain in repository history rather than requiring a follow-up documentation-only PR.

## Regression risks retained as permanent review checks

1. Unlayered CSS unintentionally outranking the `mui` layer.
2. Tailwind utilities gaining authority over MUI internals where the RCAT boundary forbids it.
3. A second Emotion cache being introduced by a provider and escaping SSR extraction.
4. Server/client layer order differing during hydration.
5. CssBaseline/global focus policy changing relative to Tailwind preflight.
6. Portal-based components rendering with a different styling context.
7. Token duplication through an unnecessary `--mui-*` bridge.
8. The same layout property being declared by both Tailwind `className` and MUI `sx` on one element.
9. Broad refactors being mixed into styling infrastructure changes and obscuring regressions.

## Non-goals

This migration does not:

- redesign the public site or Admin UI;
- replace MUI with Tailwind or Tailwind with MUI;
- replace `src/design-system/tokens.ts`;
- add a new styling dependency;
- change Worker, D1, Apps Script, authentication, or production data;
- create a new permanent GitHub Actions workflow;
- use Tailwind v3 `important`, `injectFirst`, or portal-container workarounds.
