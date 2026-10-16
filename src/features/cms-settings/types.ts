import type { HomepageSocialWidgetSettings } from "./socialWidget";

export interface DisplaySettings {
  dateFormat: string;
  timeMode: "24h";
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

export type CarouselTransition = "slide" | "fade";

export interface HomepageCarouselSettings {
  autoplayEnabled: boolean;
  autoplayIntervalSeconds: number;
  showArrows: boolean;
  showDots: boolean;
  pauseOnHover: boolean;
  pauseOnFocus: boolean;
  transition: CarouselTransition;
}

export interface HomepageSettings {
  carousel: HomepageCarouselSettings;
  introGate: HomepageIntroGateSettings;
  marquee: HomepageMarqueeSettings;
  introVideo: HomepageIntroVideoSettings;
}

export interface FooterDirectoryLink {
  label: string;
  href: string;
  enabled: boolean;
}

export interface FooterDirectoryGroup {
  title: string;
  links: FooterDirectoryLink[];
}

/** Fixed canonical sequence: director, then four deputy slots. */
export interface LeadershipDeputy {
  enabled: boolean;
  name: string;
  title: string;
  description: string;
  imageUrl: string;
}

export interface HomepageLeadershipSettings {
  autoplayIntervalSeconds: number;
  deputies: LeadershipDeputy[];
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
  /** Optional data-driven Facebook Page and social directory on the homepage. */
  homepageSocial?: HomepageSocialWidgetSettings;
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
  /** Optional for older CMS snapshots and typed legacy fixtures. */
  leadership?: HomepageLeadershipSettings;
  mapUrl: string;
  mapEmbedUrl: string;
  footerTitle: string;
  footerDescription: string;
  footerDirectoryGroups: FooterDirectoryGroup[];
  messengerUrl: string;
  messengerLabel: string;
  messengerEnabled: boolean;
  mourningModeEnabled: boolean;
  mourningRibbonEnabled?: boolean;
  mourningModeLabel: string;
  mourningModeNotice: string;
}
