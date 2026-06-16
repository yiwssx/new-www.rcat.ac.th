import { describe, expect, it } from "vitest";
import migrationSource from "../migrations/0004_admin_write_hardening.sql?raw";
import adminWriteSource from "../src/routes/adminWrite.ts?raw";

describe("M18 admin write hardening migration", () => {
  it("adds trigger-backed audit logging without destructive schema changes", () => {
    expect(migrationSource).toMatch(/CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+trg_contents_admin_audit/i);
    expect(migrationSource).toMatch(/CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+trg_documents_admin_audit/i);
    expect(migrationSource).toMatch(/CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+trg_public_home_sections_admin_audit/i);
    expect(migrationSource).toMatch(/CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+trg_visitor_daily_stats_admin_audit/i);
    expect(migrationSource).toMatch(/admin_audit_log/i);
    expect(migrationSource).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
    expect(migrationSource).not.toMatch(
      /\bDELETE\s+FROM\s+(contents|documents|public_home_sections|visitor_daily_stats)\b/i
    );
  });

  it("does not perform separate application audit inserts after structured mutations", () => {
    expect(adminWriteSource).not.toMatch(/function\s+insertAudit|INSERT\s+INTO\s+admin_audit_log/i);
  });
});
