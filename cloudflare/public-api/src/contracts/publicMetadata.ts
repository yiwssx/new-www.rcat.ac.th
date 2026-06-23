export interface PublicSiteSettingsContract {
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
  footerDirectoryGroups: unknown[];
  messengerUrl: string;
  messengerLabel: string;
  messengerEnabled: boolean;
  mourningModeEnabled: boolean;
  mourningModeLabel: string;
  mourningModeNotice: string;
}

export interface PublicHomepageSettingsContract {
  carousel: {
    autoplayEnabled: boolean;
    autoplayIntervalSeconds: number;
  };
  introGate: {
    enabled: boolean;
    imageUrl: string;
    imageAlt: string;
    primaryButtonLabel: string;
    secondaryButtonLabel: string;
    secondaryButtonUrl: string;
    storageKey: string;
  };
  marquee: {
    enabled: boolean;
    label: string;
    text: string;
    speedSeconds: number;
  };
  introVideo: {
    enabled: boolean;
    title: string;
    youtubeEmbedUrl: string;
  };
}

export interface PublicDisplaySettingsContract {
  dateFormat: string;
  timeMode: "24h" | "12h";
}

export interface PublicMenuItemContract {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  children?: PublicMenuItemContract[];
}

export interface PublicMediaAssetContract {
  id: string;
  name: string;
  type: string;
  size: string;
  owner: string;
  driveUrl: string;
  fileId?: string;
  mimeType?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  embedUrl?: string;
  updatedAt: string;
}

export interface PublicCarouselSlideContract {
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

export interface PublicExternalServiceContract {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: string;
  iconKey: string;
  enabled: boolean;
  order: number;
  updatedAt: string;
}

export interface PublicEventContract {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  audience: string;
  status: string;
  location?: string;
  description?: string;
  category?: string;
  visibility?: string;
  updatedAt?: string;
}

export interface PublicMetadataContract {
  siteSettings: PublicSiteSettingsContract;
  homepageSettings: PublicHomepageSettingsContract;
  displaySettings: PublicDisplaySettingsContract;
  menu: PublicMenuItemContract[];
  media: PublicMediaAssetContract[];
  carouselSlides: PublicCarouselSlideContract[];
  externalServices: PublicExternalServiceContract[];
  events: PublicEventContract[];
}
