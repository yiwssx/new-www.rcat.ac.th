# Application Icon System

Updated: 2026-08-02.

This document is the current source of truth for application icons in the RCAT Public Website and CMS.

## Canonical families

- Semantic application icons use MUI Material Icons **Outlined** variants.
- Imports remain direct per-icon paths; broad imports from @mui/icons-material are prohibited.
- Rounded variants are not used for application controls, navigation, content types, or actions.
- Filled icons are allowed only when the fill itself communicates state or geometry. The carousel Circle indicator is the intentional current exception.
- Facebook, YouTube, and TikTok remain local Simple Icons paths through SocialBrandIcon and are not replaced by MUI approximations.

## Semantic consistency

Common actions should retain one visual family across Admin and Public surfaces: add, edit, delete, save, search, publish, open externally, login, menu/navigation, document/content, location/contact, and hierarchy controls all use Outlined icons.

Do not create an application-wide barrel that imports every icon. Route-local direct imports are preferred because they preserve Vite tree shaking and route-splitting boundaries.

## E-Service registry

Data-driven E-Service icons are the exception to route-local selection because the same iconKey must render identically in Admin preview/editing and on the Public homepage.

The sole mapping owner is:

src/design-system/icons/ExternalServiceIcon.tsx

Supported keys are apps, calendar, check, groups, handshake, registration, book, school, and link.

Admin and Public E-Service code must render through ExternalServiceIcon rather than declaring duplicate maps.

## Social brands

Social brand marks remain governed separately by docs/design/social-brand-icons.md. They use local SVG path data, currentColor, no webfont, no CDN dependency, and no Font Awesome dependency.

## Favicon and institutional identity

The browser favicon remains the institutional logo asset referenced by index.html. Application action icons must not be substituted for the institutional favicon/logo.

## Governance

pnpm design:check enforces:

- no broad @mui/icons-material barrel import;
- no Rounded MUI icon imports in governed source;
- no legacy default Add, Menu, or Assignment imports where Outlined variants are required;
- one E-Service mapping owner;
- required icon regression tests.

The focused icon tests are:

pnpm exec vitest run src/test/ExternalServiceIcon.test.tsx src/test/designSystemGovernance.test.mjs

Any icon-system change that touches Public synchronous code must also respect the existing public performance budget.
