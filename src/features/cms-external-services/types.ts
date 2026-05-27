export type ExternalServiceTone =
  | "student"
  | "homeroom"
  | "management"
  | "learning"
  | "calendar"
  | "check"
  | "admission"
  | "career"
  | "general";

export type ExternalServiceIconKey =
  | "apps"
  | "calendar"
  | "check"
  | "groups"
  | "handshake"
  | "registration"
  | "book"
  | "school"
  | "link";

export interface ExternalServiceLink {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: ExternalServiceTone;
  iconKey: ExternalServiceIconKey;
  enabled: boolean;
  order: number;
  updatedAt: string;
}
