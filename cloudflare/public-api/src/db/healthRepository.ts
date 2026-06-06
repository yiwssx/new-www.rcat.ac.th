import type { Env } from "../env";

export interface HealthDatabaseStatus {
  dbConfigured: boolean;
}

export function getHealthDatabaseStatus(env: Env): HealthDatabaseStatus {
  return {
    dbConfigured: Boolean(env.DB)
  };
}
