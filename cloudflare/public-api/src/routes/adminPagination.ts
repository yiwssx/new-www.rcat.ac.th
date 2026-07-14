import { canManageContent, canManageMenu, canReadAdminData, type AdminIdentity } from "../auth/adminAccess";
import {
  ADMIN_MEDIA_DEFAULT_PAGE_SIZE,
  parseAdminPagination,
  type AdminPaginatedResponse
} from "../contracts/adminPagination";
import { readAdminPage, readAdminRows, type AdminPageSql, type AdminSqlFilter } from "../db/adminPaginationRepository";
import { requireD1Database } from "../db/documentsRepository";
import {
  MENU_ITEM_ADMIN_ROW_COLUMNS,
  type AdminUserRow,
  type CarouselSlideRow,
  type ContentRow,
  type DocumentRow,
  type EventRow,
  type ExternalServiceRow,
  type MediaAssetRow,
  type MenuItemRow
} from "../db/schema";
/*
 * These list routes intentionally select explicit summary columns. In
 * particular, CONTENT_LIST_COLUMNS must never grow to include body_snapshot.
 */
import type { Env } from "../env";
import { json, jsonError } from "../responses";

type SortDirection = "ASC" | "DESC";

interface SortOption {
  column: string;
  defaultDirection: SortDirection;
}

type ContentListRow = Pick<
  ContentRow,
  | "id"
  | "slug"
  | "type"
  | "status"
  | "owner"
  | "title"
  | "summary"
  | "category"
  | "canonical_url"
  | "featured"
  | "template"
  | "featured_media_id"
  | "view_count"
  | "last_viewed_at"
  | "updated_at"
  | "publish_at"
  | "revision"
>;

type DocumentListRow = Pick<
  DocumentRow,
  | "id"
  | "title"
  | "description"
  | "category"
  | "file_url"
  | "file_name"
  | "media_id"
  | "published_at"
  | "status"
  | "sort_order"
  | "pinned"
  | "updated_at"
  | "revision"
>;

type MenuListRow = Pick<
  MenuItemRow,
  "id" | "parent_id" | "label" | "href" | "enabled" | "sort_order" | "updated_at" | "revision"
>;

type CarouselListRow = Pick<
  CarouselSlideRow,
  | "id"
  | "title"
  | "subtitle"
  | "chip"
  | "image_url"
  | "image_alt"
  | "button_label"
  | "href"
  | "image_fit"
  | "focal_point_x"
  | "focal_point_y"
  | "mobile_image_url"
  | "background_color"
  | "open_in_new_tab"
  | "enabled"
  | "sort_order"
  | "start_at"
  | "end_at"
  | "updated_at"
  | "revision"
>;

type ExternalServiceListRow = Pick<
  ExternalServiceRow,
  "id" | "title" | "description" | "href" | "tone" | "icon_key" | "enabled" | "sort_order" | "updated_at" | "revision"
>;

type EventListRow = Pick<
  EventRow,
  | "id"
  | "title"
  | "date"
  | "end_date"
  | "audience"
  | "status"
  | "location"
  | "description"
  | "category"
  | "visibility"
  | "updated_at"
  | "revision"
>;

const CONTENT_LIST_COLUMNS = [
  "id",
  "slug",
  "type",
  "status",
  "owner",
  "title",
  "summary",
  "category",
  "canonical_url",
  "featured",
  "template",
  "featured_media_id",
  "view_count",
  "last_viewed_at",
  "updated_at",
  "publish_at",
  "revision"
] as const satisfies readonly (keyof ContentListRow)[];

const DOCUMENT_LIST_COLUMNS = [
  "id",
  "title",
  "description",
  "category",
  "file_url",
  "file_name",
  "media_id",
  "published_at",
  "status",
  "sort_order",
  "pinned",
  "updated_at",
  "revision"
] as const satisfies readonly (keyof DocumentListRow)[];

const MEDIA_LIST_COLUMNS = [
  "id",
  "name",
  "type",
  "size",
  "owner",
  "drive_url",
  "file_id",
  "mime_type",
  "preview_url",
  "embed_url",
  "thumbnail_url",
  "updated_at"
] as const satisfies readonly (keyof MediaAssetRow)[];

const EVENT_LIST_COLUMNS = [
  "id",
  "title",
  "date",
  "end_date",
  "audience",
  "status",
  "location",
  "description",
  "category",
  "visibility",
  "updated_at",
  "revision"
] as const satisfies readonly (keyof EventListRow)[];

const USER_LIST_COLUMNS = [
  "id",
  "email",
  "name",
  "role",
  "status",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "revision"
] as const satisfies readonly (keyof AdminUserRow)[];

const CAROUSEL_LIST_COLUMNS = [
  "id",
  "title",
  "subtitle",
  "chip",
  "image_url",
  "image_alt",
  "button_label",
  "href",
  "image_fit",
  "focal_point_x",
  "focal_point_y",
  "mobile_image_url",
  "background_color",
  "open_in_new_tab",
  "enabled",
  "sort_order",
  "start_at",
  "end_at",
  "updated_at",
  "revision"
] as const satisfies readonly (keyof CarouselListRow)[];

const EXTERNAL_SERVICE_LIST_COLUMNS = [
  "id",
  "title",
  "description",
  "href",
  "tone",
  "icon_key",
  "enabled",
  "sort_order",
  "updated_at",
  "revision"
] as const satisfies readonly (keyof ExternalServiceListRow)[];

const MENU_LIST_COLUMNS = [
  "id",
  "parent_id",
  "label",
  "href",
  "enabled",
  "sort_order",
  "updated_at",
  "revision"
] as const satisfies readonly (keyof MenuListRow)[];

