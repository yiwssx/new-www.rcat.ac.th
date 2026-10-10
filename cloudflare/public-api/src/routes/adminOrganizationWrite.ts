import type { AdminIdentity } from "../auth/adminAccess";
import {
  createAuditedPersonnelRow,
  getAdminPersonnelById,
  updateAuditedPersonnelRow
} from "../db/organizationAdminRepository";
import type { PersonnelRow } from "../db/organizationSchema";
import { requireD1Database } from "../db/documentsRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";
import { OrganizationInputError, parsePersonnelWrite } from "./organizationWriteValidation";

function noStore(data: unknown, status = 200) {
  return json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function fail(message: string, status: number) {
  const response = jsonError(message, status, { resource: "organization-personnel" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function bodyRecord(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json().catch(() => null);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new OrganizationInputError("request body must be an object");
  }
  return value as Record<string, unknown>;
}

function expectedRevision(request: Request) {
  const raw = request.headers.get("X-RCAT-Expected-Revision");
  if (raw === null) return null;
  if (!/^(0|[1-9]\d*)$/.test(raw)) return Number.NaN;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) ? revision : Number.NaN;
}

async function photoIsValid(env: Env, id: string | null) {
  if (!id) return true;
  const row = await requireD1Database(env)
    .prepare("SELECT id FROM media_assets WHERE id = ? AND type = 'image' LIMIT 1")
    .bind(id)
    .first<{ id: string }>();
  return Boolean(row);
}

function makePersonnelRow(payload: ReturnType<typeof parsePersonnelWrite>, id: string, now: string): PersonnelRow {
  return {
    id,
    display_name: payload.displayName,
    personnel_type: payload.personnelType,
    employment_position: payload.employmentPosition,
    photo_media_id: payload.photoMediaId,
    public_email: payload.publicEmail,
    public_phone: payload.publicPhone,
    show_public_email: payload.showPublicEmail ? 1 : 0,
    show_public_phone: payload.showPublicPhone ? 1 : 0,
    active: payload.active ? 1 : 0,
    revision: 0,
    created_at: now,
    updated_at: now
  };
}

function currentPersonnelInput(row: PersonnelRow) {
  return {
    displayName: row.display_name,
    personnelType: row.personnel_type,
    employmentPosition: row.employment_position,
    photoMediaId: row.photo_media_id,
    publicEmail: row.public_email,
    publicPhone: row.public_phone,
    showPublicEmail: row.show_public_email === 1,
    showPublicPhone: row.show_public_phone === 1,
    active: row.active === 1
  };
}

/**
 * This handler is reachable only after adminWrite's session authentication,
 * origin check, CMS CSRF, admin-api rate limit, organization.manage capability
 * and fresh password reauthentication gate.
 */
export async function handleAdminOrganizationWrite(
  request: Request,
  env: Env,
  segments: readonly string[],
  identity: AdminIdentity
): Promise<Response | null> {
  if (segments[0] !== "organization") return null;
  if (segments[1] !== "personnel") return null;

  if (segments.length === 2 && request.method === "POST") {
    try {
      const payload = parsePersonnelWrite(await bodyRecord(request));
      if (!(await photoIsValid(env, payload.photoMediaId))) return fail("selected personnel photo is not a Media Library image", 400);
      const row = makePersonnelRow(payload, `person-${crypto.randomUUID()}`, new Date().toISOString());
      await createAuditedPersonnelRow(env, row, identity.actor);
      return noStore({ item: row }, 201);
    } catch (error) {
      if (error instanceof OrganizationInputError) return fail(error.message, 400);
      throw error;
    }
  }

  if (segments.length === 3 && request.method === "PATCH") {
    const id = segments[2];
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) return fail("invalid personnel ID", 400);
    const revision = expectedRevision(request);
    if (revision === null) return fail("expected revision required", 428);
    if (Number.isNaN(revision)) return fail("invalid expected revision", 400);

    const current = await getAdminPersonnelById(env, id);
    if (!current) return fail("not found", 404);
    if (current.revision !== revision) return fail("stale revision", 409);

    try {
      const changes = await bodyRecord(request);
      const payload = parsePersonnelWrite({ ...currentPersonnelInput(current), ...changes });
      if (!(await photoIsValid(env, payload.photoMediaId))) return fail("selected personnel photo is not a Media Library image", 400);
      const row = { ...makePersonnelRow(payload, id, new Date().toISOString()), created_at: current.created_at };
      const updated = await updateAuditedPersonnelRow(env, row, revision, identity.actor, Object.keys(changes).sort());
      if (!updated) return fail("stale revision", 409);
      return noStore({ item: { ...row, revision: revision + 1 } });
    } catch (error) {
      if (error instanceof OrganizationInputError) return fail(error.message, 400);
      throw error;
    }
  }

  return null;
}
