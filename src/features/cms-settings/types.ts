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
  footerDirectoryGroups: FooterDirectoryGroup[];
  messengerUrl: string;
  messengerLabel: string;
  messengerEnabled: boolean;
  mourningModeEnabled: boolean;
  mourningModeLabel: string;
  mourningModeNotice: string;
}
