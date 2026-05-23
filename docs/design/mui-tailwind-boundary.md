# MUI and Tailwind Boundary

This project intentionally uses both MUI and Tailwind CSS v4. The goal is not to migrate everything to one system. The goal is to keep each system in the layer where it is strongest and avoid styling conflicts.

## Default to MUI For

- Forms and validation UI
- Dialogs, drawers, menus, popovers, tooltips, and overlays
- Tables, pagination, data grids, filters, and dense admin workflows
- Admin CMS UI
- Interactive stateful components
- MUI components that already use MUI `sx` and theme values
- Icons where MUI Icons are already used

For MUI components, prefer `sx`, theme values, and component props over Tailwind classes.

## Default to Tailwind and RCAT Classes For

- Page shell layout
- Broad spacing utilities
- Responsive containers
- Simple surface helpers
- Static content layout
- Shared RCAT utility classes in `src/styles.css`
- Print/static layout when needed

Current shared RCAT classes include:

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

## Theme and Tokens

- Colors should come from the MUI theme or RCAT CSS variables/tokens.
- Avoid hardcoded new greens, yellows, shadows, or page backgrounds unless the component has a specific documented reason.
- Prefer existing RCAT values in `src/theme.ts` and `src/styles.css`.
- Keep the RCAT green, white, and yellow identity consistent across public and admin surfaces.

## Do Not Mix Styling Randomly

- Do not use Tailwind classes to override deep MUI internals or generated MUI class names.
- Do not use `sx` to fight global Tailwind utility classes on the same element.
- Do not duplicate card borders, shadows, colors, and padding in both `className` and `sx` unless one layer is clearly structural and the other is component-local.
- Do not add ad hoc color values when theme tokens already exist.

## Responsive Rules

- MUI responsive `sx` values are allowed inside MUI components.
- Tailwind responsive classes are allowed for page wrappers and simple layout shells.
- Do not duplicate the same responsive behavior in both `sx` and `className` on the same element.
- If responsive behavior affects MUI component internals, keep it in `sx`.
- If responsive behavior affects outer layout and spacing, Tailwind/RCAT classes are acceptable.

## Icon Rules

- Keep MUI Icons as the default icon system.
- Use per-icon path imports such as `@mui/icons-material/SearchOutlined`.
- Do not import from the broad `@mui/icons-material` barrel.
- Do not add FontAwesome unless a required brand/icon is not available through MUI Icons and the dependency impact is accepted.
- Do not replace existing MUI Icons with custom SVGs only for consistency.

## Practical Examples

Use MUI:

```tsx
<Button startIcon={<SaveOutlinedIcon />} sx={{ minHeight: 44 }}>
  Save
</Button>
```

Use RCAT/Tailwind for a wrapper:

```tsx
<main className="rcat-container rcat-section">{children}</main>
```

Avoid mixing the same concern twice:

```tsx
// Avoid: both layers define the same card surface.
<Card className="rcat-card" sx={{ border: "1px solid #1f5a2c", boxShadow: "..." }} />
```

Preferred:

```tsx
// Shared surface from RCAT class, component-specific spacing in sx.
<Card className="rcat-card">
  <CardContent sx={{ p: { xs: 2, md: 3 } }} />
</Card>
```
