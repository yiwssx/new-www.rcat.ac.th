// @vitest-environment node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const protectedWorkflows = [
  "production-verification.yml",
  "production-data-operations.yml",
  "maintenance-recovery.yml",
  "apps-script-production-rollback.yml",
  "apps-script-production-release.yml",
  "worker-production.yml",
  "worker-production-rollback.yml"
];

const workflow = (name: string) => read(`.github/workflows/${name}`);

describe("GitHub deployment history taxonomy", () => {
  it("uses production as a protected credential gate without generic pseudo-deployments", () => {
    for (const name of protectedWorkflows) {
      const source = workflow(name);
      expect(source, name).toContain("name: production");
      expect(source, name).toContain("deployment: false");
      expect(source, name).not.toContain("environment: production");
    }
  });

  it("tracks only real external runtime mutations in service-specific deployment environments", () => {
    for (const name of ["apps-script-production-release.yml", "apps-script-production-rollback.yml"]) {
      expect(workflow(name)).toContain("DEPLOYMENT_ENVIRONMENT: apps-script-production");
    }
    for (const name of ["worker-production.yml", "worker-production-rollback.yml"]) {
      expect(workflow(name)).toContain("DEPLOYMENT_ENVIRONMENT: cloudflare-production");
    }
  });

  it("does not retain legacy pseudo-deployment retirement jobs", () => {
    for (const name of ["production-verification.yml", "maintenance-recovery.yml"]) {
      expect(workflow(name)).not.toContain("retire-environment-deployment");
    }
  });
});
