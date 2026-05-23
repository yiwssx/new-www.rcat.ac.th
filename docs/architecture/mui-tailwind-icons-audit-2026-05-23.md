# MUI, Tailwind, and Icon Audit

Date: 2026-05-23

## Scope

This audit covers the current frontend styling and icon dependency strategy for the React CMS and public website. It does not change UI behavior, backend behavior, Apps Script logic, auth, analytics, site-view tracking, routing, carousel, IntroGate, or CMS schema.

## Searches Run

```text
rg "@fortawesome|FontAwesomeIcon|fa[A-Z]|library.add" src
rg "@mui/icons-material" src
rg "className=.*rcat-|@apply|tailwind|sx=|styled\\(" src
rg "from ['\"]@mui/material['\"]|from ['\"]@mui/icons-material" src
```

Additional confirmation searches:

```text
rg "@fortawesome|FontAwesomeIcon|fa[A-Z]|library.add" -g "*.ts" -g "*.tsx" -g "*.js" -g "*.mjs" -g "*.cjs" -g "*.json" -g "!pnpm-lock.yaml" .
rg "@mui/material" src
rg "styled\\(" src
```

## MUI Usage

MUI is broadly used and should remain the component foundation for this application.

- `@mui/material` appears in 58 source files.
- It is used across global app setup, public pages, public shell, homepage sections, shared content rendering, and admin CMS screens.
- Admin CMS pages rely on MUI for forms, dialogs, tables, cards, controls, menus, progress states, and layout primitives.
- Public pages use MUI for cards, buttons, chips, typography, progress states, containers, responsive `sx`, and accessible controls.
- `styled(` was not found in `src`; styling is primarily MUI `sx`, theme usage, and shared Tailwind/RCAT classes.

Representative areas:

- App provider/theme: `src/App.tsx`, `src/theme.ts`
- Admin shell and pages: `src/admin/layout/CmsShell.tsx`, `src/admin/pages/*`, `src/admin/components/*`
- Public shell and pages: `src/public/components/PublicSiteShell.tsx`, `src/public/pages/*`
- Homepage sections: `src/public/components/home/*`
- Shared renderers: `src/shared/components/*`

## Tailwind and RCAT Utility Usage

Tailwind CSS v4 is imported once in `src/styles.css`.

The project defines RCAT tokens and component utility classes in `src/styles.css`:

- `.rcat-page`
- `.rcat-container`
- `.rcat-section`
- `.rcat-section-tight`
- `.rcat-card`
- `.rcat-card-muted`
- `.rcat-surface`
- `.rcat-admin-page`
- `.rcat-admin-card`
- `.rcat-public-heading`
- `.rcat-muted-text`
- `.rcat-focus-ring`
- `.rcat-image-frame`
- `.rcat-content-prose`
- `.rcat-content-detail-shell`
- `.cms-shell-main`
- `.cms-elevated-surface`

`className=.*rcat-` appears in 10 source files. Usage is concentrated in page shells, public content cards, detail pages, admin login, and homepage list cards.

Tailwind utility classes are also used alongside RCAT classes for simple layout helpers such as `grid`, `block`, `h-full`, `p-3`, `max-w-[960px]`, and `place-items-center`.

## MUI Icons Usage

`@mui/icons-material` is actively used and should not be removed.

- MUI icon imports appear in 44 source files.
- Total per-icon import lines found: 194.
- All current imports are per-icon path imports such as `@mui/icons-material/EditOutlined`, not broad barrel imports from `@mui/icons-material`.
- This is the correct shape for Vite/Rollup tree-shaking and avoids importing the entire icon package.

Files with the highest icon import density:

| File                                                     | Icon imports | Notes                                          |
| -------------------------------------------------------- | -----------: | ---------------------------------------------- |
| `src/admin/pages/ExternalServicesPage.tsx`               |           14 | Service category icon picker/admin list        |
| `src/admin/layout/CmsShell.tsx`                          |           12 | Admin navigation                               |
| `src/public/components/home/ExternalServicesSection.tsx` |           10 | Public service cards                           |
| `src/public/components/PublicSiteShell.tsx`              |           10 | Header, footer, and social/contact affordances |
| `src/admin/pages/SettingsPage.tsx`                       |            9 | Settings section cards                         |
| `src/admin/pages/MediaPage.tsx`                          |            9 | Media actions and type indicators              |
| `src/admin/pages/CarouselPage.tsx`                       |            8 | Carousel admin actions                         |
| `src/public/pages/PublicContactPage.tsx`                 |            8 | Contact/social UI                              |

Most repeated icons:

