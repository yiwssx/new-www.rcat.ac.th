import { createEmptyPublicMetadata, createPublicMetadata } from "../adapters/publicMetadataAdapter";
import type { AdminIdentity } from "../auth/adminAccess";
import { requireD1Database } from "../db/documentsRepository";
import type { PublicMetadataRows } from "../db/publicMetadataRepository";
import {
  CAROUSEL_SLIDE_ADMIN_ROW_COLUMNS,
  CAROUSEL_SLIDE_ROW_COLUMNS,
  DISPLAY_SETTINGS_ADMIN_ROW_COLUMNS,
  DISPLAY_SETTINGS_ROW_COLUMNS,
  EVENT_ADMIN_ROW_COLUMNS,
  EVENT_ROW_COLUMNS,
  EXTERNAL_SERVICE_ADMIN_ROW_COLUMNS,
  EXTERNAL_SERVICE_ROW_COLUMNS,
  HOMEPAGE_SETTINGS_ADMIN_ROW_COLUMNS,
  HOMEPAGE_SETTINGS_ROW_COLUMNS,
  MEDIA_ASSET_ROW_COLUMNS,
  MENU_ITEM_ADMIN_ROW_COLUMNS,
  MENU_ITEM_ROW_COLUMNS,
  SITE_SETTINGS_ADMIN_ROW_COLUMNS,
  SITE_SETTINGS_ROW_COLUMNS,
  type CarouselSlideRow,
  type DisplaySettingsRow,
  type EventRow,
  type ExternalServiceRow,
  type HomepageSettingsRow,
  type MediaAssetRow,
  type MenuItemRow,
  type SiteSettingsRow
} from "../db/schema";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

type JsonRecord = Record<string, unknown>;
type SettingsKind = "site" | "homepage" | "display";

const settingsConfig = {
  site: {
    table: "site_settings",
    columns: SITE_SETTINGS_ROW_COLUMNS,
    adminColumns: SITE_SETTINGS_ADMIN_ROW_COLUMNS
  },
  homepage: {
    table: "homepage_settings",
    columns: HOMEPAGE_SETTINGS_ROW_COLUMNS,
    adminColumns: HOMEPAGE_SETTINGS_ADMIN_ROW_COLUMNS
  },
  display: {
    table: "display_settings",
    columns: DISPLAY_SETTINGS_ROW_COLUMNS,
    adminColumns: DISPLAY_SETTINGS_ADMIN_ROW_COLUMNS
  }
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJsonBody(request: Request) {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    throw new Error("invalid JSON body");
  }

  if (!isRecord(value)) {
    throw new Error("JSON body must be an object");
  }

  return value;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function parseStringArray(value: string | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item, index, items) => items.indexOf(item) === index);
  } catch {
    return [];
  }
}

function serializeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return "[]";
  }

  return JSON.stringify(
    value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item, index, items) => items.indexOf(item) === index)
      .slice(0, 12)
  );
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeImageFit(value: unknown) {
  return value === "fill" || value === "fit" || value === "fit-blur" ? value : "fit-blur";
}

function normalizeFocalPoint(value: unknown) {
  const number =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 50;
}

function normalizeBackgroundColor(value: unknown) {
  const color = typeof value === "string" ? value.trim().toLowerCase() : "";
  return color === "" || /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(color) ? color : "";
}

