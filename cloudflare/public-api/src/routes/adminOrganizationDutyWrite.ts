import type { AdminIdentity } from "../auth/adminAccess";
import {
  createAuditedOrganizationAssignment,
  createAuditedOrganizationPosition,
  getAdminOrganizationAssignmentById,
  getAdminOrganizationPositionById,
  updateAuditedOrganizationAssignment,
  updateAuditedOrganizationPosition
} from "../db/organizationDutyRepository";
import type { OrganizationAssignmentRow, OrganizationPositionRow } from "../db/organizationSchema";
import type { Env } from "../env";
import { json, jsonError } from "../responses";
import {
  OrganizationInputError,
  parseOrganizationAssignmentWrite,
  parseOrganizationPositionWrite
} from "./organizationWriteValidation";

type DutyCollection = "positions" | "assignments";

function errorResponse(message: string, status: number) {
  const response = jsonError(message, status, { resource: "organization-duties" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function ok(item: unknown, status = 200) {
  return json({ item }, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const value: unknown = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrganizationInputError("request body must be an object");
  }
  return value as Record<string, unknown>;
}

function revisionFromHeader(request: Request) {
  const raw = request.headers.get("X-RCAT-Expected-Revision");
  if (raw === null) return null;
  if (!/^(0|[1-9]\d*)$/.test(raw)) return Number.NaN;
  const revision = Number(raw);
  return Number.isSafeInteger(revision) ? revision : Number.NaN;
}

function inputFromPosition(row: OrganizationPositionRow) {
  return {
    unitContentId: row.unit_content_id,
    title: row.title,
    groupLabel: row.group_label,
    groupSortOrder: row.group_sort_order,
    sortOrder: row.sort_order,
    displayStyle: row.display_style,
    occupantLimit: row.occupant_limit
  };
}

function inputFromAssignment(row: OrganizationAssignmentRow) {
  return {
    personnelId: row.personnel_id,
    positionId: row.position_id,
    dutyDetail: row.duty_detail,
    sortOrder: row.sort_order,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    enabled: row.enabled === 1
  };
}

function toPositionRow(
  input: ReturnType<typeof parseOrganizationPositionWrite>,
  id: string,
  now: string,
  createdAt = now
): OrganizationPositionRow {
  return {
    id,
    unit_content_id: input.unitContentId,
    title: input.title,
    group_label: input.groupLabel,
    group_sort_order: input.groupSortOrder,
    sort_order: input.sortOrder,
    display_style: input.displayStyle,
    occupant_limit: input.occupantLimit,
    revision: 0,
    created_at: createdAt,
    updated_at: now
  };
}

function toAssignmentRow(
  input: ReturnType<typeof parseOrganizationAssignmentWrite>,
  id: string,
  now: string,
  createdAt = now
): OrganizationAssignmentRow {
  return {
    id,
    personnel_id: input.personnelId,
    position_id: input.positionId,
    duty_detail: input.dutyDetail,
    sort_order: input.sortOrder,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    enabled: input.enabled ? 1 : 0,
    revision: 0,
    created_at: createdAt,
    updated_at: now
  };
}

function mapIntegrityError(error: unknown): Response | null {
  if (!(error instanceof Error)) return null;
  if (/FOREIGN KEY constraint failed|constraint failed: FOREIGN KEY/i.test(error.message)) {
    return errorResponse("referenced organization record does not exist", 409);
  }
  if (/organization position at occupant limit/i.test(error.message)) {
    return errorResponse("organization position has reached its occupant limit", 409);
  }
  if (/CHECK constraint failed/i.test(error.message)) {
    return errorResponse("organization data violates a database constraint", 409);
  }
  return null;
}

/** Only dispatch after the central CMS session, RBAC, CSRF, rate-limit and password step-up checks. */
export async function handleAdminOrganizationDutyWrite(
  request: Request,
  env: Env,
  segments: readonly string[],
  identity: AdminIdentity
): Promise<Response | null> {
  if (segments[0] !== "organization" || !["positions", "assignments"].includes(segments[1])) return null;
  const collection = segments[1] as DutyCollection;
  const isCreate = segments.length === 2 && request.method === "POST";
  const isUpdate = segments.length === 3 && request.method === "PATCH";
  if (!isCreate && !isUpdate) return null;

  try {
    const id = isCreate ? `org-${crypto.randomUUID()}` : segments[2];
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) return errorResponse("invalid ID", 400);
    const revision = isUpdate ? revisionFromHeader(request) : null;
    if (isUpdate && revision === null) return errorResponse("expected revision required", 428);
    if (isUpdate && Number.isNaN(revision)) return errorResponse("invalid expected revision", 400);

    const previous = isUpdate
      ? collection === "positions"
        ? await getAdminOrganizationPositionById(env, id)
        : await getAdminOrganizationAssignmentById(env, id)
      : null;
    if (isUpdate && !previous) return errorResponse("not found", 404);
    if (isUpdate && previous && previous.revision !== revision) return errorResponse("stale revision", 409);

    const changes = await readJson(request);
    const now = new Date().toISOString();
    if (collection === "positions") {
      const old = previous as OrganizationPositionRow | null;
      const input = parseOrganizationPositionWrite({ ...(old ? inputFromPosition(old) : {}), ...changes });
      const row = toPositionRow(input, id, now, old?.created_at);
      if (isCreate) await createAuditedOrganizationPosition(env, row, identity.actor);
      else {
        const updated = await updateAuditedOrganizationPosition(env, row, revision as number, identity.actor, Object.keys(changes).sort());
        if (!updated) return errorResponse("stale revision", 409);
      }
      return ok({ ...row, revision: isCreate ? 0 : (revision as number) + 1 }, isCreate ? 201 : 200);
    }

    const old = previous as OrganizationAssignmentRow | null;
    const input = parseOrganizationAssignmentWrite({ ...(old ? inputFromAssignment(old) : {}), ...changes });
    const row = toAssignmentRow(input, id, now, old?.created_at);
    if (isCreate) await createAuditedOrganizationAssignment(env, row, identity.actor);
    else {
      const updated = await updateAuditedOrganizationAssignment(env, row, revision as number, identity.actor, Object.keys(changes).sort());
      if (!updated) return errorResponse("stale revision", 409);
    }
    return ok({ ...row, revision: isCreate ? 0 : (revision as number) + 1 }, isCreate ? 201 : 200);
  } catch (error) {
    if (error instanceof OrganizationInputError) return errorResponse(error.message, 400);
    const integrity = mapIntegrityError(error);
    if (integrity) return integrity;
    throw error;
  }
}