const CONTENT_SORTS = {
  updatedAt: { column: "updated_at", defaultDirection: "DESC" },
  publishAt: { column: "publish_at", defaultDirection: "DESC" },
  title: { column: "title", defaultDirection: "ASC" },
  createdAt: { column: "created_at", defaultDirection: "DESC" },
  status: { column: "status", defaultDirection: "ASC" },
  type: { column: "type", defaultDirection: "ASC" },
  viewCount: { column: "view_count", defaultDirection: "DESC" }
} as const satisfies Record<string, SortOption>;

const DOCUMENT_SORTS = {
  updatedAt: { column: "updated_at", defaultDirection: "DESC" },
  publishedAt: { column: "published_at", defaultDirection: "DESC" },
  title: { column: "title", defaultDirection: "ASC" },
  createdAt: { column: "created_at", defaultDirection: "DESC" },
  order: { column: "sort_order", defaultDirection: "ASC" },
  pinned: { column: "pinned", defaultDirection: "DESC" }
} as const satisfies Record<string, SortOption>;

const MEDIA_SORTS = {
  updatedAt: { column: "updated_at", defaultDirection: "DESC" },
  name: { column: "name", defaultDirection: "ASC" },
  type: { column: "type", defaultDirection: "ASC" },
  owner: { column: "owner", defaultDirection: "ASC" }
} as const satisfies Record<string, SortOption>;

const EVENT_SORTS = {
  date: { column: "date", defaultDirection: "DESC" },
  updatedAt: { column: "updated_at", defaultDirection: "DESC" },
  title: { column: "title", defaultDirection: "ASC" },
  status: { column: "status", defaultDirection: "ASC" },
  category: { column: "category", defaultDirection: "ASC" }
} as const satisfies Record<string, SortOption>;

const USER_SORTS = {
  email: { column: "email", defaultDirection: "ASC" },
  name: { column: "name", defaultDirection: "ASC" },
  role: { column: "role", defaultDirection: "ASC" },
  status: { column: "status", defaultDirection: "ASC" },
  createdAt: { column: "created_at", defaultDirection: "DESC" },
  updatedAt: { column: "updated_at", defaultDirection: "DESC" }
} as const satisfies Record<string, SortOption>;

const CAROUSEL_SORTS = {
  order: { column: "sort_order", defaultDirection: "ASC" },
  title: { column: "title", defaultDirection: "ASC" },
  updatedAt: { column: "updated_at", defaultDirection: "DESC" },
  startAt: { column: "start_at", defaultDirection: "DESC" },
  enabled: { column: "enabled", defaultDirection: "DESC" }
} as const satisfies Record<string, SortOption>;

const EXTERNAL_SERVICE_SORTS = {
  order: { column: "sort_order", defaultDirection: "ASC" },
  title: { column: "title", defaultDirection: "ASC" },
  updatedAt: { column: "updated_at", defaultDirection: "DESC" },
  enabled: { column: "enabled", defaultDirection: "DESC" }
} as const satisfies Record<string, SortOption>;

const MENU_SORTS = {
  order: { column: "sort_order", defaultDirection: "ASC" },
  label: { column: "label", defaultDirection: "ASC" },
  updatedAt: { column: "updated_at", defaultDirection: "DESC" },
  enabled: { column: "enabled", defaultDirection: "DESC" }
} as const satisfies Record<string, SortOption>;

const MEDIA_BY_IDS_LIMIT = 50;
const ORDER_SAVE_ITEM_LIMIT = 2_000;
const PUBLISHABLE_CONTENT_SQL =
  "(status = ? OR (status = ? AND COALESCE(publish_at, '') <> '' AND datetime(publish_at) <= datetime(?)))";
const REVIEW_CONTENT_STATUS = "review";
const SCHEDULED_CONTENT_STATUS = "scheduled";

interface CompactOrderInput {
  enabled?: boolean;
  id: string;
  order: number;
  parentId?: string;
  pinned?: boolean;
  revision: number;
}

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

