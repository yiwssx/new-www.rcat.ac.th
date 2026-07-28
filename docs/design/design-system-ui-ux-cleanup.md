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
| Institutional yellow | `brandAccent`, `brandAccentStrong`, `brandAccentSoft`, `accentForeground`              |
| Canvas and surfaces  | `pageCanvas`, `surfaceDefault`, `surfaceSubtle`, `surfaceEmphasized`, `surfaceInverse` |
| Text                 | `textPrimary`, `textSecondary`, `textInverse`, `textOnAccent`, `link`                  |
| Boundaries and focus | `borderSubtle`, `borderStrong`, `focusRing`, `focusSeparation`                         |
| Feedback             | `success`, `warning`, `error`, `information`, disabled roles                           |

Filled accent controls use `brandAccent` with `textOnAccent`. Normal-size accent text and outlined controls use
`accentForeground` (the semantic readable role backed by `brandAccentStrong`) because decorative yellow is not
automatically a readable foreground on a light surface.

## Typography, shape, elevation, controls, and motion

| Policy           | Values                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Typography       | display/page title, section title, card title, body, compact body, label, caption, button |
| Thai line height | headings 1.28–1.40; body, compact body, labels, and captions 1.50                         |
| Radius           | none 0, small 4, medium 8, large 16, pill 999                                             |
| Elevation        | none, low, medium, high, overlay                                                          |
| Controls         | compact 40, comfortable 44, large 48, IconButton 44, input 48 pixels                      |
| Focus            | 2-pixel white separation layer plus 3-pixel semantic outer ring; 5-pixel total extent     |
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

| Pair                              |         Ratio | Result |
| --------------------------------- | ------------: | ------ |
| Primary text / page               |        12.863 | Pass   |
| Primary text / paper              |        13.458 | Pass   |
| Secondary text / page             |         6.053 | Pass   |
| Secondary text / paper            |         6.332 | Pass   |
| Primary button                    |         5.299 | Pass   |
| Contained accent button           |         4.761 | Pass   |
| Accent foreground / paper         |         7.438 | Pass   |
| Accent foreground / page          |         7.109 | Pass   |
| Accent foreground / subtle        |         6.794 | Pass   |
| Destructive action                |         4.587 | Pass   |
| Link / page                       |         7.850 | Pass   |
| Contextual focus / page           |         4.278 | Pass   |
| Contextual focus / paper          |         4.476 | Pass   |
| Contextual focus / primary        |         5.299 | Pass   |
| Contextual focus / primary strong |         8.212 | Pass   |
| Contextual focus / accent         |         3.229 | Pass   |
| Contextual focus / inverse        |         8.212 | Pass   |
| Inverse footer                    |         8.212 | Pass   |
| Semantic statuses                 | 4.832 minimum | Pass   |

The contextual focus value is the stronger of the two actual rendered boundaries against the supported background.
The white separation layer is adjacent to the control/background edge and the gold outer layer is adjacent at the
outside edge. This is targeted evidence, not a claim of full WCAG conformance.

## Review corrections

Review of the initial cleanup at `adaa90d000caec52cd55a21871db2b8066067a42` found that the single gold
focus ring passed on page/paper but measured only 1.184:1 on primary green, 1.835:1 on strong/inverse green, and
1.386:1 on accent yellow. It also found that `brandAccent` used as normal-size foreground measured only 3.229:1
on paper and 3.086:1 on the page canvas.

The correction uses one canonical, non-geometric dual-layer focus shadow: a 2-pixel white separation layer and a
gold outer ring with a total 5-pixel extent. At least one actual boundary now passes 3:1 on page, paper, primary,
strong primary, accent, and inverse surfaces. The desktop Main Menu keeps overflow containment on its hidden
measurement wrapper while the rendered navigation allows the focus effect to paint; the mobile Drawer adds exactly
the canonical focus extent as internal room.

The accent roles are now explicit: `brandAccent` remains the institutional filled/decorative yellow,
`textOnAccent` remains text on that fill, and `accentForeground` is used for text and outlined borders on light
surfaces. Rendered browser measurements are 4.761:1 for contained-secondary text and 7.438:1 for outlined Button,
text Button, and outlined Chip text on paper.

Deterministic Playwright coverage focuses desktop top-level/submenu links, the compact menu IconButton, Drawer item,
all supported focus surfaces, and all corrected secondary variants. It checks both rendered layers, the exported
5-pixel extent, ancestor overflow, viewport bounds, stable control dimensions, contrast, and page-level horizontal
overflow without screenshots as the assertion mechanism.

The corrective commit message is `fix(ui): correct focus and accent contrast`; its immutable SHA is recorded in
Draft PR #10 and the completion report because a commit cannot contain its own hash.

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
| Raw bytes           |  375,137 |   387,207 | 388,000 |
| Gzip bytes          |  123,325 |   126,260 | 127,000 |

The Public startup graph remains within unchanged limits, with 793 raw bytes and 740 gzip bytes of remaining
headroom. Public telemetry remains outside the forbidden synchronous associations.

`media:check` preserves approved image/iframe owners, responsive widths, high-priority owners, and centralized Drive thumbnails. `layout:check` preserves the persistent shell, Footer Directory state identifiers, non-focusable loading geometry, and ready content during background refetch.

| Deterministic CLS scenario | Corrected |
| -------------------------- | --------: |
| Desktop news               |  0.003126 |
| Mobile news                |  0.057900 |
| Desktop search             |  0.004419 |
| Desktop departments        |  0.003757 |
| Desktop content detail     |  0.030004 |
| Navigation                 |  0.001186 |
| Cached navigation          |  0.000000 |
| Background refetch         |  0.000308 |
| Empty directory            |  0.002416 |
| Error directory            |  0.002368 |

All deterministic CLS scenarios remain below the unchanged 0.1 budget. Footer Directory ready/loading height deltas are 0.484 pixels on desktop and 0.250 pixels on mobile, within the existing 2-pixel geometry tolerance.

## Corrective validation

Final local validation passed:

- contrast tokens 34/34, design-system components 6/6, governance 8/8, and design-system Playwright 13/13
- formatting and strict lint
- complete unit suite (after replacing one stale mourning-focus assertion with the canonical focus policy)
- integration suite 19/19
- TypeScript/Vite production build
- unchanged performance, media, layout, and design-system governance budgets
- Worker typecheck without Worker source changes
- complete functional suite 57/57
- focused Public Shell CLS suite 10/10 and CMS Auth suite 19/19
- focused media performance suite 7/7 on rerun; an initial run observed one transient duplicate event-image request,
  while the unchanged retry and complete functional run both passed the original request budget

## Governance and exceptions

`pnpm design:check` uses TypeScript parsing for imports and source structure where useful, plus semantic CSS alias extraction. It enforces the canonical source, theme consumption, alias mapping, hard-coded color and focus policies, icon imports, import boundaries, required tests, and quality/CI integration.

Documented exceptions are:

- Carousel, Intro Gate, responsive media, and embeds where geometry/overlays are already governed
- Messenger’s third-party blue
- one-off decorative round artwork and media focal geometry

## Limitations

- The browser matrix uses deterministic fixtures, not production content or a usability study.
- No Lighthouse, production Core Web Vitals, or full WCAG conformance claim is made.
- The synchronous bundle has 793 raw bytes and 740 gzip bytes of headroom, so future eager Public imports remain
  constrained.
- This is representative migration rather than a redesign or an exhaustive replacement of every local `sx` layout value.
