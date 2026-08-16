import { isValidCmsLink } from "../adminLinkValidation";
import type { AdminIdentity } from "../auth/adminAccess";
import { readAdminRows } from "../db/adminPaginationRepository";
import { requireD1Database } from "../db/documentsRepository";
import { MENU_ITEM_ADMIN_ROW_COLUMNS, type MenuItemRow } from "../db/schema";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

function noStoreJson(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return json(data, { ...init, headers });
}

function noStoreError(message: string, status: number, extra: Record<string, unknown> = {}) {
  const response = jsonError(message, status, extra);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readRequestRecord(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { response: noStoreError("malformed JSON request body", 400) } as const;
  }

  return isRecord(body)
    ? ({ body } as const)
    : ({ response: noStoreError("request body must be a JSON object", 400) } as const);
}

function menuExpectedRevision(request: Request, body: Record<string, unknown> = {}) {
  const value = request.headers.get("X-RCAT-Expected-Revision") ?? body.expectedRevision ?? body.revision;

  if (value === undefined || value === null || value === "") {
    return { response: noStoreError("expected revision is required", 400, { resource: "menu" }) } as const;
  }

  const revision = Number(value);

  return Number.isSafeInteger(revision) && revision >= 0
    ? ({ revision } as const)
    : ({ response: noStoreError("invalid expected revision", 400, { resource: "menu" }) } as const);
}

function decodedId(value: string | undefined) {
  try {
    return decodeURIComponent(value ?? "").trim();
  } catch {
    return "";
  }
}

