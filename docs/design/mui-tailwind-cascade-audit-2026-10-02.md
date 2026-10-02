# MUI + Tailwind CSS v4 Cascade Audit

Date: 2026-10-02

## Scope

This document records the pre-change baseline for adopting the official Material UI + Tailwind CSS v4 cascade-layer integration. It is intentionally documentation-only: this audit does not change runtime styling, CSS precedence, SSR behavior, or production output.

The implementation is split across separate pull requests so a cascade regression can be isolated from agent-guidance and SSR/Emotion changes.

## Current stack

The repository currently uses:

- Material UI `^9.4.0`
- Material UI Icons `^9.4.0`
- Tailwind CSS `^4.3.3`
- `@tailwindcss/postcss` `^4.3.3`
- Emotion cache/react/server/styled `11.x`
- React `^19.3.0`
- Vite `^8.3.0`
- TanStack Router SSR

`postcss.config.cjs` runs `@tailwindcss/postcss`. The project is already on the Tailwind v4 path; Tailwind v3 interoperability guidance is not applicable to the runtime architecture.

## Existing ownership boundary

`src/design-system/tokens.ts` remains the canonical semantic design-token source. The current policy in `docs/design/mui-tailwind-boundary.md` separates responsibilities deliberately:

- MUI owns interactive controls, forms, component state, focus behavior, dialogs, drawers, menus, tables, tabs, pagination, and dense Admin workflows.
- Tailwind/RCAT utilities own broad page layout, responsive containers, section spacing, simple static wrappers, print, and prose structure.
- A surface must not receive competing border, radius, shadow, focus, or state ownership from both systems.

The cascade-layer integration must strengthen this boundary, not replace it with unrestricted Tailwind overrides of MUI internals.

## CSS baseline

`src/styles.css` currently imports Tailwind directly and does not declare the Material UI layer order:

```css
@import "tailwindcss";
```

The file already contains `@theme inline`, `@utility`, and `@layer components`, but several application rules remain unlayered. The current unlayered groups include:

- `:root`
- universal `*`
- `html`
- `body`
- `a`
- `#root`
- `.table-scroll`
- `.content-summary`
- `.form-shell`
- `#status`
- `@keyframes cardIn`

This matters because normal unlayered author CSS has precedence over normal author CSS inside named cascade layers. Enabling `@layer mui` before classifying these rules could therefore change which RCAT/global rules win against MUI styles.

## Runtime and SSR baseline

The application is not a simple client-only Vite tree.

`src/main.tsx` imports `src/styles.css` and delegates mounting to `mountClientApp`.

`src/entry-client.tsx` creates an application runtime and supports both document hydration and root hydration. It passes the runtime-owned Emotion cache to the shared `AppProviders` tree.

`src/entry-server.tsx` creates the same runtime shape for SSR, renders the same `AppProviders`, then finalizes the HTML through `createEmotionSsrResponseFinalizer` before adding CSP headers.

`src/runtime.ts` creates one `emotionCache` per application runtime through `createAppEmotionCache()`.

`src/emotionCache.ts` currently creates the cache with the repository key only:

```ts
createCache({ key: "css" });
```

`src/emotionSsr.ts` creates the Emotion server instance from that exact runtime cache and extracts critical styles from the rendered HTML.

### Consequence

The generic Vite example from the Material UI skill cannot be copied blindly into `src/main.tsx`. If a `StyledEngineProvider` were to introduce or redirect MUI styles to a different Emotion cache while SSR extraction continued to inspect only the runtime cache, server-rendered MUI styles could be omitted or ordered differently from client styles.

The eventual MUI layer implementation must therefore preserve a single coherent cache/insertion strategy across SSR and CSR, including CSP nonce handling and hydration behavior.

## Target cascade contract

The intended Tailwind v4 layer order is:

```css
@layer theme, base, mui, components, utilities;
```

The architectural meaning for this repository is:

1. `theme` — Tailwind/theme declarations and token plumbing.
2. `base` — intentionally classified global/reset rules.
3. `mui` — Material UI/Emotion component styles.
4. `components` — RCAT structural component classes that are allowed to follow MUI in the cascade.
5. `utilities` — Tailwind utilities, available as the final utility layer while still constrained by the RCAT ownership policy.

Layer order is a deterministic cascade mechanism. It is not permission to mix both styling systems on the same interactive surface.

## Token policy

The upstream skill documents a `--mui-*` to Tailwind `@theme` bridge. RCAT will not adopt that bridge as a second source of truth.

The existing direction remains canonical:

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

### PR A — baseline and guidance

- Vendor the pinned official Material UI skill.
- Record upstream provenance.
- Record this audit.
- Add the RCAT-specific skill overlay to root `AGENTS.md`.
- No runtime or CSS behavior change.

### PR B — cascade contract scaffolding

- Declare the target layer order before Tailwind processing.
- Reserve the `mui` layer in the contract without enabling MUI layer emission yet.
- Keep existing RCAT/global unlayered selectors unchanged in this PR so style-precedence changes are not split across two migrations.
- Add a focused repository check for the canonical layer order.

Gate: no intentional UI redesign, no MUI/Emotion cache change, and no deliberate reclassification of existing application selectors.

### PR C — atomic CSS classification and MUI/Emotion integration

- Inspect Material UI v9's actual `enableCssLayer` implementation before changing providers.
- Classify the existing RCAT/global rules into their intended named layers in the same change that MUI begins emitting into `@layer mui`.
- Integrate MUI layer emission with the repository's shared runtime-owned Emotion cache rather than creating a client-only styling path.
- Keep server and client configuration identical.
- Preserve Emotion critical CSS extraction, CSP nonce behavior, hydration, portals, focus styling, and existing component-theme overrides.
- Add SSR/hydration and representative MUI/Tailwind regression coverage.

Gate: full repository quality/design checks and functional coverage must pass before merge.

### PR D — preview and production verification

- Verify representative Public and Admin surfaces on a Vercel preview.
- Check responsive layout, forms, dialogs/menus/portals, focus-visible behavior, tables, and representative Tailwind structural wrappers.
- Confirm no hydration/style-order errors in the verified build.
- Merge only after the normal protected branch gates pass.
- Verify the resulting production deployment read-only; do not mutate production content merely to validate styling.
- Complete documentation/cleanup only after the production result is known.

## Regression risks to watch

1. Unlayered CSS unintentionally outranking the new `mui` layer.
2. Tailwind utilities gaining authority over MUI internals where the RCAT boundary forbids it.
3. A second Emotion cache being introduced by a provider and escaping SSR extraction.
4. Server/client layer order differing during hydration.
5. CssBaseline/global focus policy changing relative to Tailwind preflight.
6. Portal-based components rendering with a different styling context.
7. Token duplication through an unnecessary `--mui-*` bridge.
8. Broad refactors being mixed into the cascade migration and obscuring regressions.

## Non-goals

This migration does not:

- redesign the public site or Admin UI;
- replace MUI with Tailwind or Tailwind with MUI;
- replace `src/design-system/tokens.ts`;
- add a new styling dependency;
- change Worker, D1, Apps Script, authentication, or production data;
- create a new permanent GitHub Actions workflow;
- use Tailwind v3 `important`, `injectFirst`, or portal-container workarounds.