function deepMergeSettings(left: unknown, right: JsonRecord): unknown {
  if (!isRecord(left)) {
    return right;
  }
  const merged: JsonRecord = { ...left };
  Object.entries(right).forEach(([key, value]) => {
    merged[key] = isRecord(merged[key]) && isRecord(value) ? deepMergeSettings(merged[key], value) : value;
  });
  return merged;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function expectedRevision(request: Request) {
  const raw = request.headers.get("X-RCAT-Expected-Revision")?.trim();

  if (!raw) {
    return undefined;
  }

  const revision = Number(raw);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : undefined;
}

function requiredString(value: unknown, field: string) {
  const normalized = stringValue(value);

  if (!normalized) {
    throw new Error(`${field} is required`);
  }

  return normalized;
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function getRows<T>(env: Env, query: string, ...bindings: unknown[]) {
  const statement = requireD1Database(env).prepare(query);
  const result = await (bindings.length ? statement.bind(...bindings) : statement).all<T>();
  return result.results ?? [];
}

async function run(env: Env, query: string, ...bindings: unknown[]) {
  return requireD1Database(env)
    .prepare(query)
    .bind(...bindings)
    .run();
}

function getFallbackSettingsValue(kind: SettingsKind) {
  const fallback = createEmptyPublicMetadata();
  return kind === "site"
    ? fallback.siteSettings
    : kind === "homepage"
      ? fallback.homepageSettings
      : fallback.displaySettings;
}

function normalizeSettingsValue(kind: SettingsKind, value: unknown) {
  const fallbackValue = getFallbackSettingsValue(kind);
  const merged = isRecord(value) ? deepMergeSettings(fallbackValue, value) : fallbackValue;
  const row = { id: kind, settings_json: JSON.stringify(merged), updated_at: "" };
  const metadata = createPublicMetadata({
    siteSettings: kind === "site" ? row : null,
    homepageSettings: kind === "homepage" ? row : null,
    displaySettings: kind === "display" ? row : null,
    menu: [],
    media: [],
    carouselSlides: [],
    externalServices: [],
    events: []
  });

  return kind === "site"
    ? metadata.siteSettings
    : kind === "homepage"
      ? metadata.homepageSettings
      : metadata.displaySettings;
}

async function getSettings(env: Env, kind: SettingsKind) {
  const config = settingsConfig[kind];
  const rows = await getRows<{ id: string; settings_json: string; updated_at: string }>(
    env,
    `SELECT ${config.columns.join(", ")} FROM ${config.table} ORDER BY updated_at DESC LIMIT 1`
  );

  try {
    const parsed: unknown = JSON.parse(rows[0]?.settings_json || "{}");
    return {
      id: rows[0]?.id || kind,
      value: normalizeSettingsValue(kind, parsed)
    };
  } catch {
    return { id: rows[0]?.id || kind, value: getFallbackSettingsValue(kind) };
  }
}

async function handleSettings(request: Request, env: Env, segments: string[], actor: string) {
  const kind = segments[1] as SettingsKind | undefined;

  if (!kind || !(kind in settingsConfig) || segments.length !== 2) {
    return null;
  }

  if (request.method === "GET") {
    return json((await getSettings(env, kind)).value);
  }

  if (request.method !== "PUT") {
    return jsonError("method not allowed", 405);
  }

  const current = await getSettings(env, kind);
  const body = await readJsonBody(request);
  const value = normalizeSettingsValue(kind, deepMergeSettings(current.value, body));
  const now = new Date().toISOString();
  const config = settingsConfig[kind];

  await run(
    env,
    `INSERT INTO ${config.table} (${config.adminColumns.join(", ")})
     VALUES (${config.adminColumns.map(() => "?").join(", ")})
     ON CONFLICT(id) DO UPDATE SET
       settings_json = excluded.settings_json,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by,
       revision = ${config.table}.revision + 1`,
    current.id,
    JSON.stringify(value),
    now,
    now,
    actor,
    0
  );

  return json(value);
}

function flattenMenuItems(items: unknown[], actor: string, parentId = ""): MenuItemRow[] {
  return items.flatMap((value, index) => {
    if (!isRecord(value)) {
      return [];
    }

    const id = stringValue(value.id, makeId("menu"));
    const now = new Date().toISOString();
    const row: MenuItemRow = {
      id,
      parent_id: parentId,
      label: requiredString(value.label, "menu label"),
      href: requiredString(value.href, "menu href"),
      enabled: booleanValue(value.enabled, true) ? 1 : 0,
      sort_order: index,
      children_json: "[]",
      updated_at: now,
      created_at: now,
      updated_by: actor,
      revision: 0
    };
    const children = Array.isArray(value.children) ? flattenMenuItems(value.children, actor, id) : [];
    return [row, ...children];
  });
}

async function readMenu(env: Env) {
  const rows = await getRows<MenuItemRow>(
    env,
    `SELECT ${MENU_ITEM_ROW_COLUMNS.join(", ")} FROM menu_items ORDER BY sort_order ASC`
  );
  return createPublicMetadata({
    ...emptyMetadataRows(),
    menu: rows
  }).menu;
}

async function handleMenu(request: Request, env: Env, segments: string[], actor: string) {
  if (segments.length !== 1) {
    return null;
  }

  if (request.method === "GET") {
    return json({ items: await readMenu(env) });
  }

  if (request.method !== "PUT") {
    return jsonError("method not allowed", 405);
  }

  const body = await readJsonBody(request);
  const items = Array.isArray(body.items) ? body.items : [];
  const rows = flattenMenuItems(items, actor);
  const db = requireD1Database(env);
  const statements = [db.prepare("DELETE FROM menu_items")];

  rows.forEach((row) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO menu_items (${MENU_ITEM_ADMIN_ROW_COLUMNS.join(", ")}) VALUES (${MENU_ITEM_ADMIN_ROW_COLUMNS.map(() => "?").join(", ")})`
        )
        .bind(...MENU_ITEM_ADMIN_ROW_COLUMNS.map((column) => row[column]))
    );
  });
  await db.batch(statements);
  return json({ items: await readMenu(env) });
}

function emptyMetadataRows(): PublicMetadataRows {
  return {
    siteSettings: null,
    homepageSettings: null,
    displaySettings: null,
    menu: [],
    media: [],
    carouselSlides: [],
    externalServices: [],
    events: []
  };
}

type EntityName = "carousel" | "external-services" | "events";

const entityConfig = {
  carousel: {
    table: "carousel_slides",
    columns: CAROUSEL_SLIDE_ROW_COLUMNS,
    adminColumns: CAROUSEL_SLIDE_ADMIN_ROW_COLUMNS
  },
  "external-services": {
    table: "external_services",
    columns: EXTERNAL_SERVICE_ROW_COLUMNS,
    adminColumns: EXTERNAL_SERVICE_ADMIN_ROW_COLUMNS
  },
  events: {
    table: "events",
    columns: EVENT_ROW_COLUMNS,
    adminColumns: EVENT_ADMIN_ROW_COLUMNS
  }
} as const;

function createEntityRow(entity: EntityName, body: JsonRecord, now: string, actor: string) {
  const id = stringValue(body.id, makeId(entity));

  if (entity === "carousel") {
    return {
      id,
      title: stringValue(body.title),
      subtitle: stringValue(body.subtitle),
      chip: stringValue(body.chip),
      image_url: requiredString(body.imageUrl, "carousel image URL"),
      image_alt: stringValue(body.imageAlt),
      button_label: stringValue(body.buttonLabel),
      href: stringValue(body.href),
      image_fit: normalizeImageFit(body.imageFit),
      focal_point_x: normalizeFocalPoint(body.focalPointX),
      focal_point_y: normalizeFocalPoint(body.focalPointY),
      mobile_image_url: stringValue(body.mobileImageUrl),
      background_color: normalizeBackgroundColor(body.backgroundColor),
      open_in_new_tab: body.openInNewTab === true ? 1 : 0,
      enabled: booleanValue(body.enabled, true) ? 1 : 0,
      sort_order: numberValue(body.order),
      start_at: stringValue(body.startAt),
      end_at: stringValue(body.endAt),
      updated_at: now,
      created_at: now,
      updated_by: actor,
      revision: 0
    } satisfies CarouselSlideRow;
  }

  if (entity === "external-services") {
    return {
      id,
      title: requiredString(body.title, "external service title"),
      description: stringValue(body.description),
      href: stringValue(body.href),
      tone: stringValue(body.tone, "general"),
      icon_key: stringValue(body.iconKey, "link"),
      enabled: booleanValue(body.enabled, true) ? 1 : 0,
      sort_order: numberValue(body.order),
      updated_at: now,
      created_at: now,
      updated_by: actor,
      revision: 0
    } satisfies ExternalServiceRow;
  }

  return {
    id,
    title: requiredString(body.title, "event title"),
    date: requiredString(body.date, "event date"),
    end_date: stringValue(body.endDate),
    audience: stringValue(body.audience),
    status: stringValue(body.status, "draft"),
    location: stringValue(body.location),
    description: stringValue(body.description),
    category: stringValue(body.category),
    visibility: stringValue(body.visibility, "public"),
    media_ids_json: serializeStringArray(body.mediaIds),
    updated_at: now,
    created_at: now,
    updated_by: actor,
    revision: 0
  } satisfies EventRow;
}

function mapEntity(entity: EntityName, row: CarouselSlideRow | ExternalServiceRow | EventRow) {
  const rows = emptyMetadataRows();

  if (entity === "carousel") {
    rows.carouselSlides = [row as CarouselSlideRow];
    return { ...createPublicMetadata(rows).carouselSlides[0], revision: row.revision };
  }

  if (entity === "external-services") {
    rows.externalServices = [row as ExternalServiceRow];
    return { ...createPublicMetadata(rows).externalServices[0], revision: row.revision };
  }

  const event = row as EventRow;
  return {
    id: event.id,
    title: event.title,
    date: event.date,
    ...(event.end_date ? { endDate: event.end_date } : {}),
    audience: event.audience,
    status: event.status,
    ...(event.location ? { location: event.location } : {}),
    ...(event.description ? { description: event.description } : {}),
    ...(event.category ? { category: event.category } : {}),
    visibility: event.visibility,
    mediaIds: parseStringArray(event.media_ids_json),
    updatedAt: event.updated_at,
    revision: event.revision
  };
}

function isAllowedExternalServiceHref(href: string) {
  return /^(https?:\/\/|mailto:|tel:|\/)/i.test(href);
}

function submittedRevision(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const revision = Number(value);

  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("invalid external service revision");
  }

  return revision;
}

function createExternalServiceBatchRow(
  body: JsonRecord,
  existing: ExternalServiceRow | undefined,
  now: string,
  actor: string,
  index: number
) {
  const href = requiredString(body.href, "external service href");

  if (!isAllowedExternalServiceHref(href)) {
    throw new Error("invalid external service href");
  }

  return {
    id: stringValue(body.id) || existing?.id || makeId("external-services"),
    title: requiredString(body.title, "external service title"),
    description: stringValue(body.description, existing?.description || ""),
    href,
    tone: stringValue(body.tone, existing?.tone || "general"),
    icon_key: stringValue(body.iconKey, existing?.icon_key || "link"),
    enabled: booleanValue(body.enabled, existing ? existing.enabled === 1 : true) ? 1 : 0,
    sort_order: index + 1,
    updated_at: now,
    created_at: existing?.created_at || now,
    updated_by: actor,
    revision: existing ? Number(existing.revision ?? 0) + 1 : 0
  } satisfies ExternalServiceRow;
}

async function handleExternalServicesBatch(request: Request, env: Env, actor: string) {
  const body = await readJsonBody(request);

  if (!Array.isArray(body.items)) {
    return jsonError("external services items must be an array", 400, {
      resource: "external-services"
    });
  }

  const currentRows = await getRows<ExternalServiceRow>(
    env,
    `SELECT ${EXTERNAL_SERVICE_ADMIN_ROW_COLUMNS.join(", ")} FROM external_services ORDER BY sort_order ASC`
  );
  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  const submittedIds = new Set<string>();
  const now = new Date().toISOString();
  const rows: ExternalServiceRow[] = [];

  for (const [index, value] of body.items.entries()) {
    if (!isRecord(value)) {
      return jsonError("invalid external service item", 400, {
        resource: "external-services"
      });
    }

    if ("children" in value || "parentId" in value || "parent_id" in value) {
      return jsonError("external services must be a flat list", 400, {
        resource: "external-services"
      });
    }

    const id = stringValue(value.id);

    if (id && submittedIds.has(id)) {
      return jsonError("duplicate external service id", 409, {
        resource: "external-services"
      });
    }

    const existing = id ? currentById.get(id) : undefined;
    const revision = submittedRevision(value.revision);

    if (existing && revision !== undefined && Number(existing.revision ?? 0) !== revision) {
      return jsonError("stale revision", 409, {
        resource: "external-services",
        expectedRevision: revision,
        currentRevision: Number(existing.revision ?? 0)
      });
    }

    const row = createExternalServiceBatchRow(value, existing, now, actor, index);
    submittedIds.add(row.id);
    rows.push(row);
  }

  const db = requireD1Database(env);
  const mutableColumns = EXTERNAL_SERVICE_ADMIN_ROW_COLUMNS.filter(
    (column) => column !== "id" && column !== "created_at" && column !== "revision"
  );
  const statements = rows.map((row) =>
    db
      .prepare(
        `INSERT INTO external_services (${EXTERNAL_SERVICE_ADMIN_ROW_COLUMNS.join(", ")})
         VALUES (${EXTERNAL_SERVICE_ADMIN_ROW_COLUMNS.map(() => "?").join(", ")})
         ON CONFLICT(id) DO UPDATE SET ${mutableColumns
           .map((column) => `${column} = excluded.${column}`)
           .join(", ")}, revision = excluded.revision`
      )
      .bind(...EXTERNAL_SERVICE_ADMIN_ROW_COLUMNS.map((column) => row[column]))
  );

  currentRows
    .filter((row) => !submittedIds.has(row.id))
    .forEach((row) => {
      statements.push(db.prepare("DELETE FROM external_services WHERE id = ?").bind(row.id));
    });

  if (statements.length) {
    await db.batch(statements);
  }

  return json({
    items: rows
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((row) => mapEntity("external-services", row))
  });
}

function createMediaRow(body: JsonRecord, now: string): MediaAssetRow {
  return {
    id: requiredString(body.id, "media id"),
    name: requiredString(body.name, "media name"),
    type: requiredString(body.type, "media type"),
    size: stringValue(body.size),
    owner: stringValue(body.owner),
    drive_url: stringValue(body.driveUrl),
    file_id: stringValue(body.fileId),
    mime_type: stringValue(body.mimeType),
    preview_url: stringValue(body.previewUrl),
    embed_url: stringValue(body.embedUrl),
    thumbnail_url: stringValue(body.thumbnailUrl),
    updated_at: stringValue(body.updatedAt, now)
  };
}

function mapMediaRow(row: MediaAssetRow) {
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

async function handleMedia(request: Request, env: Env, segments: string[]) {
  if (segments.length === 1 && request.method === "POST") {
    const row = createMediaRow(await readJsonBody(request), new Date().toISOString());

    await run(
      env,
      `INSERT INTO media_assets (${MEDIA_ASSET_ROW_COLUMNS.join(", ")})
       VALUES (${MEDIA_ASSET_ROW_COLUMNS.map(() => "?").join(", ")})
       ON CONFLICT(id) DO UPDATE SET ${MEDIA_ASSET_ROW_COLUMNS.filter((column) => column !== "id")
         .map((column) => `${column} = excluded.${column}`)
         .join(", ")}`,
      ...MEDIA_ASSET_ROW_COLUMNS.map((column) => row[column])
    );

    return json({ item: mapMediaRow(row) });
  }

  if (segments.length === 2 && request.method === "DELETE") {
    const id = decodeURIComponent(segments[1] || "");
    const result = await run(env, "DELETE FROM media_assets WHERE id = ?", id);

    if (!result.meta.changes) {
      return jsonError("not found", 404, { resource: "media" });
    }

    return json({ id, deleted: true });
  }

  return null;
}

async function handleEntity(request: Request, env: Env, segments: string[], entity: EntityName, actor: string) {
  const config = entityConfig[entity];

  if (entity === "external-services" && segments.length === 1 && request.method === "PUT") {
    return handleExternalServicesBatch(request, env, actor);
  }

  if (segments.length === 1 && request.method === "POST") {
    const body = await readJsonBody(request);
    const row = createEntityRow(entity, body, new Date().toISOString(), actor);

    if (entity === "carousel" && stringValue(body.id)) {
      const existingRows = await getRows<{ id: string }>(
        env,
        `SELECT id FROM ${config.table} WHERE id = ? LIMIT 1`,
        row.id
      );

      if (existingRows.length) {
        return jsonError("duplicate carousel id", 409, { resource: entity });
      }
    }

    const conflictClause =
      entity === "carousel"
        ? ""
        : ` ON CONFLICT(id) DO UPDATE SET ${config.adminColumns
            .filter((column) => column !== "id" && column !== "created_at" && column !== "revision")
            .map((column) => `${column} = excluded.${column}`)
            .join(", ")}, revision = ${config.table}.revision + 1`;
    await run(
      env,
      `INSERT INTO ${config.table} (${config.adminColumns.join(", ")})
       VALUES (${config.adminColumns.map(() => "?").join(", ")})${conflictClause}`,
      ...config.adminColumns.map((column) => row[column as keyof typeof row])
    );
    return json({ item: mapEntity(entity, row) }, { status: 201 });
  }

  if (segments.length === 2 && request.method === "PATCH") {
    const id = decodeURIComponent(segments[1] || "");
    const currentRows = await getRows<CarouselSlideRow | ExternalServiceRow | EventRow>(
      env,
      `SELECT ${config.adminColumns.join(", ")} FROM ${config.table} WHERE id = ? LIMIT 1`,
      id
    );
    const current = currentRows[0];

    if (!current) {
      return jsonError("not found", 404, { resource: entity });
    }

    const requestedRevision = expectedRevision(request);
    const currentRevision = Number(current.revision ?? 0);

    if (requestedRevision !== undefined && currentRevision !== requestedRevision) {
      return jsonError("stale revision", 409, {
        resource: entity,
        expectedRevision: requestedRevision,
        currentRevision
      });
    }

    const row = createEntityRow(entity, { ...(await readJsonBody(request)), id }, new Date().toISOString(), actor);
    row.created_at = current.created_at || row.created_at;
    row.revision = currentRevision + 1;
    const mutableColumns = config.adminColumns.filter(
      (column) => column !== "id" && column !== "created_at" && column !== "revision"
    );
    const result = await run(
      env,
      `UPDATE ${config.table}
       SET ${mutableColumns.map((column) => `${column} = ?`).join(", ")}, revision = revision + 1
       WHERE id = ?${requestedRevision === undefined ? "" : " AND revision = ?"}`,
      ...mutableColumns.map((column) => row[column as keyof typeof row]),
      id,
      ...(requestedRevision === undefined ? [] : [requestedRevision])
    );

    if (!result.meta.changes) {
      return jsonError("stale revision", 409, { resource: entity });
    }

    return json({ item: mapEntity(entity, row) });
  }

  if (segments.length === 2 && request.method === "DELETE") {
    const id = decodeURIComponent(segments[1] || "");
    const result = await run(env, `DELETE FROM ${config.table} WHERE id = ?`, id);

    if (!result.meta.changes) {
      return jsonError("not found", 404, { resource: entity });
    }

    return json({ id, deleted: true });
  }

  return null;
}

export async function handleAdminStructuredParity(
  request: Request,
  env: Env,
  segments: string[],
  identity: AdminIdentity
) {
  if (segments[0] === "settings") {
    return handleSettings(request, env, segments, identity.actor);
  }

  if (segments[0] === "menu") {
    return handleMenu(request, env, segments, identity.actor);
  }

  if (segments[0] === "media") {
    return handleMedia(request, env, segments);
  }

  if (segments[0] === "carousel" || segments[0] === "external-services" || segments[0] === "events") {
    return handleEntity(request, env, segments, segments[0], identity.actor);
  }

  return null;
}

export async function readAdminStructuredSnapshot(env: Env) {
  const [site, homepage, display, menu, media, carouselSlides, externalServices, events] = await Promise.all([
    getRows<SiteSettingsRow>(
      env,
      `SELECT ${SITE_SETTINGS_ROW_COLUMNS.join(", ")} FROM site_settings ORDER BY updated_at DESC LIMIT 1`
    ),
    getRows<HomepageSettingsRow>(
      env,
      `SELECT ${HOMEPAGE_SETTINGS_ROW_COLUMNS.join(", ")} FROM homepage_settings ORDER BY updated_at DESC LIMIT 1`
    ),
    getRows<DisplaySettingsRow>(
      env,
      `SELECT ${DISPLAY_SETTINGS_ROW_COLUMNS.join(", ")} FROM display_settings ORDER BY updated_at DESC LIMIT 1`
    ),
    getRows<MenuItemRow>(env, `SELECT ${MENU_ITEM_ROW_COLUMNS.join(", ")} FROM menu_items ORDER BY sort_order ASC`),
    getRows<MediaAssetRow>(
      env,
      `SELECT ${MEDIA_ASSET_ROW_COLUMNS.join(", ")} FROM media_assets ORDER BY updated_at DESC`
    ),
    getRows<CarouselSlideRow>(
      env,
      `SELECT ${CAROUSEL_SLIDE_ROW_COLUMNS.join(", ")} FROM carousel_slides ORDER BY sort_order ASC`
    ),
    getRows<ExternalServiceRow>(
      env,
      `SELECT ${EXTERNAL_SERVICE_ADMIN_ROW_COLUMNS.join(", ")} FROM external_services ORDER BY sort_order ASC`
    ),
    getRows<EventRow>(env, `SELECT ${EVENT_ROW_COLUMNS.join(", ")} FROM events ORDER BY date DESC, updated_at DESC`)
  ]);
  const metadata = createPublicMetadata({
    siteSettings: site[0] ?? null,
    homepageSettings: homepage[0] ?? null,
    displaySettings: display[0] ?? null,
    menu,
    media,
    carouselSlides,
    externalServices,
    events: []
  });

  return {
    siteSettings: metadata.siteSettings,
    homepageSettings: metadata.homepageSettings,
    displaySettings: metadata.displaySettings,
    menu: metadata.menu,
    media: metadata.media,
    carouselSlides: metadata.carouselSlides,
    externalServices: externalServices.map((row) => mapEntity("external-services", row)),
    events: events.map((row) => mapEntity("events", row))
  };
}
