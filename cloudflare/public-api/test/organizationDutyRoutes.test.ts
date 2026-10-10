// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminIdentity } from "../src/auth/adminAccess";
import {
  createAuditedOrganizationAssignment,
  createAuditedOrganizationPosition,
  getAdminOrganizationAssignmentById,
  getAdminOrganizationPositionById,
  updateAuditedOrganizationAssignment,
  updateAuditedOrganizationPosition
} from "../src/db/organizationDutyRepository";
import type { OrganizationAssignmentRow, OrganizationPositionRow } from "../src/db/organizationSchema";
import type { Env } from "../src/env";
import { handleAdminOrganizationDutyWrite } from "../src/routes/adminOrganizationDutyWrite";

vi.mock("../src/db/organizationDutyRepository", () => ({
  createAuditedOrganizationAssignment: vi.fn(),
  createAuditedOrganizationPosition: vi.fn(),
  getAdminOrganizationAssignmentById: vi.fn(),
  getAdminOrganizationPositionById: vi.fn(),
  updateAuditedOrganizationAssignment: vi.fn(),
  updateAuditedOrganizationPosition: vi.fn()
}));

const env = {} as Env;
const identity = { actor: "editor@example.invalid" } as AdminIdentity;
const position: OrganizationPositionRow = {
  id: "position-1",
  unit_content_id: "division-1",
  title: "Director",
  group_label: "",
  group_sort_order: 0,
  sort_order: 0,
  display_style: "default",
  occupant_limit: 2,
  revision: 3,
  created_at: "2026-10-10T00:00:00.000Z",
  updated_at: "2026-10-10T00:00:00.000Z"
};
const assignment: OrganizationAssignmentRow = {
  id: "assignment-1",
  personnel_id: "person-1",
  position_id: "position-1",
  duty_detail: "Lead",
  sort_order: 0,
  enabled: 1,
  revision: 4,
  created_at: "2026-10-10T00:00:00.000Z",
  updated_at: "2026-10-10T00:00:00.000Z"
};

function request(method: string, path: string, body: unknown, revision?: string) {
  return new Request(`https://example.invalid/api/admin/organization/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(revision === undefined ? {} : { "X-RCAT-Expected-Revision": revision })
    },
    body: JSON.stringify(body)
  });
}

async function dispatch(method: string, path: string, body: unknown, revision?: string) {
  return handleAdminOrganizationDutyWrite(
    request(method, path, body, revision),
    env,
    ["organization", ...path.split("/")],
    identity
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminOrganizationPositionById).mockResolvedValue(position);
  vi.mocked(getAdminOrganizationAssignmentById).mockResolvedValue(assignment);
  vi.mocked(updateAuditedOrganizationPosition).mockResolvedValue(true);
  vi.mocked(updateAuditedOrganizationAssignment).mockResolvedValue(true);
});

describe("Organization Chart protected position and assignment writes", () => {
  it("creates server-owned position and assignment identities with audit actor", async () => {
    const positionResponse = await dispatch("POST", "positions", {
      unitContentId: "division-1",
      title: "Director",
      occupantLimit: 2
    });
    expect(positionResponse?.status).toBe(201);
    expect(positionResponse?.headers.get("Cache-Control")).toBe("no-store");
    const positionInput = vi.mocked(createAuditedOrganizationPosition).mock.calls[0]?.[1];
    expect(positionInput).toMatchObject({ unit_content_id: "division-1", revision: 0 });
    expect(positionInput?.id).toMatch(/^org-/);
    expect(vi.mocked(createAuditedOrganizationPosition).mock.calls[0]?.[2]).toBe(identity.actor);

    const assignmentResponse = await dispatch("POST", "assignments", {
      personnelId: "person-1",
      positionId: "position-1",
      dutyDetail: "Lead"
    });
    expect(assignmentResponse?.status).toBe(201);
    const input = vi.mocked(createAuditedOrganizationAssignment).mock.calls[0]?.[1];
    expect(input).toMatchObject({ personnel_id: "person-1", position_id: "position-1", revision: 0 });
    expect(input?.id).toMatch(/^org-/);
  });

  it("rejects protected fields, scheduling, and occupant limits without writing", async () => {
    const probes: Array<[string, unknown]> = [
      ["positions", { unitContentId: "division-1", title: "Director", revision: 9 }],
      ["positions", { unitContentId: "division-1", title: "Director", occupantLimit: 0 }],
      ["assignments", { personnelId: "person-1", positionId: "position-1", startsAt: "yesterday" }],
      ["assignments", { personnelId: "person-1", positionId: "position-1", id: "forged" }]
    ];
    for (const [collection, body] of probes) {
      expect((await dispatch("POST", collection, body))?.status).toBe(400);
    }
    expect(createAuditedOrganizationPosition).not.toHaveBeenCalled();
    expect(createAuditedOrganizationAssignment).not.toHaveBeenCalled();
  });

  it("enforces compare-and-swap revisions on both update routes", async () => {
    expect((await dispatch("PATCH", "positions/position-1", { title: "New" }))?.status).toBe(428);
    expect((await dispatch("PATCH", "assignments/assignment-1", { dutyDetail: "New" }, "3"))?.status).toBe(409);

    const updatedPosition = await dispatch("PATCH", "positions/position-1", { title: "New" }, "3");
    expect(updatedPosition?.status).toBe(200);
    expect(vi.mocked(updateAuditedOrganizationPosition).mock.calls[0]?.[1]).toMatchObject({
      id: "position-1",
      title: "New",
      unit_content_id: "division-1"
    });
    expect(vi.mocked(updateAuditedOrganizationPosition).mock.calls[0]?.[2]).toBe(3);

    vi.mocked(updateAuditedOrganizationAssignment).mockResolvedValue(false);
    expect((await dispatch("PATCH", "assignments/assignment-1", { dutyDetail: "New" }, "4"))?.status).toBe(409);
  });

  it("maps D1 foreign key and occupant capacity errors to safe conflicts", async () => {
    vi.mocked(createAuditedOrganizationAssignment).mockRejectedValueOnce(new Error("FOREIGN KEY constraint failed"));
    expect((await dispatch("POST", "assignments", { personnelId: "p1", positionId: "pos1" }))?.status).toBe(409);
    vi.mocked(createAuditedOrganizationAssignment).mockRejectedValueOnce(
      new Error("organization position at occupant limit")
    );
    expect((await dispatch("POST", "assignments", { personnelId: "p1", positionId: "pos1" }))?.status).toBe(409);
  });
});
