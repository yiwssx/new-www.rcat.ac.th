import type { CalendarEvent } from "../cms-events/types";
import type { MediaAsset } from "../cms-media/types";

export interface PublicEventListSnapshot {
  items: CalendarEvent[];
  media: MediaAsset[];
  generatedAt: string;
}
