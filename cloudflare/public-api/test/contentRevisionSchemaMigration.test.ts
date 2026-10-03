import { describe, expect, it } from "vitest";
import foundationSource from "../migrations/0016_content_lifecycle_governance.sql?raw";
import hardeningSource from "../migrations/0018_content_revision_history_hardening.sql?raw";

const combinedSource = `${foundationSource}\n${hardeningSource}`;

describe("v3.3.1 content revision history schema", () => {
  it("keeps the existing additive content_revisions store as the canonical history schema", () => {
    expect(foundationSource).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+content_revisions/i);
    expect(foundationSource).toMatch(/content_id\s+TEXT\s+NOT\s+NULL/i);
    expect(foundationSource).toMatch(/revision\s+INTEGER\s+NOT\s+NULL/i);
    expect(foundationSource).toMatch(/reason\s+TEXT\s+NOT\s+NULL/i);
    expect(foundationSource).toMatch(/actor\s+TEXT\s+NOT\s+NULL/i);
    expect(foundationSource).toMatch(/snapshot_json\s+TEXT\s+NOT\s+NULL/i);
    expect(foundationSource).toMatch(/created_at\s+TEXT\s+NOT\s+NULL/i);
    expect(foundationSource).toMatch(/UNIQUE\s*\(\s*content_id\s*,\s*revision\s*\)/i);
    expect(hardeningSource).not.toMatch(/CREATE\s+TABLE\b/i);
  });

  it("retains a restorable editable-content snapshot contract", () => {
    for (const field of [
      "'slug'",
      "'type'",
      "'status'",
      "'owner'",
      "'title'",
      "'summary'",
      "'body'",
      "'category'",
      "'tagsJson'",
      "'seoTitle'",
      "'seoDescription'",
      "'canonicalUrl'",
      "'template'",
      "'bodyDocId'",
      "'bodyDocUrl'",
      "'featuredMediaId'",
      "'mediaIdsJson'",
      "'publishAt'",
      "'unpublishAt'"
    ]) {
      expect(foundationSource, field).toContain(field);
    }
  });

  it("supports content-id/revision history queries and prevents historical rewrites", () => {
    expect(hardeningSource).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_content_revisions_content_revision\s+ON\s+content_revisions\s*\(\s*content_id\s*,\s*revision\s+DESC\s*\)/i
    );
    expect(hardeningSource).toMatch(
      /CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+trg_content_revisions_immutable_update\s+BEFORE\s+UPDATE\s+ON\s+content_revisions/i
    );
    expect(hardeningSource).toMatch(
      /CREATE\s+TRIGGER\s+IF\s+NOT\s+EXISTS\s+trg_content_revisions_immutable_delete\s+BEFORE\s+DELETE\s+ON\s+content_revisions/i
    );
    expect(hardeningSource.match(/RAISE\s*\(\s*ABORT\s*,\s*'content revisions are immutable'\s*\)/gi)).toHaveLength(2);
  });

  it("is additive and does not mutate production data by itself", () => {
    expect(combinedSource).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
    expect(hardeningSource).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?contents\b/i);
    expect(hardeningSource).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?content_revisions\b/i);
  });
});
