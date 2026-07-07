// @vitest-environment node
import { describe, expect, it } from "vitest";
import currentStatus from "../../../docs/architecture/current-migration-status.md?raw";
import m19Doc from "../../../docs/architecture/m19-parity-gap-assessment-2026-06-19.md?raw";
import rootPackage from "../../../package.json";
import workerReadme from "../README.md?raw";
import workerPackage from "../package.json";
import { formatM19ParityReadiness, runM19ParityReadiness } from "../scripts/m19-parity-readiness.mjs";

describe("M19 repository parity readiness", () => {
  it("keeps M19 closed while M20 is closed for migration runtime domain scope", () => {
    expect(m19Doc).toMatch(/Status: CLOSED for repository-owned M19 parity remediation/i);
    expect(m19Doc).toContain("FIXED_IN_THIS_CHANGE");
    expect(m19Doc).toContain("ALREADY_SATISFIED");
    expect(m19Doc).toContain("EXTERNAL_OPERATOR_BLOCKER");
    expect(m19Doc).toContain("INTENTIONAL_NON_GOAL");
    expect(m19Doc).toMatch(/M20.*not started/i);
    expect(m19Doc).toMatch(/Apps Script remains the fallback and rollback provider/i);
    expect(currentStatus).toMatch(/M19: `CLOSED` for repository-owned parity remediation/i);
    expect(currentStatus).toMatch(/M20: `CLOSED` for migration\/runtime\/domain-cutover scope/i);
    expect(currentStatus).toMatch(/M21: `OPEN` for UI\/UX and logic stabilization/i);
    expect(workerReadme).toMatch(/M19 Current Surface/i);
    expect(workerReadme).not.toMatch(/Current M3 Routes/i);
  });

  it("keeps M19 closure evidence free of infrastructure identifiers and live URLs", () => {
    const evidence = `${m19Doc}\n${currentStatus}\n${workerReadme}`;

    expect(evidence).not.toMatch(/https?:\/\//i);
    expect(evidence).not.toMatch(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    expect(evidence).not.toMatch(/script\.google\.com|drive\.google\.com|workers\.dev|vercel\.app/i);
  });

  it("reports repository readiness separately from external operator blockers", async () => {
    const result = await runM19ParityReadiness();

    expect(result.status).toBe("REPOSITORY_READY");
    expect(Object.values(result.checks).every((value) => value === "passed")).toBe(true);
    expect(result.externalOperatorBlockers).toEqual(
      expect.arrayContaining([
        "production identity and RBAC approval",
        "sanitized source-data inventory and reconciliation",
        "Google Drive bridge ownership and recovery approval",
        "production resources, monitoring, rollback, and cutover approval"
      ])
    );
    expect(result.safety).toEqual({
      remoteCommandsRun: false,
      d1Writes: false,
      workerDeploy: false,
      vercelMutation: false,
      appsScriptMutation: false,
      googleDriveMutation: false,
      productionCutover: false
    });
  });

  it("blocks when a repository-owned parity invariant is absent", async () => {
    const result = await runM19ParityReadiness({
      readFile: async () => ""
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.validationIssues.length).toBeGreaterThan(0);
  });

  it("prints only local checks and redacted external blocker labels", async () => {
    const output = formatM19ParityReadiness(await runM19ParityReadiness());

    expect(output).toContain("REPOSITORY_READY");
    expect(output).toContain("No remote commands were run.");
    expect(output).not.toMatch(/https?:\/\//i);
    expect(output).not.toMatch(/token|secret|database[_ -]?id/i);
  });

  it("exposes the readiness command from root and Worker packages", () => {
    expect(rootPackage.scripts["worker:m19:readiness"]).toBe(
      "node cloudflare/public-api/scripts/m19-parity-readiness.mjs"
    );
    expect(workerPackage.scripts["m19:readiness"]).toBe("node scripts/m19-parity-readiness.mjs");
  });
});
