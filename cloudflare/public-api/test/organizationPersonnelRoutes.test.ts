// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminIdentity } from "../src/auth/adminAccess";
import { requireAdminStepUp } from "../src/auth/adminStepUp";
import {
  createAuditedPersonnelRow,
  getAdminPersonnelById,
  updateAuditedPersonnelRow
} from "../src/db/organizationAdminRepository";
import type { PersonnelRow } from "../src/db/organizationSchema";
import type { Env } from "../src/env";
import { handleAdminOrganizationWrite } from "../src/routes/adminOrganizationWrite";

vi.mock("../src/db/organizationAdminRepository", () => ({
  createAuditedPersonnelRow: vi.fn(),
  getAdminPersonnelById: vi.fn(),
  updateAuditedPersonnelRow: vi.fn()
}));

const env = {} as Env;
const identity: AdminIdentity = {
  actor: "editor@example.invalid",
  email: "editor@example.invalid",
  mode: "cms-session",
  role: "editor",
  userId: "editor-1",
  sessionId: "session-1",
  isRoot: false,
  reauthenticatedAt: "",
  mfaVerifiedAt: ""
};

const existing: PersonnelRow = {
  id: "person-1",
  display_name: "Staff",
  personnel_type: "teacher",
  employment_position: "Instructor",
  photo_media_id: null,
  public_email: "private@example.invalid",
  public_phone: "000",
  show_public_email: 0,
  show_public_phone: 0,
  active: 1,
  revision: 2,
  created_at: "2026-10-09T00:00:00.000Z",
  updated_at: "2026-10-09T00:00:00.000Z"
};

function req(method: string, path: string, body?: unknown, revision?: string) {
  return new Request(`https://example.invalid/api/admin/organization/${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(revision === undefined ? {} : { "X-RCAT-Expected-Revision": revision })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminPersonnelById).mockResolvedValue(existing);
  vi.mocked(updateAuditedPersonnelRow).mockResolvedValue(true);
});

describe("Organization Chart protected personnel mutations", () => {
  it("creates a server-owned ID and keeps the private-contact default", async () => {
    const response = await handleAdminOrganizationWrite(
      req("POST", "personnel", { displayName: "Staff" }),
      env,
      ["organization", "personnel"],
      identity
    );
    expect(response?.status).toBe(201);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    expect(createAuditedPersonnelRow).toHaveBeenCalledOnce();
    const row = vi.mocked(createAuditedPersonnelRow).mock.calls[0]?.[1];
    expect(row).toMatchObject({
      display_name: "Staff",
      show_public_email: 0,
      show_public_phone: 0,
      revision: 0
    });
    expect(row?.id).toMatch(/^person-/);
    expect(vi.mocked(createAuditedPersonnelRow).mock.calls[0]?.[2]).toBe(identity.actor);
  });

  it("accepts only existing Media Library images as personnel photos", async () => {
    const mediaEnv = {
      DB: {
        prepare: (query: string) => {
          expect(query).toContain("type = 'image'");
          return {
            bind: (id: string) => ({
              first: async () => id === "image-1" ? { id } : null
            })
          };
        }
      }
    } as unknown as Env;

    const rejected = await handleAdminOrganizationWrite(
      req("POST", "personnel", { displayName: "Staff", photoMediaId: "document-1" }),
      mediaEnv,
      ["organization", "personnel"],
      identity
    );
    expect(rejected?.status).toBe(400);
    expect(createAuditedPersonnelRow).not.toHaveBeenCalled();

    const accepted = await handleAdminOrganizationWrite(
      req("POST", "personnel", { displayName: "Staff", photoMediaId: "image-1" }),
      mediaEnv,
      ["organization", "personnel"],
      identity
    );
    expect(accepted?.status).toBe(201);
    expect(vi.mocked(createAuditedPersonnelRow).mock.calls[0]?.[1]?.photo_media_id).toBe("image-1");
  });

  it("rejects protected write fields and malformed payloads before D1", async () => {
    for (const body of [{ displayName: "A", role: "admin" }, { displayName: "A", revision: 42 }, []]) {
      const response = await handleAdminOrganizationWrite(
        req("POST", "personnel", body),
        env,
        ["organization", "personnel"],
        identity
      );
      expect(response?.status).toBe(400);
    }
    expect(createAuditedPersonnelRow).not.toHaveBeenCalled();
  });

  it("requires an exact numeric optimistic-lock revision", async () => {
    for (const [revision, status] of [
      [undefined, 428],
      ["no", 400],
      ["1", 409]
    ] as const) {
      const response = await handleAdminOrganizationWrite(
        req("PATCH", "personnel/person-1", { displayName: "New" }, revision),
        env,
        ["organization", "personnel", "person-1"],
        identity
      );
      expect(response?.status).toBe(status);
    }
    expect(updateAuditedPersonnelRow).not.toHaveBeenCalled();
  });

  it("merges a partial update, validates protected fields and propagates CAS conflict", async () => {
    const response = await handleAdminOrganizationWrite(
      req("PATCH", "personnel/person-1", { displayName: "Updated" }, "2"),
      env,
      ["organization", "personnel", "person-1"],
      identity
    );
    expect(response?.status).toBe(200);
    const args = vi.mocked(updateAuditedPersonnelRow).mock.calls[0];
    expect(args?.[1]).toMatchObject({
      id: "person-1",
      display_name: "Updated",
      public_email: "private@example.invalid",
      show_public_email: 0
    });
    expect(args?.[2]).toBe(2);
    expect(args?.[3]).toBe(identity.actor);
    expect(args?.[4]).toEqual(["displayName"]);

    vi.mocked(updateAuditedPersonnelRow).mockResolvedValue(false);
    const conflict = await handleAdminOrganizationWrite(
      req("PATCH", "personnel/person-1", { displayName: "Another" }, "2"),
      env,
      ["organization", "personnel", "person-1"],
      identity
    );
    expect(conflict?.status).toBe(409);
  });

  it("requires fresh password assurance for organization mutations, not list reads", async () => {
    const now = new Date("2026-10-10T03:00:00.000Z");
    const expired = await requireAdminStepUp({
      env,
      identity,
      method: "POST",
      segments: ["organization", "personnel"],
      now
    });
    expect(expired?.status).toBe(428);

    const allowed = await requireAdminStepUp({
      env,
      identity: { ...identity, reauthenticatedAt: now.toISOString() },
      method: "PATCH",
      segments: ["organization", "personnel", "person-1"],
      now
    });
    expect(allowed).toBeNull();

    const read = await requireAdminStepUp({
      env,
      identity,
      method: "GET",
      segments: ["organization", "personnel"],
      now
    });
    expect(read).toBeNull();
  });
});
