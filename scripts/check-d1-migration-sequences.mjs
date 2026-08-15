import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MIGRATION_NAME_PATTERN = /^(\d{4})_[a-z0-9][a-z0-9_-]*\.sql$/;
const legacy0007 = new Set([
  "0007_admin_user_profiles.sql",
  "0007_public_analytics_abuse_guard.sql",
]);
const LEGACY_DUPLICATES = new Map([["0007", legacy0007]]);

export function validateD1MigrationNames(fileNames) {
  const errors = [];
  const sequences = new Map();
  const sqlFileNames = fileNames
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const fileName of sqlFileNames) {
    const match = MIGRATION_NAME_PATTERN.exec(fileName);

    if (!match) {
      errors.push(
        `Invalid migration filename: ${fileName}. Expected NNNN_snake_case.sql.`,
      );
      continue;
    }

    const sequence = match[1];
    const names = sequences.get(sequence) ?? [];
    names.push(fileName);
    sequences.set(sequence, names);
  }

  for (const [sequence, names] of sequences) {
    if (names.length <= 1) continue;

    const legacy = LEGACY_DUPLICATES.get(sequence);
    const exactLegacyMatch =
      legacy &&
      names.length === legacy.size &&
      names.every((name) => legacy.has(name));

    if (!exactLegacyMatch) {
      const joinedNames = names.join(", ");
      errors.push(`Duplicate D1 migration sequence ${sequence}: ${joinedNames}`);
    }
  }

  for (const [sequence, legacyNames] of LEGACY_DUPLICATES) {
    const currentNames = new Set(sequences.get(sequence) ?? []);

    for (const legacyName of legacyNames) {
      if (!currentNames.has(legacyName)) {
        errors.push(
          `Historical migration ${legacyName} must remain present; ` +
            "do not rename applied D1 migrations.",
        );
      }
    }
  }

  return errors;
}

function main() {
  const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const migrationDirectory = join(
    repositoryRoot,
    "cloudflare",
    "public-api",
    "migrations",
  );
  const errors = validateD1MigrationNames(readdirSync(migrationDirectory));

  if (errors.length > 0) {
    console.error("D1 migration sequence validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    "D1 migration sequence validation passed. Legacy sequence 0007 remains " +
      "frozen and no new duplicates exist.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
