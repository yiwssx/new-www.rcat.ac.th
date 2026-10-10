import type { AdminIdentity } from "../auth/adminAccess";
import { getAdminPersonnelById } from "../db/organizationAdminRepository";
import { getAdminOrganizationAssignmentById, getAdminOrganizationPositionById } from "../db/organizationDutyRepository";
import { deleteAuditedOrganizationEntity } from "../db/organizationDeleteRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

function fail(message: string, status: number) {
  const response = jsonError(message, status, { resource: "organization" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * No implicit cascade. To delete a person or position, the caller must
 * individually revoke/reassign each related assignment first. A unit must
 * remove its child units and positions before unit deletion is allowed.
 */
export async function handleAdminOrganizationDelete(
  request: Request,
  env: Env,
  segments: readonly string[],
  identity: AdminIdentity
): Promise<Response | null> {
  if (request.method !== "DELETE" || segments[0] !== "organization" || segments.length !== 3) return null;
  const kind =
    segments[1] === "personnel"
      ? "personnel"
      : segments[1] === "positions"
        ? "position"
        : segments[1] === "assignments"
          ? "assignment"
          : null;
  if (!kind) return null;

  const id = segments[2];
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) return fail("invalid organization record ID", 400);
  const raw = request.headers.get("X-RCAT-Expected-Revision");
  if (raw === null) return fail("expected revision required", 428);
  if (!/^(0|[1-9]\d*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    return fail("invalid expected revision", 400);
  }
  const expectedRevision = Number(raw);
  const current =
    kind === "personnel"
      ? await getAdminPersonnelById(env, id)
      : kind === "position"
        ? await getAdminOrganizationPositionById(env, id)
        : await getAdminOrganizationAssignmentById(env, id);
  if (!current) return fail("organization record not found", 404);
  if (current.revision !== expectedRevision) return fail("stale revision", 409);

  try {
    const changed = await deleteAuditedOrganizationEntity(
      env,
      kind,
      id,
      expectedRevision,
      identity.actor,
      new Date().toISOString()
    );
    return changed
      ? json({ id, deleted: true }, { headers: { "Cache-Control": "no-store" } })
      : fail("stale revision", 409);
  } catch (error) {
    if (error instanceof Error && /FOREIGN KEY constraint failed|constraint failed: FOREIGN KEY/i.test(error.message)) {
      return fail("remove or reassign linked organization assignments before deleting", 409);
    }
    throw error;
  }
}