function trimmedParam(searchParams: URLSearchParams, name: string, maxLength = 200) {
  return (searchParams.get(name) ?? "").trim().slice(0, maxLength);
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function searchFilter(searchParams: URLSearchParams, columns: readonly string[]): AdminSqlFilter | null {
  const query = trimmedParam(searchParams, "q");

  if (!query) {
    return null;
  }

  const pattern = `%${escapeLike(query)}%`;
  return {
    clause: `(${columns.map((column) => `${column} LIKE ? ESCAPE '\\'`).join(" OR ")})`,
    bindings: columns.map(() => pattern)
  };
}

function exactFilter(searchParams: URLSearchParams, parameter: string, column: string): AdminSqlFilter | null {
  const value = trimmedParam(searchParams, parameter);

  if (!value || value.toLowerCase() === "all") {
    return null;
  }

  return { clause: `${column} = ?`, bindings: [value] };
}

function booleanFilter(searchParams: URLSearchParams, parameter: string, column: string): AdminSqlFilter | null {
  const value = trimmedParam(searchParams, parameter).toLowerCase();

  if (!value || value === "all") {
    return null;
  }

  if (["1", "true", "yes", "enabled", "pinned"].includes(value)) {
    return { clause: `${column} = ?`, bindings: [1] };
  }

  if (["0", "false", "no", "disabled", "unpinned"].includes(value)) {
    return { clause: `${column} = ?`, bindings: [0] };
  }

  return null;
}

function compactFilters(filters: Array<AdminSqlFilter | null>) {
  return filters.filter((filter): filter is AdminSqlFilter => filter !== null);
}

function orderBy(
  searchParams: URLSearchParams,
  sorts: Record<string, SortOption>,
  fallback: string,
  tieBreaker = "id ASC"
) {
  const requestedSort = trimmedParam(searchParams, "sortBy", 40);
  const option = sorts[requestedSort];

  if (!option) {
    return fallback;
  }

  const requestedDirection = trimmedParam(searchParams, "sortDirection", 10).toLowerCase();
  const direction: SortDirection =
    requestedDirection === "asc" ? "ASC" : requestedDirection === "desc" ? "DESC" : option.defaultDirection;
  return `${option.column} ${direction}, ${tieBreaker}`;
}

function documentOrderBy(searchParams: URLSearchParams) {
  const requestedSort = trimmedParam(searchParams, "sortBy", 40);

  if (requestedSort !== "pinned") {
    return orderBy(
      searchParams,
      DOCUMENT_SORTS,
      "pinned DESC, sort_order ASC, published_at DESC, updated_at DESC, id ASC"
    );
  }

  const requestedDirection = trimmedParam(searchParams, "sortDirection", 10).toLowerCase();
  const direction: SortDirection = requestedDirection === "asc" ? "ASC" : "DESC";
  return `pinned ${direction}, sort_order ASC, published_at DESC, updated_at DESC, id ASC`;
}

function publishableContentBindings(now: string) {
  return [REVIEW_CONTENT_STATUS, SCHEDULED_CONTENT_STATUS, now] as const;
}

function mapContent(row: ContentListRow) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    status: row.status,
    owner: row.owner ?? "",
    summary: row.summary,
    category: row.category,
    canonicalUrl: row.canonical_url,
    featured: row.featured === 1,
    template: row.template,
    featuredMediaId: row.featured_media_id,
    viewCount: row.view_count,
    lastViewedAt: row.last_viewed_at,
    updatedAt: row.updated_at,
    publishAt: row.publish_at,
    revision: Number(row.revision ?? 0)
  };
}

function mapDocument(row: DocumentListRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    fileUrl: row.file_url,
    fileName: row.file_name,
    mediaId: row.media_id,
    publishedAt: row.published_at,
    status: row.status,
    order: row.sort_order,
    pinned: row.pinned === 1,
    updatedAt: row.updated_at,
    revision: Number(row.revision ?? 0)
  };
}

function mapMedia(row: MediaAssetRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    size: row.size,
    owner: row.owner,
    driveUrl: row.drive_url,
    fileId: row.file_id,
    mimeType: row.mime_type,
    thumbnailUrl: row.thumbnail_url,
    previewUrl: row.preview_url,
    embedUrl: row.embed_url,
    updatedAt: row.updated_at
  };
}

function mapEvent(row: EventListRow) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    ...(row.end_date ? { endDate: row.end_date } : {}),
    audience: row.audience,
    status: row.status,
    ...(row.location ? { location: row.location } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.category ? { category: row.category } : {}),
    visibility: row.visibility,
    updatedAt: row.updated_at,
    revision: Number(row.revision ?? 0)
  };
}

function mapUser(row: AdminUserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision
  };
}

function normalizeCarouselImageFit(value: unknown) {
  return value === "fill" || value === "fit" || value === "fit-blur" ? value : "fit-blur";
}

function normalizeCarouselFocalPoint(value: unknown) {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : 50;
}

function normalizeCarouselBackgroundColor(value: unknown) {
  const color = typeof value === "string" ? value.trim().toLowerCase() : "";
  return color === "" || /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(color) ? color : "";
}

function mapCarousel(row: CarouselListRow) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    chip: row.chip,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    buttonLabel: row.button_label,
    href: row.href,
    imageFit: normalizeCarouselImageFit(row.image_fit),
    focalPointX: normalizeCarouselFocalPoint(row.focal_point_x),
    focalPointY: normalizeCarouselFocalPoint(row.focal_point_y),
    mobileImageUrl: String(row.mobile_image_url ?? "").trim(),
    backgroundColor: normalizeCarouselBackgroundColor(row.background_color),
    openInNewTab: row.open_in_new_tab === 1,
    enabled: row.enabled === 1,
    order: row.sort_order,
    ...(row.start_at ? { startAt: row.start_at } : {}),
    ...(row.end_at ? { endAt: row.end_at } : {}),
    updatedAt: row.updated_at,
    revision: Number(row.revision ?? 0)
  };
}

function mapExternalService(row: ExternalServiceListRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    href: row.href,
    tone: row.tone,
    iconKey: row.icon_key,
    enabled: row.enabled === 1,
    order: row.sort_order,
    updatedAt: row.updated_at,
    revision: Number(row.revision ?? 0)
  };
}

