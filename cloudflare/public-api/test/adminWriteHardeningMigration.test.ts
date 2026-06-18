import { describe, expect, it } from "vitest";
import migrationSource from "../migrations/0004_admin_write_hardening.sql?raw";
import adminWriteSource from "../src/routes/adminWrite.ts?raw";

function extractTriggerBlocks(source: string) {
  const blocks: string[] = [];
  let current: string[] | null = null;

  for (const line of source.split(/\r?\n/)) {
    if (/^\s*CREATE\s+TRIGGER\b/i.test(line)) {
      current = [line];
      continue;
    }

    if (!current) {
      continue;
    }

    current.push(line);

    if (/^\s*END;\s*$/i.test(line)) {
      blocks.push(current.join("\n"));
      current = null;
    }
  }

  return blocks;
}

function extractTriggerName(block: string) {
  return block.match(/CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+([a-z_]+)/i)?.[1] ?? "";
}

const expectedTriggerNames = [
  "trg_contents_admin_audit_archive",
  "trg_contents_admin_audit_insert",
  "trg_contents_admin_audit_publish",
  "trg_contents_admin_audit_unpublish",
  "trg_contents_admin_audit_update",
  "trg_documents_admin_audit_archive",
  "trg_documents_admin_audit_insert",
  "trg_documents_admin_audit_publish",
  "trg_documents_admin_audit_unpublish",
  "trg_documents_admin_audit_update",
  "trg_public_home_sections_admin_audit_archive",
  "trg_public_home_sections_admin_audit_insert",
  "trg_public_home_sections_admin_audit_update",
  "trg_visitor_daily_stats_admin_audit_delete",
  "trg_visitor_daily_stats_admin_audit_insert",
  "trg_visitor_daily_stats_admin_audit_update"
];

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

  it("keeps D1 trigger bodies parser-safe for Wrangler remote migrations", () => {
    const triggerBlocks = extractTriggerBlocks(migrationSource);
    const triggerNames = triggerBlocks.map(extractTriggerName).sort();
    const createTriggerStatements = migrationSource.match(/CREATE\s+TRIGGER\b/gi) ?? [];
    const safeCreateTriggerStatements = migrationSource.match(/CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\b/gi) ?? [];

    expect(triggerNames).toEqual([...expectedTriggerNames].sort());
    expect(safeCreateTriggerStatements).toHaveLength(createTriggerStatements.length);

    for (const block of triggerBlocks) {
      expect(block, extractTriggerName(block)).not.toMatch(/\bCASE\b/i);
    }
  });

  it("uses mutually exclusive update audit triggers with the expected action contract", () => {
    const triggerBlocks = Object.fromEntries(
      extractTriggerBlocks(migrationSource).map((block) => [extractTriggerName(block), block])
    );

    const expectedActions: Record<string, string> = {
      trg_contents_admin_audit_archive: "archive",
      trg_contents_admin_audit_insert: "create",
      trg_contents_admin_audit_publish: "publish",
      trg_contents_admin_audit_unpublish: "unpublish",
      trg_contents_admin_audit_update: "update",
      trg_documents_admin_audit_archive: "archive",
      trg_documents_admin_audit_insert: "create",
      trg_documents_admin_audit_publish: "publish",
      trg_documents_admin_audit_unpublish: "unpublish",
      trg_documents_admin_audit_update: "update",
      trg_public_home_sections_admin_audit_archive: "archive",
      trg_public_home_sections_admin_audit_insert: "create",
      trg_public_home_sections_admin_audit_update: "update",
      trg_visitor_daily_stats_admin_audit_delete: "delete",
      trg_visitor_daily_stats_admin_audit_insert: "create",
      trg_visitor_daily_stats_admin_audit_update: "update"
    };

    for (const [triggerName, action] of Object.entries(expectedActions)) {
      expect(triggerBlocks[triggerName], triggerName).toContain(`'${action}'`);
    }

    for (const triggerName of [
      "trg_contents_admin_audit_archive",
      "trg_contents_admin_audit_publish",
      "trg_contents_admin_audit_unpublish",
      "trg_contents_admin_audit_update",
      "trg_documents_admin_audit_archive",
      "trg_documents_admin_audit_publish",
      "trg_documents_admin_audit_unpublish",
      "trg_documents_admin_audit_update",
      "trg_public_home_sections_admin_audit_archive",
      "trg_public_home_sections_admin_audit_update"
    ]) {
      expect(triggerBlocks[triggerName], triggerName).toMatch(/\bWHEN\b/i);
    }

    for (const triggerName of [
      "trg_contents_admin_audit_publish",
      "trg_contents_admin_audit_unpublish",
      "trg_contents_admin_audit_update",
      "trg_documents_admin_audit_publish",
      "trg_documents_admin_audit_unpublish",
      "trg_documents_admin_audit_update"
    ]) {
      expect(triggerBlocks[triggerName], triggerName).toMatch(/NOT\s*\(\s*COALESCE\(OLD\.deleted_at/i);
    }
  });
});
