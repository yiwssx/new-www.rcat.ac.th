export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  trend: string;
  tone: "blue" | "green" | "amber" | "red";
}
