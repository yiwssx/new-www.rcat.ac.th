const PRODUCTION_DATABASE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCTION_BINDING_PATTERN = /(\[\[env\.production\.d1_databases\]\][\s\S]*?database_id\s*=\s*")([^"]+)(")/;

export function validateProductionDatabaseId(value) {
  const databaseId = String(value || "").trim();

  if (!PRODUCTION_DATABASE_ID_PATTERN.test(databaseId)) {
    throw new Error("RCAT_PRODUCTION_D1_DATABASE_ID must be a valid D1 database UUID");
  }

  return databaseId;
}

export function createProductionWranglerConfig(source, databaseId) {
  const validatedDatabaseId = validateProductionDatabaseId(databaseId);
  const config = String(source || "");
  const match = config.match(PRODUCTION_BINDING_PATTERN);

  if (!config.includes("[env.production]")) {
    throw new Error("wrangler config is missing [env.production]");
  }

  if (!match) {
    throw new Error("wrangler config is missing the production D1 binding");
  }

  if (match[2] !== "production-placeholder") {
    throw new Error("tracked production D1 binding must remain production-placeholder");
  }

  return config.replace(PRODUCTION_BINDING_PATTERN, `$1${validatedDatabaseId}$3`);
}
