// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_DATABASE_NAME,
  assertProductionDatabaseIdentity,
  buildProductionMigrationListArgs,
} from "./worker-production-preflight.mjs";

const productionDatabaseId = "123e4567-e89b-42d3-a456-426614174000";

describe("Worker production migration preflight", () => {
  it("requires the exact account-scoped production database identity", () => {
    expect(
      assertProductionDatabaseIdentity(
        [{ name: PRODUCTION_DATABASE_NAME, uuid: productionDatabaseId }],
        productionDatabaseId,
      ),
    ).toBe(true);

    expect(() =>
      assertProductionDatabaseIdentity(
        [{ name: PRODUCTION_DATABASE_NAME, uuid: "123e4567-e89b-42d3-a456-426614174001" }],
        productionDatabaseId,
      ),
    ).toThrow(/does not match the exact account-scoped production database/);

    expect(() => assertProductionDatabaseIdentity([], productionDatabaseId)).toThrow(/expected exactly one/);
    expect(() =>
      assertProductionDatabaseIdentity(
        [
          { name: PRODUCTION_DATABASE_NAME, uuid: productionDatabaseId },
          { name: PRODUCTION_DATABASE_NAME, uuid: productionDatabaseId },
        ],
        productionDatabaseId,
      ),
    ).toThrow(/expected exactly one/);
  });

  it("builds a remote read-only migration-list command with provisioning disabled", () => {
    const args = buildProductionMigrationListArgs("/tmp/wrangler.production-preflight.toml");
    const joined = args.join(" ");

    expect(joined).toContain(`d1 migrations list ${PRODUCTION_DATABASE_NAME}`);
    expect(args).toContain("--remote");
    expect(args).toContain("production");
    expect(args).toContain("--experimental-provision=false");
    expect(args).toContain("--experimental-auto-create=false");
    expect(joined).not.toMatch(/\bmigrations apply\b/);
    expect(joined).not.toMatch(/\bwrangler deploy\b/);
    expect(joined).not.toMatch(/\btime-travel restore\b/);
    expect(joined).not.toMatch(/\bd1 execute\b/);
  });
});
