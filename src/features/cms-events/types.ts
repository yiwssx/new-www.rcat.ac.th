export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  audience: string;
  status: "confirmed" | "draft" | "cancelled";
  location?: string;
  description?: string;
  category?: string;
  visibility?: "public" | "private";
  updatedAt?: string;
  revision?: number;
}