| Icon                   | Count |
| ---------------------- | ----: |
| `EditOutlined`         |     8 |
| `SchoolOutlined`       |     8 |
| `ArticleOutlined`      |     7 |
| `OpenInNewOutlined`    |     6 |
| `DeleteOutline`        |     6 |
| `SaveOutlined`         |     6 |
| `CampaignOutlined`     |     6 |
| `ArrowForwardOutlined` |     6 |
| `DescriptionOutlined`  |     6 |
| `SearchOutlined`       |     5 |

No unused MUI icon imports were obvious from lint/build. Because TypeScript is not configured with `noUnusedLocals`, a future dedicated unused-import lint rule could catch this earlier, but adding lint plugins is not necessary for this task.

## FontAwesome Usage

FontAwesome has zero source usage.

The required source search returned no matches:

```text
rg "@fortawesome|FontAwesomeIcon|fa[A-Z]|library.add" src
```

The broader code/config search, excluding `pnpm-lock.yaml`, found only package metadata and an older performance note:

```text
package.json:
  @fortawesome/fontawesome-svg-core
  @fortawesome/free-brands-svg-icons
  @fortawesome/react-fontawesome

docs/performance/frontend-dependency-bundle-risk-2026-05-15.md:
  historical dependency hygiene note
```

An unconstrained whole-repo search can also match `public/rcat-logo.svg` because the base64 payload contains incidental `fa[A-Z]` text. That is not FontAwesome usage.

Decision: FontAwesome can be removed safely because there are no imports, components, icon definitions, or `library.add` calls in source. The unused FontAwesome dependencies were removed from `package.json` and `pnpm-lock.yaml` in this cleanup.

## Styling Conflict Risks

Risk level: medium maintenance risk, low immediate build/runtime risk.

- MUI `sx` is used heavily inside MUI components, while RCAT/Tailwind classes are used for wrappers and reusable surfaces. This is healthy when boundaries are respected.
- The main risk is future drift from hardcoded greens/yellows in `sx` that do not map to the MUI theme or `src/styles.css` RCAT variables.
- Avoid using Tailwind classes to override internal MUI slots, generated classes, disabled state, focus state, or form control internals.
- Avoid using `sx` to fight page-level Tailwind layout utilities on the same element.
- Responsive logic should live in one layer per element: MUI responsive `sx` inside MUI components, Tailwind responsive classes for wrapper/layout elements.

## Recommended Boundaries

- Use MUI for forms, dialogs, tables, menus, admin CMS UI, stateful controls, and existing MUI icon surfaces.
- Use Tailwind/RCAT classes for page shell layout, broad containers, static surfaces, content detail wrappers, focus utility classes, and simple responsive layout wrappers.
- Keep color decisions aligned with `src/theme.ts` and `src/styles.css` RCAT tokens.
- Keep icon imports as per-icon MUI path imports.
- Do not introduce FontAwesome again unless there is a specific brand icon that MUI does not cover and the import is tightly scoped.

## Bundle Risk Ranking

| Risk                                    | Rank | Rationale                                                                                              | Recommended action                                                                                      |
| --------------------------------------- | ---: | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| MUI component runtime and shared chunks |   P1 | MUI is core to admin/public UI; removal is not realistic, but route splitting and lazy loading matter. | Keep MUI, avoid broad rewrites, watch public shell imports.                                             |
| MUI Icons volume                        |   P2 | Imports are tree-shakeable, but icon count is high in several admin/public files.                      | Keep path imports; consider a small icon mapping only where repeated data-driven icon selection exists. |
| Styling boundary drift                  |   P2 | Two styling systems are present; current use is workable but needs rules.                              | Maintain `docs/design/mui-tailwind-boundary.md`.                                                        |
| FontAwesome unused dependencies         |   P2 | Zero source usage, dependency-only overhead and maintenance risk.                                      | Remove dependencies and lock entries.                                                                   |
| Tailwind global CSS                     |   P3 | Current global CSS is modest and tokenized.                                                            | Keep Tailwind for layout/utilities; avoid deep MUI overrides.                                           |

## Exact Follow-Up Actions

1. Keep FontAwesome out of runtime dependencies unless a future feature introduces a proven source usage.
2. Keep `@mui/icons-material`.
3. Keep all MUI icon imports as per-icon path imports.
4. Do not introduce broad imports from `@mui/icons-material`.
5. Do not migrate UI wholesale between MUI and Tailwind.
6. Prefer MUI `sx`/theme overrides inside MUI components.
7. Prefer RCAT/Tailwind classes for page wrappers, simple surfaces, and static layout helpers.
8. Consider `noUnusedLocals` or an unused-import lint rule only as a separate tooling task, because that can create repo-wide cleanup churn.
9. Re-check public entry bundle after any future public shell or icon changes.
