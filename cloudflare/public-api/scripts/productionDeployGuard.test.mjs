// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_WORKER_RESOURCE_NAME,
  createProductionWranglerConfig,
  validateProductionDatabaseId
} from "./productionDeployGuard.mjs";

const productionDatabaseId = "123e4567-e89b-42d3-a456-426614174000";
const source = `name = "rcat-public-api"

[env.production]
name = "rcat-public-api-preview"

[[env.production.d1_databases]]
binding = "DB"
database_name = "rcat-public-api-preview"
database_id = "production-placeholder"
`;

describe("production Worker deploy guard", () => {
  it("accepts the promoted production Worker and D1 UUID", () => {
    expect(PRODUCTION_WORKER_RESOURCE_NAME).toBe("rcat-public-api-preview");
    expect(validateProductionDatabaseId(productionDatabaseId)).toBe(productionDatabaseId);

    const prepared = createProductionWranglerConfig(source, productionDatabaseId);
    expect(prepared).toContain('name = "rcat-public-api-preview"');
    expect(prepared).toContain(`database_id = "${productionDatabaseId}"`);
    expect(prepared).toContain('database_name = "rcat-public-api-preview"');
    expect(prepared).not.toContain("production-placeholder");
  });

  it("fails closed when the production D1 ID is missing or malformed", () => {
    expect(() => validateProductionDatabaseId("")).toThrow(/valid D1 database UUID/);
    expect(() => validateProductionDatabaseId("production-placeholder")).toThrow(/valid D1 database UUID/);
  });

  it("refuses tracked configs that point production at another Worker", () => {
    const renamedWorker = source.replace('name = "rcat-public-api-preview"', 'name = "rcat-public-api-production"');

    expect(() => createProductionWranglerConfig(renamedWorker, productionDatabaseId)).toThrow(
      /tracked production Worker must remain rcat-public-api-preview/
    );
  });

  it("refuses tracked configs that already contain a real production binding", () => {
    const committedRealId = source.replace("production-placeholder", productionDatabaseId);

    expect(() => createProductionWranglerConfig(committedRealId, productionDatabaseId)).toThrow(
      /tracked production D1 binding must remain production-placeholder/
    );
  });
});