function mapMenu(row: MenuListRow) {
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
    `SELECT id FROM menu_items WHERE parent_id = ? ORDER BY sort_order ASC LIMIT 1`,
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

async function handleMenuItemMutation(request: Request, env: Env, segments: string[], identity: AdminIdentity) {
  if (!canManageMenu(identity)) {
    return noStoreError("menu management permission is required", 403, { resource: "menu" });
  }

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

async function paginatedResponse<TRow, TItem>(
  request: Request,
  env: Env,
  sql: AdminPageSql,
  map: (row: TRow) => TItem,
  defaultPageSize?: number
) {
  const requested = parseAdminPagination(new URL(request.url).searchParams, defaultPageSize);
  const result = await readAdminPage<TRow>(env, sql, requested);
  const response: AdminPaginatedResponse<TItem> = {
    items: result.rows.map(map),
    pagination: result.pagination,
    generatedAt: new Date().toISOString()
  };
  return noStoreJson(response);
}

function contentSql(searchParams: URLSearchParams): AdminPageSql {
  return {
    columns: CONTENT_LIST_COLUMNS,
    from: "contents",
    filters: compactFilters([
      { clause: "COALESCE(deleted_at, '') = ''", bindings: [] },
      searchFilter(searchParams, ["title", "summary", "slug", "category", "owner", "tags_json"]),
      exactFilter(searchParams, "status", "status"),
      exactFilter(searchParams, "type", "type"),
      exactFilter(searchParams, "category", "category"),
      exactFilter(searchParams, "owner", "owner"),
      booleanFilter(searchParams, "featured", "featured")
    ]),
    orderBy: orderBy(searchParams, CONTENT_SORTS, "updated_at DESC, id ASC")
  };
}

function documentSql(searchParams: URLSearchParams): AdminPageSql {
  return {
    columns: DOCUMENT_LIST_COLUMNS,
    from: "documents",
    filters: compactFilters([
      { clause: "COALESCE(deleted_at, '') = ''", bindings: [] },
      searchFilter(searchParams, ["title", "description", "category", "file_name", "file_url"]),
      exactFilter(searchParams, "status", "status"),
      exactFilter(searchParams, "category", "category"),
      booleanFilter(searchParams, "pinned", "pinned")
    ]),
    orderBy: documentOrderBy(searchParams)
  };
}

function mediaSql(searchParams: URLSearchParams): AdminPageSql {
  return {
    columns: MEDIA_LIST_COLUMNS,
    from: "media_assets",
    filters: compactFilters([
      searchFilter(searchParams, ["name", "owner", "file_id", "mime_type", "type"]),
      exactFilter(searchParams, "type", "type")
    ]),
    orderBy: orderBy(searchParams, MEDIA_SORTS, "updated_at DESC, id ASC")
  };
}

function eventSql(searchParams: URLSearchParams): AdminPageSql {
  return {
    columns: EVENT_LIST_COLUMNS,
    from: "events",
    filters: compactFilters([
      searchFilter(searchParams, ["title", "audience", "location", "description", "category"]),
      exactFilter(searchParams, "status", "status"),
      exactFilter(searchParams, "visibility", "visibility"),
      exactFilter(searchParams, "category", "category")
    ]),
    orderBy: orderBy(searchParams, EVENT_SORTS, "date DESC, id ASC")
  };
}

function userSql(searchParams: URLSearchParams): AdminPageSql {
  return {
    columns: USER_LIST_COLUMNS,
    from: "app_admin_users",
    filters: compactFilters([
      searchFilter(searchParams, ["email", "name"]),
      exactFilter(searchParams, "role", "role"),
      exactFilter(searchParams, "status", "status")
    ]),
    orderBy: orderBy(searchParams, USER_SORTS, "role ASC, email ASC, id ASC")
  };
}

function carouselSql(searchParams: URLSearchParams): AdminPageSql {
  return {
    columns: CAROUSEL_LIST_COLUMNS,
    from: "carousel_slides",
    filters: compactFilters([
      searchFilter(searchParams, ["title", "subtitle", "chip"]),
      booleanFilter(searchParams, "enabled", "enabled")
    ]),
    orderBy: orderBy(searchParams, CAROUSEL_SORTS, "sort_order ASC, id ASC")
  };
}

function externalServiceSql(searchParams: URLSearchParams): AdminPageSql {
  return {
    columns: EXTERNAL_SERVICE_LIST_COLUMNS,
    from: "external_services",
    filters: compactFilters([
      searchFilter(searchParams, ["title", "description", "href"]),
      booleanFilter(searchParams, "enabled", "enabled"),
      exactFilter(searchParams, "tone", "tone")
    ]),
    orderBy: orderBy(searchParams, EXTERNAL_SERVICE_SORTS, "sort_order ASC, id ASC")
  };
}

function menuSql(searchParams: URLSearchParams): AdminPageSql {
  const parentRoot = booleanFilter(searchParams, "parentRoot", "COALESCE(parent_id, '') = ''");

  return {
    columns: MENU_LIST_COLUMNS,
    from: "menu_items",
    filters: compactFilters([
      searchFilter(searchParams, ["label", "href"]),
      booleanFilter(searchParams, "enabled", "enabled"),
      parentRoot ?? exactFilter(searchParams, "parentId", "parent_id")
    ]),
    orderBy: orderBy(searchParams, MENU_SORTS, "parent_id ASC, sort_order ASC, id ASC")
  };
}

async function handleMediaByIds(request: Request, env: Env) {
  const rawIds = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = [
    ...new Set(
      rawIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  ];

  if (ids.length > MEDIA_BY_IDS_LIMIT) {
    return noStoreError("too many media ids", 400, {
      resource: "media",
      maximumIds: MEDIA_BY_IDS_LIMIT
    });
  }

  if (ids.some((id) => id.length > 200)) {
    return noStoreError("invalid media id", 400, { resource: "media" });
  }

  if (!ids.length) {
    return noStoreJson({ items: [], generatedAt: new Date().toISOString() });
  }

  const placeholders = ids.map(() => "?").join(", ");
  const rows = await readAdminRows<MediaAssetRow>(
    env,
    `SELECT ${MEDIA_LIST_COLUMNS.join(", ")} FROM media_assets WHERE id IN (${placeholders})`,
    ids
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return noStoreJson({
    items: ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [mapMedia(row)] : [];
    }),
    generatedAt: new Date().toISOString()
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function parseCompactOrderItems(request: Request, entity: string) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return { response: noStoreError("malformed JSON request body", 400) } as const;
  }

  if (!isRecord(body) || !Array.isArray(body.items)) {
    return { response: noStoreError("order items must be an array", 400) } as const;
  }

  if (body.items.length > ORDER_SAVE_ITEM_LIMIT) {
    return {
      response: noStoreError("too many order items", 400, { maximumItems: ORDER_SAVE_ITEM_LIMIT })
    } as const;
  }

  const requiresPinned = entity === "documents";
  const requiresEnabled = entity !== "documents";
  const seen = new Set<string>();
  const seenOrders = new Set<string>();
  const items: CompactOrderInput[] = [];

  for (const value of body.items) {
    if (!isRecord(value)) {
      return { response: noStoreError("invalid order item", 400) } as const;
    }

    const id = typeof value.id === "string" ? value.id.trim() : "";
    const order = Number(value.order);
    const revision = Number(value.revision);

    if (!id || id.length > 200 || seen.has(id)) {
      return {
        response: noStoreError(seen.has(id) ? "duplicate order item id" : "invalid order item id", 400)
      } as const;
    }

    if (!Number.isSafeInteger(order) || order < 0) {
      return { response: noStoreError("invalid order value", 400) } as const;
    }

    if (!Number.isSafeInteger(revision) || revision < 0) {
      return { response: noStoreError("invalid order item revision", 400) } as const;
    }

    if (requiresPinned && typeof value.pinned !== "boolean") {
      return { response: noStoreError("document order item pinned value is required", 400) } as const;
    }

    if (requiresEnabled && typeof value.enabled !== "boolean") {
      return { response: noStoreError("order item enabled value is required", 400) } as const;
    }

    const parentId =
      entity === "menu"
        ? value.parentId === null
          ? ""
          : typeof value.parentId === "string"
            ? value.parentId.trim()
            : null
        : undefined;

    if (entity === "menu" && (typeof parentId !== "string" || parentId.length > 200)) {
      return { response: noStoreError("menu order item parent id is invalid", 400) } as const;
    }

    const orderGroup = requiresPinned ? `pinned:${value.pinned}` : entity === "menu" ? `parent:${parentId}` : "all";

    if (seenOrders.has(`${orderGroup}:${order}`)) {
      return { response: noStoreError("duplicate order value", 400) } as const;
    }

    seen.add(id);
    seenOrders.add(`${orderGroup}:${order}`);
    items.push({
      id,
      order,
      revision,
      ...(entity === "menu" ? { parentId: parentId ?? "" } : {}),
      ...(requiresPinned ? { pinned: value.pinned as boolean } : {}),
      ...(requiresEnabled ? { enabled: value.enabled as boolean } : {})
    });
  }

  return { items } as const;
}

function changedRows(result: D1Result<unknown>) {
  const meta = result.meta as { changes?: number; rows_written?: number } | undefined;
  return Number(meta?.changes ?? meta?.rows_written ?? 0);
}

async function handleOrderSave(request: Request, env: Env, entity: string, identity: AdminIdentity) {
  const resource = `${entity}-order`;
  const allowed = entity === "menu" ? canManageMenu(identity) : canManageContent(identity);

  if (!allowed) {
    return noStoreError(
      entity === "menu" ? "menu management permission is required" : "content management permission is required",
      403,
      { resource }
    );
  }

  const parsed = await parseCompactOrderItems(request, entity);

  if ("response" in parsed) {
    return parsed.response ?? noStoreError("invalid order request", 400);
  }

  const config =
    entity === "documents"
      ? {
          table: "documents",
          flagColumn: "pinned",
          flagProperty: "pinned" as const,
          activeClause: "AND COALESCE(current.deleted_at, '') = ''",
          completeSetClause: "WHERE COALESCE(deleted_at, '') = ''",
          parentClause: "",
          updateActiveClause: "AND COALESCE(deleted_at, '') = ''"
        }
      : entity === "menu"
        ? {
            table: "menu_items",
            flagColumn: "enabled",
            flagProperty: "enabled" as const,
            activeClause: "",
            completeSetClause: "",
            parentClause: "AND submitted.parent_id = current.parent_id",
            updateActiveClause: ""
          }
        : entity === "carousel"
          ? {
              table: "carousel_slides",
              flagColumn: "enabled",
              flagProperty: "enabled" as const,
              activeClause: "",
              completeSetClause: "",
              parentClause: "",
              updateActiveClause: ""
            }
          : {
              table: "external_services",
              flagColumn: "enabled",
              flagProperty: "enabled" as const,
              activeClause: "",
              completeSetClause: "",
              parentClause: "",
              updateActiveClause: ""
            };

  if (!parsed.items.length) {
    const activeCountRows = await readAdminRows<{ total: number | string }>(
      env,
      `SELECT COUNT(*) AS total
       FROM ${config.table}
       ${config.completeSetClause}`
    );

    if (singleCount(activeCountRows) > 0) {
      return noStoreError("stale revision", 409, { resource });
    }

    return handleOrderList(entity, env);
  }

  const submitted = parsed.items.map((item) => ({
    id: item.id,
    order: item.order,
    revision: item.revision,
    flag: item[config.flagProperty] ? 1 : 0,
    parentId: item.parentId ?? ""
  }));
  const now = new Date().toISOString();
  const result = await requireD1Database(env)
    .prepare(
      `WITH submitted AS (
         SELECT
           CAST(json_extract(value, '$.id') AS TEXT) AS id,
           CAST(json_extract(value, '$.order') AS INTEGER) AS sort_order,
           CAST(json_extract(value, '$.revision') AS INTEGER) AS revision,
           CAST(json_extract(value, '$.flag') AS INTEGER) AS flag,
           CAST(json_extract(value, '$.parentId') AS TEXT) AS parent_id
         FROM json_each(?)
       ),
       valid_submission AS (
         SELECT COUNT(*) AS matched
         FROM ${config.table} AS current
         INNER JOIN submitted ON submitted.id = current.id
         WHERE submitted.revision = current.revision
         ${config.parentClause}
         ${config.activeClause}
       ),
       current_set AS (
         SELECT COUNT(*) AS total
         FROM ${config.table}
         ${config.completeSetClause}
       )
       UPDATE ${config.table}
       SET
         sort_order = (SELECT submitted.sort_order FROM submitted WHERE submitted.id = ${config.table}.id),
         ${config.flagColumn} = (SELECT submitted.flag FROM submitted WHERE submitted.id = ${config.table}.id),
         updated_at = ?,
         updated_by = ?,
         revision = revision + 1
       WHERE id IN (SELECT id FROM submitted)
         ${config.updateActiveClause}
         AND (SELECT matched FROM valid_submission) = ?
         AND (SELECT total FROM current_set) = ?
       RETURNING id`
    )
    .bind(JSON.stringify(submitted), now, identity.actor, submitted.length, submitted.length)
    .run<{ id: string }>();

  if ((result.results?.length ?? changedRows(result)) < submitted.length) {
    return noStoreError("stale revision", 409, { resource });
  }

  return handleOrderList(entity, env);
}

async function handleOrderList(entity: string, env: Env) {
  const generatedAt = new Date().toISOString();

  if (entity === "documents") {
    const rows = await readAdminRows<Pick<DocumentRow, "id" | "title" | "sort_order" | "pinned" | "revision">>(
      env,
      `SELECT id, title, sort_order, pinned, revision
       FROM documents
       WHERE COALESCE(deleted_at, '') = ''
       ORDER BY pinned DESC, sort_order ASC, title ASC, id ASC`
    );
    return noStoreJson({
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        order: row.sort_order,
        pinned: row.pinned === 1,
        revision: Number(row.revision ?? 0)
      })),
      generatedAt
    });
  }

  if (entity === "menu") {
    const rows = await readAdminRows<
      Pick<MenuItemRow, "id" | "parent_id" | "label" | "sort_order" | "enabled" | "revision">
    >(
      env,
      `SELECT id, parent_id, label, sort_order, enabled, revision
       FROM menu_items
       ORDER BY parent_id ASC, sort_order ASC, label ASC, id ASC`
    );
    return noStoreJson({
      items: rows.map((row) => ({
        id: row.id,
        parentId: row.parent_id || null,
        label: row.label,
        order: row.sort_order,
        enabled: row.enabled === 1,
        revision: Number(row.revision ?? 0)
      })),
      generatedAt
    });
  }

  if (entity === "carousel") {
    const rows = await readAdminRows<Pick<CarouselSlideRow, "id" | "title" | "sort_order" | "enabled" | "revision">>(
      env,
      `SELECT id, title, sort_order, enabled, revision
       FROM carousel_slides
       ORDER BY sort_order ASC, title ASC, id ASC`
    );
    return noStoreJson({
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        order: row.sort_order,
        enabled: row.enabled === 1,
        revision: Number(row.revision ?? 0)
      })),
      generatedAt
    });
  }

  const rows = await readAdminRows<Pick<ExternalServiceRow, "id" | "title" | "sort_order" | "enabled" | "revision">>(
    env,
    `SELECT id, title, sort_order, enabled, revision
     FROM external_services
     ORDER BY sort_order ASC, title ASC, id ASC`
  );
  return noStoreJson({
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      order: row.sort_order,
      enabled: row.enabled === 1,
      revision: Number(row.revision ?? 0)
    })),
    generatedAt
  });
}

