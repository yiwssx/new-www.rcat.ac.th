export type ExternalServiceTone =
  "student" | "homeroom" | "management" | "learning" | "calendar" | "check" | "admission" | "career" | "general";

export type ExternalServiceIconKey =
  "apps" | "calendar" | "check" | "groups" | "handshake" | "registration" | "book" | "school" | "link";

export type ExternalServiceIconValue = ExternalServiceIconKey | `media:${string}`;

export interface ExternalServiceLink {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: ExternalServiceTone;
  iconKey: ExternalServiceIconValue;
  enabled: boolean;
  order: number;
  updatedAt: string;
  revision?: number;
}

export type ExternalServiceLinkInput = Partial<ExternalServiceLink>;
