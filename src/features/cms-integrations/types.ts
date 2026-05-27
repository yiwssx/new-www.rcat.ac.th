export type IntegrationState = "connected" | "pending" | "error";

export interface IntegrationStatus {
  service: "Sheets" | "Drive" | "Docs";
  status: IntegrationState;
  detail: string;
  lastSync: string;
}
