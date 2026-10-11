// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminIdentity } from "../src/auth/adminAccess";
import {
  createAuditedOrganizationUnit,
  deleteAuditedOrganizationUnit,
  getOrganizationUnitEditor,
  updateAuditedOrganizationUnit
} from "../src/db/organizationUnitLifecycle";
import type { Env } from "../src/env";
import { handleAdminOrganizationUnitWrite } from "../src/routes/adminOrganizationUnitWrite";

vi.mock("../src/db/organizationUnitLifecycle", () => ({
  createAuditedOrganizationUnit: vi.fn(),
  deleteAuditedOrganizationUnit: vi.fn(),
  getOrganizationUnitEditor: vi.fn(),
  updateAuditedOrganizationUnit: vi.fn()
}));

const env = {} as Env;
const identity = { actor: "editor" } as AdminIdentity;
const current = {
  content_id: "unit-1",
  slug: "division-a",
  title: "Division",
  summary: "",
  owner: "editor",
  status: "draft",
  publish_at: "",
  unpublish_at: "",
  content_revision: 2,
  unit_revision: 2,
  parent_content_id: null,
  unit_kind: "division",
  sort_order: 0,
  deleted_at: "",
  content_created_at: "2026-10-10T00:00:00.000Z",
  unit_created_at: "2026-10-10T00:00:00.000Z"
};

function req(method: string, path: string, body?: unknown, revision?: string) {
  return new Request(`https://example.invalid/api/admin/organization/units${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(revision === undefined ? {} : { "X-RCAT-Expected-Revision": revision })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

function dispatch(method: string, path: string, body?: unknown, revision?: string) {
  return handleAdminOrganizationUnitWrite(
    req(method, path, body, revision),
    env,
    ["organization", "units", ...path.split("/").filter(Boolean)],
    identity
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrganizationUnitEditor).mockResolvedValue(current);
  vi.mocked(updateAuditedOrganizationUnit).mockResolvedValue(true);
  vi.mocked(deleteAuditedOrganizationUnit).mockResolvedValue(true);
});

describe("Organization unit CMS protected route", () => {
  it("creates an organization-only content id with strict server-owned fields", async () => {
    const result = await dispatch("POST", "", { slug: "division-a", title: "Division", unitKind: "division" });
    expect(result?.status).toBe(201);
    const args = vi.mocked(createAuditedOrganizationUnit).mock.calls[0];
    expect(args?.[1]).toMatch(/^organization-/);
    expect(args?.[2]).toMatchObject({ slug: "division-a", status: "draft", parentContentId: null });
    expect(args?.[3]).toBe("editor");
    expect(result?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reads details only in authenticated Admin route context", async () => {
    const result = await dispatch("GET", "/unit-1");
    expect(result?.status).toBe(200);
    expect(await result?.json()).toMatchObject({ item: { slug: "division-a", content_revision: 2 } });
  });

  it("rejects revision omission, stale updates and protected body data", async () => {
    expect((await dispatch("PATCH", "/unit-1", { title: "New" }))?.status).toBe(428);
    expect((await dispatch("PATCH", "/unit-1", { title: "New" }, "1"))?.status).toBe(409);
    expect((await dispatch("PATCH", "/unit-1", { owner: "hacker" }, "2"))?.status).toBe(400);
    expect(updateAuditedOrganizationUnit).not.toHaveBeenCalled();
  });

  it("validates publication transition and protects deletion with optimistic lock", async () => {
    const updated = await dispatch("PATCH", "/unit-1", { status: "published" }, "2");
    expect(updated?.status).toBe(200);
    expect(vi.mocked(updateAuditedOrganizationUnit).mock.calls[0]?.[2]).toMatchObject({
      status: "published",
      slug: "division-a"
    });
    const deleted = await dispatch("DELETE", "/unit-1", undefined, "2");
    expect(deleted?.status).toBe(200);
    expect(deleteAuditedOrganizationUnit).toHaveBeenCalledWith(env, "unit-1", 2, "editor", expect.any(String));
    vi.mocked(deleteAuditedOrganizationUnit).mockRejectedValueOnce(new Error("FOREIGN KEY constraint failed"));
    const blocked = await dispatch("DELETE", "/unit-1", undefined, "2");
    expect(blocked?.status).toBe(409);
  });
});