async function getMenuItem(env: Env, id: string) {
  const rows = await readAdminRows<MenuItemRow>(
    env,
    `SELECT ${MENU_ITEM_ADMIN_ROW_COLUMNS.join(", ")}
     FROM menu_items
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

async function getMenuChild(env: Env, parentId: string) {
  const rows = await readAdminRows<Pick<MenuItemRow, "id">>(
    env,
    "SELECT id FROM menu_items WHERE parent_id = ? ORDER BY sort_order ASC LIMIT 1",
    [parentId]
  );
  return rows[0] ?? null;
}

async function validateMenuParent(
  env: Env,
  parentId: string,
  input: { currentParentId?: string; id: string }
): Promise<Response | null> {
  if (parentId === input.id) {
    return noStoreError("menu item cannot be its own parent", 400, { resource: "menu" });
  }

  if (
    input.currentParentId !== undefined &&
    input.currentParentId !== parentId &&
    (await getMenuChild(env, input.id))
  ) {
    return noStoreError("cannot move a menu item that has children", 409, { resource: "menu" });
  }

  if (parentId && !(await getMenuItem(env, parentId))) {
    return noStoreError("menu parent was not found", 400, { resource: "menu" });
  }

  return null;
}

function menuText(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

function menuParentId(value: unknown, fallback: string) {
  return value === null ? "" : menuText(value, fallback);
}

function menuOrder(value: unknown, fallback: number) {
  if (value === undefined) {
    return { order: fallback } as const;
  }

  const order = Number(value);
  return Number.isSafeInteger(order) && order >= 0
    ? ({ order } as const)
    : ({ response: noStoreError("invalid menu order", 400, { resource: "menu" }) } as const);
}

function changedRows(result: D1Result<unknown>) {
  const meta = result.meta as { changes?: number; rows_written?: number } | undefined;
  return Number(meta?.changes ?? meta?.rows_written ?? 0);
}

function mapMenu(row: MenuItemRow) {
  return {
    id: row.id,
    parentId: row.parent_id || null,
    label: row.label,
    href: row.href,
    enabled: row.enabled === 1,
    order: row.sort_order,
    updatedAt: row.updated_at,
    revision: Number(row.revision ?? 0)
  };
}

function invalidMenuHref(href: string) {
  return !isValidCmsLink(href, "navigation", false)
    ? noStoreError("invalid menu href", 400, { resource: "menu", field: "href" })
    : null;
}

export async function handleAdminMenuMutation(
  request: Request,
  env: Env,
  segments: string[],
  identity: AdminIdentity
): Promise<Response | null> {
  if (request.method === "POST" && segments.length === 1) {
    const parsed = await readRequestRecord(request);

    if ("response" in parsed) {
      return parsed.response ?? noStoreError("invalid menu request", 400);
    }

    const id = menuText(parsed.body.id, `menu-${crypto.randomUUID()}`);
    const label = menuText(parsed.body.label, "");
    const href = menuText(parsed.body.href, "");
    const parentId = menuText(parsed.body.parentId, "");
    const parsedOrder = menuOrder(parsed.body.order, 0);

    if (!id || id.length > 200 || !label || !href) {
      return noStoreError("menu id, label, and href are required", 400, { resource: "menu" });
    }

    const hrefError = invalidMenuHref(href);
    if (hrefError) {
      return hrefError;
    }

    if (typeof parsed.body.enabled !== "undefined" && typeof parsed.body.enabled !== "boolean") {
      return noStoreError("invalid menu enabled value", 400, { resource: "menu" });
    }

    if ("response" in parsedOrder) {
      return parsedOrder.response ?? noStoreError("invalid menu order", 400);
    }

    if (await getMenuItem(env, id)) {
      return noStoreError("duplicate menu item id", 409, { resource: "menu" });
    }

    const parentError = await validateMenuParent(env, parentId, { id });

    if (parentError) {
      return parentError;
    }

    const now = new Date().toISOString();
    const row: MenuItemRow = {
      id,
      parent_id: parentId,
      label,
      href,
      enabled: parsed.body.enabled === false ? 0 : 1,
      sort_order: parsedOrder.order,
      children_json: "[]",
      updated_at: now,
      created_at: now,
      updated_by: identity.actor,
      revision: 0
    };
    await requireD1Database(env)
      .prepare(
        `INSERT INTO menu_items (${MENU_ITEM_ADMIN_ROW_COLUMNS.join(", ")})
         VALUES (${MENU_ITEM_ADMIN_ROW_COLUMNS.map(() => "?").join(", ")})`
      )
      .bind(...MENU_ITEM_ADMIN_ROW_COLUMNS.map((column) => row[column]))
      .run();
    return noStoreJson({ item: mapMenu(row) }, { status: 201 });
  }

  const id = decodedId(segments[1]);

  if (!id || segments.length !== 2) {
    return null;
  }

  const current = await getMenuItem(env, id);

  if (!current) {
    return noStoreError("not found", 404, { resource: "menu" });
  }

  if (request.method === "PATCH") {
    const parsed = await readRequestRecord(request);

    if ("response" in parsed) {
      return parsed.response ?? noStoreError("invalid menu request", 400);
    }

    const expected = menuExpectedRevision(request, parsed.body);

    if ("response" in expected) {
      return expected.response ?? noStoreError("invalid expected revision", 400);
    }

    if (Number(current.revision ?? 0) !== expected.revision) {
      return noStoreError("stale revision", 409, {
        resource: "menu",
        expectedRevision: expected.revision,
        currentRevision: Number(current.revision ?? 0)
      });
    }

    const label = menuText(parsed.body.label, current.label);
    const href = menuText(parsed.body.href, current.href);
    const parentId = menuParentId(parsed.body.parentId, current.parent_id);
    const parsedOrder = menuOrder(parsed.body.order, current.sort_order);

    if (!label || !href) {
      return noStoreError("menu label and href are required", 400, { resource: "menu" });
    }

    const hrefError = invalidMenuHref(href);
    if (hrefError) {
      return hrefError;
    }

    if (typeof parsed.body.enabled !== "undefined" && typeof parsed.body.enabled !== "boolean") {
      return noStoreError("invalid menu enabled value", 400, { resource: "menu" });
    }

    if ("response" in parsedOrder) {
      return parsedOrder.response ?? noStoreError("invalid menu order", 400);
    }

    const parentError = await validateMenuParent(env, parentId, {
      id,
      currentParentId: current.parent_id
    });

    if (parentError) {
      return parentError;
    }

    const now = new Date().toISOString();
    const enabled = parsed.body.enabled === undefined ? current.enabled : parsed.body.enabled ? 1 : 0;
    const result = await requireD1Database(env)
      .prepare(
        `UPDATE menu_items
         SET parent_id = ?, label = ?, href = ?, enabled = ?, sort_order = ?, updated_at = ?, updated_by = ?,
             revision = revision + 1
         WHERE id = ? AND revision = ?`
      )
      .bind(parentId, label, href, enabled, parsedOrder.order, now, identity.actor, id, expected.revision)
      .run();

    if (changedRows(result) === 0) {
      return noStoreError("stale revision", 409, { resource: "menu" });
    }

    return noStoreJson({
      item: mapMenu({
        ...current,
        parent_id: parentId,
        label,
        href,
        enabled,
        sort_order: parsedOrder.order,
        updated_at: now,
        revision: expected.revision + 1
      })
    });
  }

  if (request.method === "DELETE") {
    const expected = menuExpectedRevision(request);

    if ("response" in expected) {
      return expected.response ?? noStoreError("invalid expected revision", 400);
    }

    if (Number(current.revision ?? 0) !== expected.revision) {
      return noStoreError("stale revision", 409, { resource: "menu" });
    }

    if (await getMenuChild(env, id)) {
      return noStoreError("menu item has children", 409, { resource: "menu" });
    }

    const result = await requireD1Database(env)
      .prepare("DELETE FROM menu_items WHERE id = ? AND revision = ?")
      .bind(id, expected.revision)
      .run();

    if (changedRows(result) === 0) {
      return noStoreError("stale revision", 409, { resource: "menu" });
    }

    return noStoreJson({ id, deleted: true });
  }

  return null;
}
