import { describe, expect, it } from "vitest";
import backupRecoverySource from "../src/routes/adminBackupRecovery.ts?raw";
import gapClosureSource from "../src/routes/adminCmsGapClosure.ts?raw";

describe("Admin backup error redaction (CodeQL S04)", () => {
  it("does not serialize arbitrary exceptions in recovery JSON responses", () => {
    expect(backupRecoverySource).not.toContain("detail: error instanceof Error ? error.message");
    expect(gapClosureSource).not.toContain("detail: error instanceof Error ? error.message");
    expect(backupRecoverySource).not.toContain("jsonError(error instanceof Error ? error.message");
    expect(backupRecoverySource).toContain('detail: "database constraint rejected recovery"');
    expect(backupRecoverySource).toContain('detail: "invalid backup row"');
    expect(gapClosureSource).toContain('detail: "invalid backup row"');
  });
});
