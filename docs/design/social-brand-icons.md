# Social and Brand Icon Policy

## Canonical source

Facebook, YouTube, and TikTok use local SVG path data from Simple Icons 16.21.0.

All three icons:

- come from the same source and release;
- use the same `0 0 24 24` viewBox;
- render through the same MUI `SvgIcon` component;
- use the same 20 px glyph box;
- inherit `currentColor`;
- do not add a runtime dependency, webfont, CDN request, or external image request.

Source repository:

- https://github.com/simple-icons/simple-icons
- release/tag: `16.21.0`
- project license: CC0-1.0
- brand names and marks remain the property of their respective owners.

## Components

- `src/design-system/icons/SocialBrandIcon.tsx` owns all supported social brand path data.
- `src/public/components/SocialIconLink.tsx` owns the compact top-bar control geometry.
- Public pages must not declare local Facebook, YouTube, or TikTok SVG components.
- Public pages must not mix MUI brand icons, Font Awesome, and local raw SVG paths.

## Size and control policy

- Brand glyph box: 20 x 20 px on every breakpoint.
- Compact top-bar control box: 40 x 40 px.
- The control remains a MUI `IconButton` with `color="inherit"` so the canonical theme and focus contract remain intact.
- The control has no permanent border, circular outline, or background decoration.
- Keyboard focus remains visible through the canonical design-system focus style.

## Performance policy

The paths are compiled locally and tree-shaken with the existing application code. No new package or network request is introduced.

## Relationship to the application icon system

Social brand marks are the documented exception to the MUI Outlined application-icon family. See `docs/design/icon-system.md`.
