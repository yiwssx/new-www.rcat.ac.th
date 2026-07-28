# Design System and UI/UX Cleanup

## Scope and snapshot

- Starting master: `cf2fd45214b53c163e9db3edcb4b7d13f06d8419`
- Corrected snapshot: working tree on `refactor/design-system-ui-ux-cleanup` before the final commit
- Scope: design tokens, theme policy, justified shared primitives, representative Public/Auth/Admin cleanup, deterministic tests, and repository governance
- Explicitly unchanged: Worker, D1, Public API, CMS Auth behavior, Vercel proxy, media write contracts, analytics/telemetry ownership, dependencies, and lockfile

The baseline had three parallel styling sources: brand values in project settings, MUI theme values, and CSS/RCAT aliases. Repeated local surface, focus, heading, action, and status patterns then added component-specific variants. The corrected architecture has one semantic token source consumed by both MUI and RCAT CSS aliases.

## Ownership

| Layer                                                                   | Owner                                  |
| ----------------------------------------------------------------------- | -------------------------------------- |
| Semantic colors, typography, radius, elevation, controls, focus, motion | `src/design-system/tokens.ts`          |
| Stateful and interactive components                                     | MUI theme and MUI `sx`                 |
| Page structure and static wrappers                                      | Tailwind/RCAT utilities                |
| Shared focus and surface behavior                                       | `src/design-system/componentStyles.ts` |
| Contrast calculation                                                    | `src/design-system/accessibility.ts`   |

`project-settings.json` no longer owns visual theme values. `src/styles.css` contains aliases only; `MuiCssBaseline` publishes the canonical CSS variables during the first application render.

## Semantic token matrix

| Role                 | Token                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| Institutional green  | `brandPrimary`, `brandPrimaryStrong`, `brandPrimarySoft`                               |
| Institutional yellow | `brandAccent`, `brandAccentStrong`, `brandAccentSoft`                                  |
| Canvas and surfaces  | `pageCanvas`, `surfaceDefault`, `surfaceSubtle`, `surfaceEmphasized`, `surfaceInverse` |
| Text                 | `textPrimary`, `textSecondary`, `textInverse`, `textOnAccent`, `link`                  |
| Boundaries and focus | `borderSubtle`, `borderStrong`, `focusRing`                                            |
| Feedback             | `success`, `warning`, `error`, `information`, disabled roles                           |

Accent controls use `textOnAccent`, not inverse white, because decorative accent and readable text are separate roles.

## Typography, shape, elevation, controls, and motion

| Policy           | Values                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Typography       | display/page title, section title, card title, body, compact body, label, caption, button |
| Thai line height | headings 1.28–1.40; body, compact body, labels, and captions 1.50                         |
| Radius           | none 0, small 4, medium 8, large 16, pill 999                                             |
| Elevation        | none, low, medium, high, overlay                                                          |
| Controls         | compact 40, comfortable 44, large 48, IconButton 44, input 48 pixels                      |
| Focus            | 3-pixel semantic ring with 2-pixel offset                                                 |
| Motion           | short 120 ms, standard 180 ms, deliberate 260 ms; reduced-motion overrides                |

## MUI theme coverage

The theme defines scoped defaults or overrides for CssBaseline, Button, IconButton, Card, Paper, TextField, OutlinedInput, FormLabel, FormHelperText, Chip, Alert, Dialog, DialogTitle, DialogActions, Drawer, Tooltip, TableCell, Tabs, Tab, PaginationItem, Skeleton, Link, MenuItem, and ToggleButton.

The policies provide stable control dimensions, visible focus, non-geometric hover, distinguishable disabled/error/destructive states, responsive dialog actions, Thai text wrapping in tables, low default elevation, and reduced motion.

## Shared primitives

- `PageHeader`
- `SectionHeader`
- `ActionBar`
- `FormActions`
- `ResponsiveDialogActions`
- `AuthPageLayout`
- `SemanticStatusChip`
- consolidated `EmptyState`

There is no eager design-system barrel. Public-safe primitives do not import Admin implementations, and Auth/Admin foundations do not import the Public shell or telemetry.

## Migrated inventory

Public representatives:

- Public Site Shell and Main Menu
- Footer Directory, loading state, content cards, pagination policy, error/empty presentation
- search, contact, and content-detail pages
- Home headings, hero/director cards, achievements, events, external services, jobs, procurement, video, marquee, and visitor statistics

Auth/Admin representatives:

- Login, Activate Account, Reset Password
- CMS shell, dashboard, content, media, menu, users, settings, carousel, and external services surfaces
- content, reauthentication, media, menu, and public-event dialog actions
- content/integration and event lifecycle statuses

No endpoint, permission, validation, submission, deletion, MFA, session, CSRF, or data-flow behavior was changed.

## Status and feedback

The semantic status set covers success, warning, error, information, draft, published, disabled, active, scheduled, and ended. Every rendered status includes text; color is supplementary. The ongoing-event pulse keeps its state meaning and is removed under reduced motion. Loading skeletons are non-focusable, and empty/error states retain semantic regions.

## Measured audit

The same syntax-aware audit script scanned 98 non-test component files. Media focal geometry, Carousel, Intro Gate, and third-party embed owners are a narrow allowlist.

