# Admin Menu Management

Updated: 2026-08-01.

This document defines the current Admin Menu UX, hierarchy model, URL behavior, data ownership, and validation strategy.

## Goal

The Menu editor must present website navigation in the same hierarchy that a CMS operator understands on the public website. The interface must not require knowledge of database IDs or internal relationship keys.

## Data Model

Menu persistence remains based on flat `menu_items` rows with `id`, `parent_id`, `label`, `href`, `enabled`, `sort_order`, and revision/audit metadata.

`parent_id` is an internal relationship key. The public metadata adapter builds hierarchical `children` from those rows, and public navigation already renders nested children recursively.

## Admin Presentation

Required hierarchy example:

```text
เกี่ยวกับวิทยาลัย
├─ ประวัติวิทยาลัย
├─ วิสัยทัศน์และพันธกิจ
└─ บุคลากร

ข่าวสาร
├─ ข่าวประชาสัมพันธ์
└─ ประกาศ
```

A child must not appear as an unrelated top-level card merely because its `sort_order` equals or precedes a root item.

### Internal IDs

Do not expose values such as `menu-550e8400-e29b-41d4-a716-446655440000` as normal editing information.

The ID remains required internally for persistence, revision-aware mutation, parent relationships, keyed React rendering, and order updates.

### Parent selection

The editor should show `เมนูแม่` with choices such as:

- `ไม่มี — เป็นเมนูหลัก`
- readable eligible menu names

The UI stores the selected item's ID internally. Do not ask the operator to type `Menu ID แม่`.

A menu must never become its own parent. Backend validation remains authoritative.

## URL and Path Policy

The Admin Menu editor preserves explicit paths rather than inventing a content prefix.

| Input                       | Stored value         |
| --------------------------- | -------------------- |
| `/`                         | `/`                  |
| `/news`                     | `/news`              |
| `/admission`                | `/admission`         |
| `/content/admission`        | `/content/admission` |
| `https://example.org/page`  | unchanged            |
| `mailto:office@example.org` | unchanged            |
| `tel:043000000`             | unchanged            |
| `#section`                  | unchanged            |

The editor must not transform `/admission` into `/content/admission` unless the operator explicitly entered `/content/admission`.

## Why `/content/` Must Not Be Forced

The public router supports both `/content/$slug` and `/$slug`. A root permalink can therefore legitimately resolve a content slug without `/content/`.

The CMS must not guess which route form the operator intended.

## Tree Query Strategy

The Menu screen is bounded structured configuration, not a large unbounded content index.

Prefer the existing full Admin menu tree endpoint for the editor instead of treating hierarchy as a generic paginated flat list.

Benefits:

- parent and child context are available together;
- no page boundary separates a parent from its child;
- no hierarchy reconstruction from partial pages;
- no search debounce is required for the primary tree;
- component tests are smaller and faster;
- operators see navigation as one coherent structure.

Large content/document/media lists may still use server pagination. That pattern should not be applied automatically to small hierarchical configuration data.

## Ordering

`sort_order` is meaningful within a sibling group.

Ordering must preserve root order among roots and child order among children of the same parent. Moving one child must not renumber unrelated branches.

The compact order endpoint and revision-aware save remain the source for order writes.

## Creation and Editing

For a root menu, parent is `null`. For a submenu, UI stores the selected parent ID internally and displays the child under that parent after successful invalidation/refetch.

The edit dialog should show:

- menu name;
- path/URL;
- parent menu by readable label;
- visibility.

Do not show raw relationship IDs as normal operator input.

## Delete Safety

Backend protection that prevents deletion of a menu with children remains in force. The UI may explain the reason in human-readable Thai but must not bypass backend validation.

## Public Rendering

Public navigation consumes nested `PublicMenuItem.children`.

Desktop navigation uses nested submenus. Compact/mobile navigation expands/collapses recursively. Admin and Public must describe the same parent/child structure.

## Caching and Invalidation

After create/update/delete/order changes:

- invalidate Admin menu data;
- invalidate compact order data if applicable;
- invalidate public CMS/navigation data.

Do not require a page reload to see the saved hierarchy.

## RBAC

Menu management remains capability-protected. Read-only roles may view the structure when permitted, but mutation controls must remain unavailable without the required capability.

## Testing

Use two layers.

### Pure model tests

Use pure functions for tree flattening, sibling ordering, parent-label lookup, candidate-parent filtering, and URL normalization/preservation.

These tests must not mount MUI, TanStack Query, timers, or network mocks.

### Focused component tests

Verify only rendering-dependent behavior:

- root/child visual hierarchy;
- readable parent selection;
- hidden internal IDs;
- explicit URL preservation;
- create/edit/save payload mapping;
- permission-controlled mutation controls.

Run:

```bash
pnpm exec vitest run src/admin/pages/menuPageModel.test.ts src/admin/pages/MenuPage.test.tsx
```

## Deployment Impact

If the final diff is limited to `src/admin/**`, tests, and docs:

- Vercel: required
- Cloudflare Worker: not required
- D1 migration: not required
- Apps Script: not required
- environment variable change: not required
