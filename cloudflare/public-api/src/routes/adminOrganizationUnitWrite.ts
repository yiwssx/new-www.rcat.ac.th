import type { AdminIdentity } from "../auth/adminAccess";
import {
  createAuditedOrganizationUnit,
  deleteAuditedOrganizationUnit,
  getOrganizationUnitEditor,
  updateAuditedOrganizationUnit
} from "../db/organizationUnitLifecycle";
import type { Env } from "../env";
import { json, jsonError } from "../responses";
import { OrganizationInputError } from "./organizationWriteValidation";
import { parseOrganizationContentUnitWrite } from "./organizationUnitValidation";

function fail(message: string, status: number) {
  const response = jsonError(message, status, { resource: "organization-unit" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function ok(item: unknown, status = 200) {
  return json({ item }, { status, headers: { "Cache-Control": "no-store" } });
}

async function bodyRecord(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new OrganizationInputError("request body must be an object");
  }
  return body as Record<string, unknown>;
}

function revisionFromHeader(request: Request) {
  const raw = request.headers.get("X-RCAT-Expected-Revision");
  if (raw === null) return null;
  if (!/^(0|[1-9]\d*)$/.test(raw)) return Number.NaN;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) ? revision : Number.NaN;
}

function inputFromEditor(row: NonNullable<Awaited<ReturnType<typeof getOrganizationUnitEditor>>>) {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    publishAt: row.publish_at,
    unpublishAt: row.unpublish_at,
    parentContentId: row.parent_content_id,
    unitKind: row.unit_kind,
    sortOrder: row.sort_order
  };
}

function mapDatabaseError(error: unknown): Response | null {
  if (!(error instanceof Error)) return null;
  if (/UNIQUE constraint failed.*contents\.slug/i.test(error.message)) {
    return fail("organization slug already exists", 409);
  }
  if (/FOREIGN KEY constraint failed|constraint failed: FOREIGN KEY/i.test(error.message)) {
    return fail("resolve linked units, positions or assignments first", 409);
  }
  if (/organization hierarchy cycle|organization unit requires active organization content/i.test(error.message)) {
    return fail("invalid organization parent or cyclic hierarchy", 409);
  }
  if (/CHECK constraint failed/i.test(error.message)) return fail("invalid organization data", 409);
  return null;
}

/** Admin dispatch happens after session + role + CSRF + password step-up. */
export async function handleAdminOrganizationUnitWrite(
  request: Request,
  env: Env,
  segments: readonly string[],
  identity: AdminIdentity
): Promise<Response | null> {
  if (segments[0] !== "organization" || segments[1] !== "units") return null;
  const create = segments.length === 2 && request.method === "POST";
  const detail = segments.length === 3 && ["GET", "PATCH", "DELETE"].includes(request.method);
  if (!create && !detail) return null;

  try {
    if (create) {
      const now = new Date().toISOString();
      const input = parseOrganizationContentUnitWrite(await bodyRecord(request), now);
      const id = `organization-${crypto.randomUUID()}`;
      await createAuditedOrganizationUnit(env, id, input, identity.actor, now);
      return ok({ id, ...input, revision: 0 }, 201);
    }

    const id = segments[2];
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) return fail("invalid organization ID", 400);
    const existing = await getOrganizationUnitEditor(env, id);
    if (!existing) return fail("organization unit not found", 404);
    if (request.method === "GET") return ok(existing);

    const revision = revisionFromHeader(request);
    if (revision === null) return fail("expected revision required", 428);
    if (Number.isNaN(revision)) return fail("invalid expected revision", 400);
    if (existing.unit_revision !== revision || existing.content_revision !== revision) {
      return fail("stale organization revision", 409);
    }
    const now = new Date().toISOString();
    if (request.method === "DELETE") {
      const deleted = await deleteAuditedOrganizationUnit(env, id, revision, identity.actor, now);
      return deleted ? ok({ id, deleted: true }) : fail("stale organization revision", 409);
    }

    const changes = await bodyRecord(request);
    const input = parseOrganizationContentUnitWrite({ ...inputFromEditor(existing), ...changes }, now);
    const updated = await updateAuditedOrganizationUnit(env, id, input, revision, identity.actor, now);
    return updated ? ok({ id, ...input, revision: revision + 1 }) : fail("stale organization revision", 409);
  } catch (error) {
    if (error instanceof OrganizationInputError) return fail(error.message, 400);
    const dbError = mapDatabaseError(error);
    if (dbError) return dbError;
    throw error;
  }
}