type CountGroupRow = { key: string | number; total: number | string };

function groupedCounts(rows: CountGroupRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;

  rows.forEach((row) => {
    const count = Math.max(0, Number(row.total) || 0);
    counts[String(row.key)] = count;
    total += count;
  });
  counts.total = total;
  return counts;
}

function singleCount(rows: Array<{ total: number | string }>) {
  return Math.max(0, Number(rows[0]?.total) || 0);
}

async function handleDashboardSummary(env: Env) {
  const now = new Date().toISOString();
  const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const today = bangkokNow.toISOString().slice(0, 10);
  const [
    contentCountsRows,
    documentCountsRows,
    mediaCountRows,
    eventCountsRows,
    userCountsRows,
    carouselCountsRows,
    externalServiceCountsRows,
    menuCountsRows,
    publishableCountRows,
    pendingContentRows,
    recentContentRows,
    recentDocumentRows,
    recentEventRows
  ] = await Promise.all([
    readAdminRows<{ key: string; total: number | string }>(
      env,
      `SELECT status AS key, COUNT(*) AS total
       FROM contents
       WHERE COALESCE(deleted_at, '') = ''
       GROUP BY status`
    ),
    readAdminRows<{ key: string; total: number | string }>(
      env,
      `SELECT status AS key, COUNT(*) AS total
       FROM documents
       WHERE COALESCE(deleted_at, '') = ''
       GROUP BY status`
    ),
    readAdminRows<{ total: number | string }>(env, "SELECT COUNT(*) AS total FROM media_assets"),
    readAdminRows<{ key: string; total: number | string }>(
      env,
      "SELECT status AS key, COUNT(*) AS total FROM events GROUP BY status"
    ),
    readAdminRows<{ key: string; total: number | string }>(
      env,
      "SELECT status AS key, COUNT(*) AS total FROM app_admin_users GROUP BY status"
    ),
    readAdminRows<{ key: number; total: number | string }>(
      env,
      "SELECT enabled AS key, COUNT(*) AS total FROM carousel_slides GROUP BY enabled"
    ),
    readAdminRows<{ key: number; total: number | string }>(
      env,
      "SELECT enabled AS key, COUNT(*) AS total FROM external_services GROUP BY enabled"
    ),
    readAdminRows<{ key: number; total: number | string }>(
      env,
      "SELECT enabled AS key, COUNT(*) AS total FROM menu_items GROUP BY enabled"
    ),
    readAdminRows<{ total: number | string }>(
      env,
      `SELECT COUNT(*) AS total
       FROM contents
       WHERE COALESCE(deleted_at, '') = ''
         AND ${PUBLISHABLE_CONTENT_SQL}`,
      publishableContentBindings(now)
    ),
    readAdminRows<ContentListRow>(
      env,
      `SELECT ${CONTENT_LIST_COLUMNS.join(", ")}
       FROM contents
       WHERE COALESCE(deleted_at, '') = ''
         AND ${PUBLISHABLE_CONTENT_SQL}
       ORDER BY updated_at DESC, id ASC
       LIMIT 10`,
      publishableContentBindings(now)
    ),
    readAdminRows<ContentListRow>(
      env,
      `SELECT ${CONTENT_LIST_COLUMNS.join(", ")}
       FROM contents
       WHERE COALESCE(deleted_at, '') = ''
       ORDER BY updated_at DESC, id ASC
       LIMIT 10`
    ),
    readAdminRows<DocumentListRow>(
      env,
      `SELECT ${DOCUMENT_LIST_COLUMNS.join(", ")}
       FROM documents
       WHERE COALESCE(deleted_at, '') = ''
       ORDER BY updated_at DESC, id ASC
       LIMIT 5`
    ),
    readAdminRows<EventListRow>(
      env,
      `SELECT ${EVENT_LIST_COLUMNS.join(", ")}
       FROM events
       WHERE status <> ? AND date >= ?
       ORDER BY date ASC, id ASC
       LIMIT 5`,
      ["cancelled", today]
    )
  ]);
  const contentCounts = groupedCounts(contentCountsRows);
  const documentCounts = groupedCounts(documentCountsRows);
  const eventCounts = groupedCounts(eventCountsRows);
  const userCounts = groupedCounts(userCountsRows);
  const carouselGroups = groupedCounts(carouselCountsRows);
  const externalServiceGroups = groupedCounts(externalServiceCountsRows);
  const menuGroups = groupedCounts(menuCountsRows);
  const mediaTotal = singleCount(mediaCountRows);
  const publishableCount = singleCount(publishableCountRows);
  const content = pendingContentRows.map(mapContent);
  const recentContent = recentContentRows.map(mapContent);
  const documents = recentDocumentRows.map(mapDocument);
  const events = recentEventRows.map(mapEvent);

  return noStoreJson({
    metrics: [
      {
        id: "published-content",
        label: "Published content",
        value: String(contentCounts.published ?? 0),
        trend: `${contentCounts.total} total records`,
        tone: "blue"
      },
      {
        id: "review-queue",
        label: "Publishable queue",
        value: String(publishableCount),
        trend: `${content.length} recent publishable records`,
        tone: "amber"
      },
      {
        id: "media-assets",
        label: "Media metadata",
        value: String(mediaTotal),
        trend: "Drive bridge references",
        tone: "green"
      },
      {
        id: "events",
        label: "Events",
        value: String(eventCounts.total),
        trend: `${eventCounts.confirmed ?? 0} confirmed`,
        tone: "blue"
      }
    ],
    counts: {
      content: contentCounts,
      documents: documentCounts,
      media: { total: mediaTotal },
      events: eventCounts,
      users: userCounts,
      carousel: {
        total: carouselGroups.total,
        enabled: carouselGroups["1"] ?? 0,
        disabled: carouselGroups["0"] ?? 0
      },
      externalServices: {
        total: externalServiceGroups.total,
        enabled: externalServiceGroups["1"] ?? 0,
        disabled: externalServiceGroups["0"] ?? 0
      },
      menu: {
        total: menuGroups.total,
        enabled: menuGroups["1"] ?? 0,
        disabled: menuGroups["0"] ?? 0
      }
    },
    publishableCount,
    content,
    recentContent,
    documents,
    recentDocuments: documents,
    events,
    recentEvents: events,
    generatedAt: new Date().toISOString()
  });
}

