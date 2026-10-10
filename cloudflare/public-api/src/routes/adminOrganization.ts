import {
  listAdminOrganizationAssignments,
  listAdminOrganizationPositions,
  listAdminOrganizationUnits,
  listAdminPersonnel,
  getAdminPersonnelById
} from "../db/organizationAdminRepository";
import { getAdminOrganizationPositionById, getAdminOrganizationAssignmentById } from "../db/organizationDutyRepository";
import type { Env } from "../env";
import { json, jsonError } from "../responses";

const COLLECTIONS = ["units", "personnel", "positions", "assignments"] as const;
type Collection = (typeof COLLECTIONS)[number];

function isCollection(value: string | undefined): value is Collection {
  return COLLECTIONS.some((collection) => collection === value);
}

function readPageLimit(request: Request): number | null {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => key !== "limit")) return null;
  if (params.getAll("limit").length > 1) return null;
  const raw = params.get("limit");
  if (raw === null) return 100;
  if (!/^[1-9]\d{0,2}$/.test(raw)) return null;
  const limit = Number(raw);
  return limit <= 100 ? limit : null;
}

/**
 * Called only after adminWrite has verified the CMS session, CSRF for
 * mutations, admin rate limit, and the organization.read route capability.
 * No generic-content or public endpoint has access to this private DTO.
 */
export async function handleAdminOrganizationRead(request: Request, env: Env, segments: readonly string[]) {
  if (segments[0] !== "organization") return null;
  const collection = segments[1];
  if (!isCollection(collection) || request.method !== "GET") {
    return jsonError("not found", 404, { resource: "organization" });
  }
  if (segments.length === 3 && collection !== "units") {
    const id = segments[2];
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id)) {
      return jsonError("invalid organization record ID", 400, { resource: "organization" });
    }
    const item =
      collection === "personnel"
        ? await getAdminPersonnelById(env, id)
        : collection === "positions"
          ? await getAdminOrganizationPositionById(env, id)
          : await getAdminOrganizationAssignmentById(env, id);
    return item
      ? json({ item }, { headers: { "Cache-Control": "no-store" } })
      : jsonError("organization record not found", 404, { resource: "organization" });
  }
  if (segments.length !== 2) {
    return jsonError("not found", 404, { resource: "organization" });
  }

  const limit = readPageLimit(request);
  if (limit === null) return jsonError("invalid organization page limit", 400, { resource: "organization" });

  const items =
    collection === "units"
      ? await listAdminOrganizationUnits(env, limit)
      : collection === "personnel"
        ? await listAdminPersonnel(env, limit)
        : collection === "positions"
          ? await listAdminOrganizationPositions(env, limit)
          : await listAdminOrganizationAssignments(env, limit);

  return json(
    { items, maximumItems: limit, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
