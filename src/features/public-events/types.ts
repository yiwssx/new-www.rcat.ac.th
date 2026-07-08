import type { CalendarEvent } from "../cms-events/types";

export interface PublicEventListSnapshot {
  items: CalendarEvent[];
  generatedAt: string;
}
