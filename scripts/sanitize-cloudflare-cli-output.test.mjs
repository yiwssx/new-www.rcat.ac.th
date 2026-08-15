import { describe, expect, it } from "vitest";
import { formatCloudflareCliDiagnostic, sanitizeCloudflareCliOutput } from "./sanitize-cloudflare-cli-output.mjs";

describe("Cloudflare CLI diagnostic sanitizer", () => {
  it("redacts protected identifiers and authorization material while preserving the actionable D1 error", () => {
    const accountId = "0123456789abcdef0123456789abcdef";
    const databaseId = "11111111-2222-4333-8444-555555555555";
    const token = "secret-token-value";
    const input = [
      `ERROR A request to the Cloudflare API (/accounts/${accountId}/d1/database/${databaseId}) failed.`,
      "The table visitor_daily_stats has no column named sample_column [code: 7500]",
      `Authorization: Bearer ${token}`,
      `CLOUDFLARE_ACCOUNT_ID=${accountId}`,
      `CLOUDFLARE_API_TOKEN=${token}`
    ].join("\n");

    const output = sanitizeCloudflareCliOutput(input);

    expect(output).not.toContain(accountId);
    expect(output).not.toContain(databaseId);
    expect(output).not.toContain(token);
    expect(output).toContain("/accounts/***/d1/database/***");
    expect(output).toContain("visitor_daily_stats");
    expect(output).toContain("[code: 7500]");
  });

  it("caps diagnostics and handles empty output without masking the original command failure", () => {
    expect(formatCloudflareCliDiagnostic("", { label: "stderr" })).toBe("[stderr] (no output)");
    const output = formatCloudflareCliDiagnostic("x".repeat(50), { label: "stdout", limit: 10 });
    expect(output).toContain("[stdout]");
    expect(output).toContain("xxxxxxxxxx");
    expect(output).toContain("[diagnostic output truncated]");
  });
});
