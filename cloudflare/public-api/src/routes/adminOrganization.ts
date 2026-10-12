import {
  listAdminOrganizationAssignments,
  listAdminOrganizationPositions,
  listAdminOrganizationContentUnits,
  listAdminPersonnel,
  getAdminPersonnelById
} from "../db/organizationAdminRepository";
import { getAdminOrganizationPositionById, getAdminOrganizationAssignmentById } from "../db/organizationDutyRepository";
import type { Env } from "../env";
import { searchAdminOrganizationPage } from "../db/organizationSearchRepository";
import { json, jsonError } from "../responses";

const COLLECTIONS = ["units", "personnel", "positions", "assignments"] as const;
type Collection = (typeof COLLECTIONS)[number];

function isCollection(value: string | undefined): value is Collection {
  return COLLECTIONS.some((collection) => collection === value);
}

function readPageParams(request: Request): {
  limit: number;
  offset: number;
  search: string;
  includeTotal: boolean;
  unitContentId?: string;
  positionId?: string;
} | null {
  const params = new URL(request.url).searchParams;
  const allowed = new Set(["limit", "offset", "search", "includeTotal", "unitContentId", "positionId"]);
  if ([...params.keys()].some((key) => !allowed.has(key))) return null;
  if (["search", "includeTotal", "unitContentId", "positionId"].some((key) => params.getAll(key).length > 1))
    return null;
  const search = params.get("search") ?? "";
  if (search.length > 160 || /[\x00-\x1f]/.test(search)) return null;
  const includeTotal = params.get("includeTotal") === "1";
  if (params.has("includeTotal") && !["0", "1"].includes(params.get("includeTotal") ?? "")) return null;
  const unitContentId = params.get("unitContentId") || undefined;
  const positionId = params.get("positionId") || undefined;
  const validId = (id: string) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);
  if ((unitContentId && !validId(unitContentId)) || (positionId && !validId(positionId))) return null;
  if (params.getAll("limit").length > 1 || params.getAll("offset").length > 1) return null;
  const raw = params.get("limit");
  const rawOffset = params.get("offset");
  if (raw !== null && !/^[1-9]\d{0,2}$/.test(raw)) return null;
  if (rawOffset !== null && !/^(0|[1-9]\d{0,5})$/.test(rawOffset)) return null;
  const limit = raw === null ? 100 : Number(raw);
  const offset = rawOffset === null ? 0 : Number(rawOffset);
  return limit <= 100 && offset <= 999999 ? { limit, offset, search, includeTotal, unitContentId, positionId } : null;
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

  const page = readPageParams(request);
  if (page === null) return jsonError("invalid organization page parameters", 400, { resource: "organization" });
  const { limit, offset, search, includeTotal, unitContentId, positionId } = page;
  if (
    (unitContentId && !["positions", "assignments"].includes(collection)) ||
    (positionId && collection !== "assignments")
  ) {
    return jsonError("invalid organization filter", 400, { resource: "organization" });
  }
  if (includeTotal || search || unitContentId || positionId) {
    const result = await searchAdminOrganizationPage(env, collection, {
      limit,
      offset,
      search,
      unitContentId,
      positionId
    });
    return json(
      {
        ...result,
        maximumItems: limit,
        nextOffset: offset + result.items.length < result.total ? offset + result.items.length : null,
        generatedAt: new Date().toISOString()
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const items =
    collection === "units"
      ? await listAdminOrganizationContentUnits(env, limit, offset)
      : collection === "personnel"
        ? await listAdminPersonnel(env, limit, offset)
        : collection === "positions"
          ? await listAdminOrganizationPositions(env, limit, offset)
          : await listAdminOrganizationAssignments(env, limit, offset);

  return json(
    {
      items,
      maximumItems: limit,
      nextOffset: items.length === limit ? offset + limit : null,
      generatedAt: new Date().toISOString()
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