| Indicator                       | Baseline | Corrected |
| ------------------------------- | -------: | --------: |
| Component hard-coded colors     |       93 |         3 |
| Hard-coded shadows              |       22 |         1 |
| Hard-coded radii                |       66 |        35 |
| Duplicate focus implementations |        9 |         0 |
| Repeated surface style blocks   |       37 |        25 |
| Repeated page/section headers   |       33 |        27 |
| Repeated action rows            |       21 |        17 |
| Direct button heights           |        4 |         0 |
| Direct input heights            |        1 |         0 |
| Controls below static policy    |       20 |         0 |
| Broad icon imports              |        0 |         0 |
| Mixed MUI/RCAT surface concerns |        1 |         0 |
| Unauthorized `!important`       |       13 |         0 |

The three remaining component color literals and one shadow are Messenger’s documented third-party blue. Remaining radii are predominantly media geometry, round artwork, and one-off responsive shape; they are not treated as blanket defects.

## Contrast results

Ratios are deterministic sRGB calculations. Normal text targets 4.5:1; focus boundaries target 3:1.

| Pair                   |         Ratio | Result |
| ---------------------- | ------------: | ------ |
| Primary text / page    |        12.863 | Pass   |
| Primary text / paper   |        13.458 | Pass   |
| Secondary text / page  |         6.053 | Pass   |
| Secondary text / paper |         6.332 | Pass   |
| Primary button         |         5.299 | Pass   |
| Accent button          |         4.761 | Pass   |
| Destructive action     |         4.587 | Pass   |
| Link / page            |         7.850 | Pass   |
| Focus / page           |         4.278 | Pass   |
| Focus / paper          |         4.474 | Pass   |
| Inverse footer         |         8.212 | Pass   |
| Semantic statuses      | 4.832 minimum | Pass   |

Baseline contrast failures were 1; corrected failures are 0. This is targeted evidence, not a claim of full WCAG conformance.

## Responsive browser evidence

Deterministic fixtures exercised Public routes (`/`, `/news`, search, departments, detail, contact), Auth routes, representative Admin routes, and a content dialog.

| Viewport   | Public page overflow failures | Admin page overflow failures | Clipped headings | Controls below 40 px | Overlapping controls | Escaping cards/forms |
| ---------- | ----------------------------: | ---------------------------: | ---------------: | -------------------: | -------------------: | -------------------: |
| 390 × 844  |                             0 |                            0 |                0 |                    0 |                    0 |                    0 |
| 768 × 1024 |                             0 |                            0 |                0 |                    0 |                    0 |                    0 |
| 1280 × 720 |                             0 |                            0 |                0 |                    0 |                    0 |                    0 |
| 1440 × 900 |                             0 |                            0 |                0 |                    0 |                    0 |                    0 |

Baseline Public and Admin page-overflow failures were already 0. Public controls below policy changed from 2–8 per representative route to 0; Admin changed from 1–12 per route to 0; Auth mobile changed from 0–1 per route to 0. Each representative primary layout has one visible H1 and visible keyboard focus.

## Startup, media, and layout

| Synchronous startup | Baseline | Corrected |   Limit |
| ------------------- | -------: | --------: | ------: |
| JavaScript files    |        1 |         1 |       1 |
| Raw bytes           |  375,137 |   385,685 | 388,000 |
| Gzip bytes          |  123,325 |   126,004 | 127,000 |

The Public startup graph remains within unchanged limits, with 2,315 raw bytes and 996 gzip bytes of remaining headroom. Public telemetry remains outside the forbidden synchronous associations.

`media:check` preserves approved image/iframe owners, responsive widths, high-priority owners, and centralized Drive thumbnails. `layout:check` preserves the persistent shell, Footer Directory state identifiers, non-focusable loading geometry, and ready content during background refetch.

| Deterministic CLS scenario | Corrected |
| -------------------------- | --------: |
| Desktop news               |  0.003763 |
| Mobile news                |  0.058172 |
| Desktop search             |  0.009438 |
| Desktop departments        |  0.004332 |
| Desktop content detail     |  0.031954 |
| Navigation                 |  0.001289 |
| Cached navigation          |  0.000000 |
| Background refetch         |  0.001143 |
| Empty directory            |  0.001860 |
| Error directory            |  0.002155 |

All deterministic CLS scenarios remain below the unchanged 0.1 budget. Footer Directory ready/loading height deltas are 0.484 pixels on desktop and 0.250 pixels on mobile, within the existing 2-pixel geometry tolerance.

## Governance and exceptions

`pnpm design:check` uses TypeScript parsing for imports and source structure where useful, plus semantic CSS alias extraction. It enforces the canonical source, theme consumption, alias mapping, hard-coded color and focus policies, icon imports, import boundaries, required tests, and quality/CI integration.

Documented exceptions are:

- Carousel, Intro Gate, responsive media, and embeds where geometry/overlays are already governed
- Messenger’s third-party blue
- one-off decorative round artwork and media focal geometry

## Limitations

- The browser matrix uses deterministic fixtures, not production content or a usability study.
- No Lighthouse, production Core Web Vitals, or full WCAG conformance claim is made.
- The synchronous gzip budget has 996 bytes of headroom, so future eager Public imports remain constrained.
- This is representative migration rather than a redesign or an exhaustive replacement of every local `sx` layout value.
