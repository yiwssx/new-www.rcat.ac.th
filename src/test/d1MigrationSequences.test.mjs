// @vitest-environment node

import { describe, expect, it } from "vitest";
import { validateD1MigrationNames } from "../../scripts/check-d1-migration-sequences.mjs";

const legacy = [
  "0001_public_read_schema.sql",
  "0006_m20_visitor_presence.sql",
  "0007_admin_user_profiles.sql",
  "0007_public_analytics_abuse_guard.sql",
  "0008_content_slug_tombstones.sql"
];

describe("D1 migration sequence validation", () => {
  it("accepts the frozen historical 0007 duplicate", () => {
    expect(validateD1MigrationNames(legacy)).toEqual([]);
  });

  it("rejects any new duplicate sequence", () => {
    expect(validateD1MigrationNames([...legacy, "0008_another_change.sql"])).toContain(
      "Duplicate D1 migration sequence 0008: 0008_another_change.sql, 0008_content_slug_tombstones.sql"
    );
  });

  it("rejects expansion of the legacy duplicate", () => {
    expect(validateD1MigrationNames([...legacy, "0007_third_migration.sql"])).toContain(
      "Duplicate D1 migration sequence 0007: 0007_admin_user_profiles.sql, 0007_public_analytics_abuse_guard.sql, 0007_third_migration.sql"
    );
  });

  it("rejects renaming an already-applied legacy migration", () => {
    const renamed = legacy.filter((name) => name !== "0007_admin_user_profiles.sql");
    renamed.push("0007_admin_profiles_renamed.sql");

    expect(validateD1MigrationNames(renamed)).toContain(
      "Historical migration 0007_admin_user_profiles.sql must remain present; do not rename applied D1 migrations."
    );
  });

  it("enforces canonical migration filenames", () => {
    expect(validateD1MigrationNames([...legacy, "12_bad.sql"])).toContain(
      "Invalid migration filename: 12_bad.sql. Expected NNNN_snake_case.sql."
    );
  });
});