async function handleVisitorStatsSummary(env: Env) {
  const now = new Date();
  const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const today = bangkokNow.toISOString().slice(0, 10);
  const yesterdayDate = new Date(bangkokNow);
  yesterdayDate.setUTCDate(bangkokNow.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const rows = await readAdminRows<{
    online_users: number | string;
    total_users: number | string;
    total_views: number | string;
    updated_at: string;
    users_this_month: number | string;
    users_this_year: number | string;
    users_today: number | string;
    users_yesterday: number | string;
  }>(
    env,
    `SELECT
       COALESCE(SUM(total_views), 0) AS total_views,
       COALESCE(SUM(unique_visitors), 0) AS total_users,
       COALESCE(SUM(CASE WHEN day = ? THEN unique_visitors ELSE 0 END), 0) AS users_today,
       COALESCE(SUM(CASE WHEN day = ? THEN unique_visitors ELSE 0 END), 0) AS users_yesterday,
       COALESCE(SUM(CASE WHEN substr(day, 1, 7) = ? THEN unique_visitors ELSE 0 END), 0) AS users_this_month,
       COALESCE(SUM(CASE WHEN substr(day, 1, 4) = ? THEN unique_visitors ELSE 0 END), 0) AS users_this_year,
       COALESCE(MAX(CASE WHEN day = ? THEN online_users ELSE 0 END), 0) AS online_users,
       COALESCE(MAX(updated_at), '') AS updated_at
     FROM visitor_daily_stats`,
    [today, yesterday, month, year, today]
  );
  const row = rows[0];

  return noStoreJson({
    enabled: true,
    usersToday: Math.max(0, Number(row?.users_today) || 0),
    usersYesterday: Math.max(0, Number(row?.users_yesterday) || 0),
    usersThisMonth: Math.max(0, Number(row?.users_this_month) || 0),
    usersThisYear: Math.max(0, Number(row?.users_this_year) || 0),
    totalUsers: Math.max(0, Number(row?.total_users) || 0),
    totalViews: Math.max(0, Number(row?.total_views) || 0),
    onlineUsers: Math.max(0, Number(row?.online_users) || 0),
    updatedAt: row?.updated_at || now.toISOString()
  });
}

async function handlePublishPending(env: Env, identity: AdminIdentity) {
  if (!canManageContent(identity)) {
    return noStoreError("content management permission is required", 403, {
      resource: "content-publish-queue"
    });
  }

  const now = new Date().toISOString();
  const result = await requireD1Database(env)
    .prepare(
      `UPDATE contents
       SET
         status = ?,
         publish_at = CASE WHEN status = ? THEN ? ELSE publish_at END,
         updated_at = ?,
         updated_by = ?,
         revision = revision + 1
       WHERE COALESCE(deleted_at, '') = ''
         AND ${PUBLISHABLE_CONTENT_SQL}
       RETURNING id`
    )
    .bind("published", REVIEW_CONTENT_STATUS, now, now, identity.actor, ...publishableContentBindings(now))
    .run<{ id: string }>();

  return noStoreJson({ publishedCount: result.results?.length ?? changedRows(result) });
}

export async function handleAdminPaginatedReads(
  request: Request,
  env: Env,
  segments: string[],
  identity: AdminIdentity
): Promise<Response | null> {
  if (!canReadAdminData(identity)) {
    return noStoreError("admin read permission is required", 403, {
      resource: "admin-structured-data"
    });
  }

  const entity = segments[0] ?? "";

  if (
    entity === "menu" &&
    ((request.method === "POST" && segments.length === 1) ||
      (["PATCH", "DELETE"].includes(request.method) && segments.length === 2))
  ) {
    return handleMenuItemMutation(request, env, segments, identity);
  }

  if (request.method === "POST" && entity === "content" && segments.length === 2 && segments[1] === "publish-pending") {
    return handlePublishPending(env, identity);
  }

  if (
    request.method === "PUT" &&
    segments.length === 2 &&
    segments[1] === "order" &&
    ["documents", "menu", "carousel", "external-services"].includes(entity)
  ) {
    return handleOrderSave(request, env, entity, identity);
  }

  if (request.method !== "GET") {
    return null;
  }

  if (entity === "dashboard-summary" && segments.length === 1) {
    return handleDashboardSummary(env);
  }

  if (entity === "visitor-stats" && segments.length === 2 && segments[1] === "summary") {
    return handleVisitorStatsSummary(env);
  }

  if (entity === "media" && segments.length === 2 && segments[1] === "by-ids") {
    return handleMediaByIds(request, env);
  }

  if (
    segments.length === 2 &&
    segments[1] === "order" &&
    ["documents", "menu", "carousel", "external-services"].includes(entity)
  ) {
    return handleOrderList(entity, env);
  }

  if (segments.length !== 1) {
    return null;
  }

  const searchParams = new URL(request.url).searchParams;

  if (entity === "content") {
    return paginatedResponse<ContentListRow, ReturnType<typeof mapContent>>(
      request,
      env,
      contentSql(searchParams),
      mapContent
    );
  }

  if (entity === "documents") {
    return paginatedResponse<DocumentListRow, ReturnType<typeof mapDocument>>(
      request,
      env,
      documentSql(searchParams),
      mapDocument
    );
  }

  if (entity === "media") {
    return paginatedResponse<MediaAssetRow, ReturnType<typeof mapMedia>>(
      request,
      env,
      mediaSql(searchParams),
      mapMedia,
      ADMIN_MEDIA_DEFAULT_PAGE_SIZE
    );
  }

  if (entity === "events") {
    return paginatedResponse<EventListRow, ReturnType<typeof mapEvent>>(request, env, eventSql(searchParams), mapEvent);
  }

  if (entity === "users") {
    return paginatedResponse<AdminUserRow, ReturnType<typeof mapUser>>(request, env, userSql(searchParams), mapUser);
  }

  if (entity === "carousel") {
    return paginatedResponse<CarouselListRow, ReturnType<typeof mapCarousel>>(
      request,
      env,
      carouselSql(searchParams),
      mapCarousel
    );
  }

  if (entity === "external-services") {
    return paginatedResponse<ExternalServiceListRow, ReturnType<typeof mapExternalService>>(
      request,
      env,
      externalServiceSql(searchParams),
      mapExternalService
    );
  }

  if (entity === "menu") {
    return paginatedResponse<MenuListRow, ReturnType<typeof mapMenu>>(request, env, menuSql(searchParams), mapMenu);
  }

  return null;
}
