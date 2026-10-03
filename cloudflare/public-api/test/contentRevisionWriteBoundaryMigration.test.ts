import { describe, expect, it } from "vitest";
import revisionSchemaHardeningSource from "../migrations/0018_content_revision_history_hardening.sql?raw";
import writeBoundaryMigrationSource from "../migrations/0019_content_revision_write_boundary.sql?raw";
import adminWriteSource from "../src/routes/adminWrite.ts?raw";

describe("content revision write boundary", () => {
  it("moves revision capture to fail-closed post-mutation D1 triggers", () => {
    expect(writeBoundaryMigrationSource).toMatch(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_contents_revision_snapshot/i);
    expect(writeBoundaryMigrationSource).toMatch(
      /CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+trg_contents_revision_snapshot_insert[\s\S]*AFTER\s+INSERT\s+ON\s+contents/i
    );
    expect(writeBoundaryMigrationSource).toMatch(
      /CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+trg_contents_revision_snapshot_update[\s\S]*AFTER\s+UPDATE\s+ON\s+contents/i
    );
    expect(writeBoundaryMigrationSource).not.toMatch(/INSERT\s+OR\s+IGNORE\s+INTO\s+content_revisions/i);
    expect(writeBoundaryMigrationSource).not.toMatch(/INSERT\s+OR\s+REPLACE\s+INTO\s+content_revisions/i);
  });

  it("records the resulting state for create and versioned updates", () => {
    expect(writeBoundaryMigrationSource).toMatch(/NEW\.id[\s\S]*COALESCE\(NEW\.revision,\s*0\)[\s\S]*'create'/i);
    expect(writeBoundaryMigrationSource).toMatch(
      /AFTER\s+UPDATE\s+ON\s+contents[\s\S]*WHEN\s+COALESCE\(NEW\.revision,\s*0\)\s*<>\s*COALESCE\(OLD\.revision,\s*0\)/i
    );
    expect(writeBoundaryMigrationSource).toMatch(/'revision',\s*COALESCE\(NEW\.revision,\s*0\)/i);
    expect(writeBoundaryMigrationSource).toMatch(/OLD\.status\s*<>\s*'published'\s+AND\s+NEW\.status\s*=\s*'published'[\s\S]*'publish'/i);
    expect(writeBoundaryMigrationSource).toMatch(/OLD\.status\s*=\s*'published'\s+AND\s+NEW\.status\s*<>\s*'published'[\s\S]*'unpublish'/i);
  });

  it("keeps history immutable and does not mutate content from the migration itself", () => {
    expect(revisionSchemaHardeningSource).toMatch(/BEFORE\s+UPDATE\s+ON\s+content_revisions[\s\S]*RAISE\(ABORT/i);
    expect(revisionSchemaHardeningSource).toMatch(/BEFORE\s+DELETE\s+ON\s+content_revisions[\s\S]*RAISE\(ABORT/i);
    expect(writeBoundaryMigrationSource).not.toMatch(/\bINSERT\s+INTO\s+contents\b/i);
    expect(writeBoundaryMigrationSource).not.toMatch(/\bUPDATE\s+contents\b/i);
    expect(writeBoundaryMigrationSource).not.toMatch(/\bDELETE\s+FROM\s+contents\b/i);
  });

  it("retains Worker-owned revision advancement for create, update, publish and unpublish", () => {
    expect(adminWriteSource).toMatch(/async\s+function\s+insertContentRow[\s\S]*?INSERT\s+INTO\s+contents/i);
    expect(adminWriteSource).toMatch(
      /revision:\s*existing\s*\?\s*Number\(existing\.revision\s*\?\?\s*0\)\s*\+\s*1\s*:\s*0/i
    );
    expect(adminWriteSource).toMatch(/async\s+function\s+updateContentRow[\s\S]*?revision\s*=\s*\?/i);
    expect(adminWriteSource).toMatch(
      /SET\s+status\s*=\s*\?,\s*publish_at\s*=\s*\?,\s*updated_at\s*=\s*\?,\s*updated_by\s*=\s*\?,\s*revision\s*=\s*revision\s*\+\s*1/i
    );
  });
});
