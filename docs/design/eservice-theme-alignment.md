# E-Service Theme Alignment

## Goal

Align RCAT E-Service with the main RCAT institutional visual language without changing routes, data behavior, authentication, validation, or component architecture.

## Palette

| Token                  | Value     | Usage                                                          |
| ---------------------- | --------- | -------------------------------------------------------------- |
| `--rcat-primary`       | `#166534` | Main institutional green for primary actions and service icons |
| `--rcat-primary-hover` | `#14532D` | Hover state for primary actions and dark green surfaces        |
| `--rcat-secondary`     | `#15803D` | Secondary green variation for service icon categories          |
| `--rcat-primary-soft`  | `#F0FDF4` | Soft green preview and quiet support surfaces                  |
| `--rcat-primary-tint`  | `#DCFCE7` | Light green tint for subtle highlights                         |
| `--rcat-accent`        | `#EAB308` | Gold accent for selected icon categories and focus rings       |
| `--rcat-accent-soft`   | `#FEF9C3` | Soft gold text or badge surfaces on dark green                 |
| `--rcat-surface`       | `#FFFFFF` | Cards, dialogs, and content surfaces                           |
| `--rcat-page-bg`       | `#F8FAFC` | Recommended E-Service page background                          |
| `--rcat-border`        | `#E2E8F0` | Neutral borders for cards and form-adjacent surfaces           |
| `--rcat-text`          | `#0F172A` | Strong readable text                                           |
| `--rcat-muted`         | `#475569` | Secondary text                                                 |

## Semantic Token Usage

- Public E-Service hero uses green as the dominant institutional identity.
- Public E-Service cards use white surfaces, neutral borders, subtle shadows, and green/gold icon accents.
- Admin E-Service cards and dialog preview use the same shared icon tone helper as the public section.
- Gold is an accent only. It should not be used as body text on white backgrounds.

## Button Hierarchy

- Primary E-Service actions use `--rcat-primary`.
- Primary hover uses `--rcat-primary-hover`.
- Focus-visible states keep a visible gold outline with `--rcat-accent`.
- Secondary/cancel actions keep existing MUI inherited styling to avoid changing workflow semantics.

## Card, Table, And Form Rules

- Cards should stay white with `--rcat-border` and subtle shadows.
- Preview cards may use `--rcat-primary-soft`.
- Form fields should keep current MUI behavior, validation, disabled, and focus handling.
- Tables are intentionally unchanged in this pass because E-Service does not currently use a dedicated table surface.

## Accessibility Notes

- Avoid yellow text on white backgrounds.
- Use gold on dark green or with dark text only.
- Keep keyboard focus visible.
- Preserve existing MUI disabled, validation, and helper text behavior.
- Maintain existing responsive grid dimensions and touch targets.

## Risk Controls

- No dependencies were added.
- No route, API, auth, validation, or write behavior was changed.
- The shared token additions are CSS variables only.
- The shared E-Service tone helper only controls presentation values.
- Existing layout structure and responsive breakpoints were preserved.

## Intentionally Not Changed

- Apps Script and CMS schema.
- Public website sections unrelated to E-Service.
- Analytics and tracking behavior.
- Admin business logic for creating, editing, deleting, validating, or publishing E-Service links.
- Broad MUI theme or Tailwind token rewrites outside the scoped E-Service alignment.
