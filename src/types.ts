export type ContentStatus = "draft" | "review" | "scheduled" | "published";

export type ContentType = "page" | "news" | "program" | "announcement" | "blog";

export type MediaType = "image" | "document" | "sheet" | "video";

export type IntegrationState = "connected" | "pending" | "error";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  avatarUrl?: string;
}

export interface UserAccount extends User {
  status: "active" | "disabled";
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  user: User;
  token: string;
  expiresAt: string;
}

export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  status: ContentStatus;
  owner: string;
  summary: string;
  body?: string;
  category?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  canonicalUrl?: string;
  featured?: boolean;
  readingMinutes?: number;
  template?: string;
  bodyDocId?: string;
  bodyDocUrl?: string;
  featuredMediaId?: string;
  mediaIds?: string[];
  viewCount?: number;
  lastViewedAt?: string;
  updatedAt: string;
  publishAt: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: MediaType;
  size: string;
  owner: string;
  driveUrl: string;
  fileId?: string;
  mimeType?: string;
  previewUrl?: string;
  embedUrl?: string;
  updatedAt: string;
}

export interface CarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  chip: string;
  imageUrl: string;
  imageAlt: string;
  buttonLabel: string;
  href: string;
  enabled: boolean;
  order: number;
  startAt?: string;
  endAt?: string;
  updatedAt: string;
}

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
}

export interface PublicMenuItem {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  children?: PublicMenuItem[];
}

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  trend: string;
  tone: "blue" | "green" | "amber" | "red";
}

export interface IntegrationStatus {
  service: "Sheets" | "Drive" | "Docs";
  status: IntegrationState;
  detail: string;
  lastSync: string;
}

export interface RolePermission {
  id: string;
  role: string;
  scope: string;
  canPublish: boolean;
  canManageUsers: boolean;
}

export interface CmsSnapshot {
  metrics: DashboardMetric[];
  content: ContentItem[];
  media: MediaAsset[];
  events: CalendarEvent[];
  menu?: PublicMenuItem[];
  carouselSlides?: CarouselSlide[];
  displaySettings?: DisplaySettings;
  siteSettings?: SiteSettings;
  homepageSettings?: HomepageSettings;
}

export interface DisplaySettings {
  dateFormat: string;
  timeMode: "24h" | "12h";
}

export interface HomepageIntroGateSettings {
  enabled: boolean;
  imageUrl: string;
  imageAlt: string;
  primaryButtonLabel: string;
  secondaryButtonLabel: string;
  secondaryButtonUrl: string;
  storageKey: string;
}

export interface HomepageMarqueeSettings {
  enabled: boolean;
  label: string;
  text: string;
  speedSeconds: number;
}

export interface HomepageIntroVideoSettings {
  enabled: boolean;
  title: string;
  youtubeEmbedUrl: string;
}

export interface HomepageSettings {
  introGate: HomepageIntroGateSettings;
  marquee: HomepageMarqueeSettings;
  introVideo: HomepageIntroVideoSettings;
}

export interface SiteSettings {
  siteName: string;
  eyebrow: string;
  intro: string;
  campus: string;
  phone: string;
  fax: string;
  email: string;
  address: string;
  admissionUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  heroTitle: string;
  heroDescription: string;
  heroChip: string;
  heroImageUrl: string;
  directorName: string;
  directorTitle: string;
  directorDescription: string;
  directorImageUrl: string;
  mapUrl: string;
  mapEmbedUrl: string;
  footerTitle: string;
  footerDescription: string;
}
