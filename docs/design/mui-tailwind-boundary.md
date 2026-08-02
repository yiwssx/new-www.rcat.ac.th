# MUI and Tailwind Boundary

RCAT intentionally uses MUI and Tailwind CSS v4 together. The systems have separate owners so that a component does not receive competing border, radius, shadow, focus, state, or responsive rules.

## Canonical source

`src/design-system/tokens.ts` is the single source for semantic colors, typography, shape, elevation, control sizing, focus, spacing, and motion.

- `src/theme.ts` consumes those tokens for MUI.
- `MuiCssBaseline` publishes `designTokenCssVariables` before the application content is painted.
- `src/styles.css` maps Tailwind and legacy RCAT aliases to the published variables; it does not repeat color values.
- `src/config/project-settings.json` contains site content and role configuration, not theme values.

## MUI owns

- Buttons, IconButtons, links acting as controls, and interactive cards
- Forms, labels, helper text, validation, Selects, and field state
- Dialogs, drawers, menus, popovers, tooltips, tables, filters, tabs, pagination, and dense Admin workflows
- Hover, selected, focus-visible, disabled, error, loading, and destructive states
- Component-local responsive behavior through `sx`

MUI also owns the contextual focus layers and their geometry. Use `focusRingStyles` or `focusVisibleSx` from
`src/design-system/componentStyles.ts` when a shared interactive primitive needs the canonical policy; do not create
an arbitrary local outline. The RCAT structural `.rcat-focus-ring` utility is only a CSS-variable bridge to that same
policy.

Use theme roles rather than literals:

```tsx
<Card sx={{ height: "100%" }}>
  <CardContent sx={{ p: { xs: 2, md: 3 } }} />
</Card>
```

The card border, radius, surface, and elevation come from `MuiCard`; local `sx` owns only layout.

## Tailwind and RCAT utilities own

- Broad page and static-content structure
- Responsive containers and section spacing
- Simple static wrappers
- Print and prose formatting

```tsx
<main className="rcat-container rcat-section">{children}</main>
```

Structural classes include:

- `.rcat-page`
- `.rcat-container`
- `.rcat-section`
- `.rcat-section-tight`
- `.rcat-card` and `.rcat-card-muted` for non-MUI static surfaces
- `.rcat-surface`
- `.rcat-admin-page` and `.rcat-admin-card`
- `.rcat-focus-ring`
- `.rcat-image-frame`
- `.rcat-content-prose`
- `.rcat-content-detail-shell`

## Corrected examples

Do not define one surface twice:

```tsx
// Incorrect: both systems own the same surface.
<Card className="rcat-card" sx={{ border: "1px solid #1f5a2c", boxShadow: "..." }} />
```

Use MUI policy for an interactive surface:

```tsx
<Card component="a" href={href} sx={{ ...interactiveSurfaceSx, height: "100%" }} />
```

Use RCAT only for a static wrapper:

```tsx
<section className="rcat-card rcat-section-tight">{children}</section>
```

Do not set a repeated local control height or focus outline:

```tsx
// Incorrect.
<IconButton size="small" sx={{ width: 34, height: 34, "&:focus-visible": { outline: "none" } }} />
```

Use the theme target-size and focus policies:

```tsx
<IconButton size="small" aria-label="ปิด">
  <CloseOutlinedIcon />
</IconButton>
```

## Responsive and icon rules

- Outer page layout belongs to RCAT/Tailwind; MUI internals belong to responsive `sx`.
- Do not duplicate the same breakpoint rule in `className` and `sx` on one element.
- Tables may scroll inside an intentional `.table-scroll` container; the complete page must not overflow.
- Structural wrappers around interactive content must leave the exported focus-ring extent visible. Measurement-only
  overflow containment must not be reused as the visible navigation wrapper.
- Use direct per-icon imports such as `@mui/icons-material/SearchOutlined`; broad `@mui/icons-material` imports are prohibited.
- Semantic application icons use the MUI **Outlined** family. Rounded variants are prohibited by `pnpm design:check`.
- Filled icons are allowed only when fill communicates state/geometry; the current intentional example is the carousel Circle indicator.
- Data-driven E-Service icon keys resolve only through `src/design-system/icons/ExternalServiceIcon.tsx` so Admin and Public cannot drift.
- Facebook, YouTube, and TikTok remain governed local brand SVGs through `SocialBrandIcon`.
- See `docs/design/icon-system.md` for the complete icon policy.

`brandAccent` is the filled/decorative institutional yellow, not a default foreground for normal-size text on light
surfaces. Use `textOnAccent` on a `brandAccent` fill and use `accentForeground` for accent text, icons, and outlined
boundaries on page, paper, or subtle surfaces. MUI secondary contained, outlined, text, and Chip variants encode this
split centrally.

`pnpm design:check` enforces the canonical source, CSS alias mapping, focus policy, hard-coded color allowlist, icon imports, import boundaries, regression coverage, and CI/quality integration.
