import fs from "node:fs";
import { pathToFileURL } from "node:url";

function readArgument(name, argv = process.argv.slice(2)) {
  const index = argv.indexOf(name);
  return index >= 0 ? String(argv[index + 1] || "").trim() : "";
}

export function collectFixtureAuditRows(value) {
  const statements = Array.isArray(value) ? value : [value];
  return statements.flatMap((statement) => {
    const rows = statement && typeof statement === "object" && Array.isArray(statement.results) ? statement.results : [];
    return rows.filter(
      (row) =>
        row &&
        typeof row === "object" &&
        typeof row.source === "string" &&
        typeof row.fixture_key === "string"
    );
  });
}

export function validateFixtureAuditPayload(value, { expectClean = false } = {}) {
  const rows = collectFixtureAuditRows(value);
  const fixtures = rows.map((row) => `${row.source}:${row.fixture_key}`);

  if (expectClean && fixtures.length > 0) {
    throw new Error(`production fixture sentinel failed: ${fixtures.join(", ")}`);
  }

  return { count: fixtures.length, fixtures };
}

export function main(argv = process.argv.slice(2)) {
  const file = readArgument("--file", argv);
  const expectClean = argv.includes("--expect-clean");

  if (!file) {
    throw new Error("--file is required");
  }

  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  const result = validateFixtureAuditPayload(value, { expectClean });

  console.log(`Production fixture audit: ${result.count} exact fixture row(s) found.`);
  result.fixtures.forEach((fixture) => console.log(`- ${fixture}`));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
