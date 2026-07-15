import type {
  PublicCarouselSlideContract,
  PublicDisplaySettingsContract,
  PublicExternalServiceContract,
  PublicHomepageSettingsContract,
  PublicMediaAssetContract,
  PublicMenuItemContract,
  PublicMetadataContract,
  PublicSiteSettingsContract
} from "../contracts/publicMetadata";
import type { PublicMetadataRows } from "../db/publicMetadataRepository";
import type { MenuItemRow } from "../db/schema";
import { mapEventRowToPublicEventItem } from "./publicEventsAdapter";
import { mapMediaAssetRowToPublicMediaAsset } from "./publicMediaAdapter";

const emptySiteSettings: PublicSiteSettingsContract = {
  siteName: "",
  eyebrow: "",
  intro: "",
  campus: "",
  phone: "",
  fax: "",
  email: "",
  address: "",
  admissionUrl: "",
  facebookUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  heroTitle: "",
  heroDescription: "",
  heroChip: "",
  heroImageUrl: "",
  directorName: "",
  directorTitle: "",
  directorDescription: "",
  directorImageUrl: "",
  mapUrl: "",
  mapEmbedUrl: "",
  footerTitle: "",
  footerDescription: "",
  footerDirectoryGroups: [],
  messengerUrl: "",
  messengerLabel: "",
  messengerEnabled: false,
  mourningModeEnabled: false,
  mourningModeLabel: "",
  mourningModeNotice: ""
};

const emptyHomepageSettings: PublicHomepageSettingsContract = {
  carousel: {
    autoplayEnabled: true,
    autoplayIntervalSeconds: 5,
    showArrows: true,
    showDots: true,
    pauseOnHover: true,
    pauseOnFocus: true,
    transition: "slide"
  },
  introGate: {
    enabled: false,
    imageUrl: "",
    imageAlt: "",
    primaryButtonLabel: "",
    secondaryButtonLabel: "",
    secondaryButtonUrl: "",
    storageKey: ""
  },
  marquee: {
    enabled: false,
    label: "",
    text: "",
    speedSeconds: 20
  },
  introVideo: {
    enabled: false,
    title: "",
    youtubeEmbedUrl: ""
  }
};

const emptyDisplaySettings: PublicDisplaySettingsContract = {
  dateFormat: "D MMMM YYYY",
  timeMode: "24h"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCarouselImageFit(value: unknown) {
  return value === "fill" || value === "fit" || value === "fit-blur" ? value : "fit-blur";
}

function normalizeFocalPoint(value: unknown) {
  const numericValue =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isFinite(numericValue) ? Math.min(100, Math.max(0, numericValue)) : 50;
}

function normalizeBackgroundColor(value: unknown) {
  const color = typeof value === "string" ? value.trim().toLowerCase() : "";
  return color === "" || /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(color) ? color : "";
}

function normalizeCarouselTransition(value: unknown) {
  return value === "fade" || value === "slide" ? value : "slide";
}

function normalizeCarouselIntervalSeconds(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.min(30, Math.max(3, numericValue)) : 5;
}

function deepMergeSettings(fallback: unknown, parsed: Record<string, unknown>): unknown {
  if (!isRecord(fallback)) {
    return parsed;
  }

  const merged: Record<string, unknown> = { ...fallback };
  Object.entries(parsed).forEach(([key, value]) => {
    merged[key] = isRecord(merged[key]) && isRecord(value) ? deepMergeSettings(merged[key], value) : value;
  });

  if (isRecord(merged.carousel)) {
    merged.carousel = {
      ...merged.carousel,
      autoplayEnabled: typeof merged.carousel.autoplayEnabled === "boolean" ? merged.carousel.autoplayEnabled : true,
      autoplayIntervalSeconds: normalizeCarouselIntervalSeconds(merged.carousel.autoplayIntervalSeconds),
      showArrows: typeof merged.carousel.showArrows === "boolean" ? merged.carousel.showArrows : true,
      showDots: typeof merged.carousel.showDots === "boolean" ? merged.carousel.showDots : true,
      pauseOnHover: typeof merged.carousel.pauseOnHover === "boolean" ? merged.carousel.pauseOnHover : true,
      pauseOnFocus: typeof merged.carousel.pauseOnFocus === "boolean" ? merged.carousel.pauseOnFocus : true,
      transition: normalizeCarouselTransition(merged.carousel.transition)
    };
  }

  return merged;
}

function parseSettings<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return structuredClone(fallback);
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? (deepMergeSettings(structuredClone(fallback), parsed) as T) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function parseMenuChildren(value: string): PublicMenuItemContract[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isRecord).map((item) => ({
      id: String(item.id ?? ""),
      label: String(item.label ?? ""),
      href: String(item.href ?? ""),
      enabled: item.enabled !== false,
      ...(Array.isArray(item.children) ? { children: parseMenuChildren(JSON.stringify(item.children)) } : {})
    }));
  } catch {
    return [];
  }
}

function mapMenuRows(rows: MenuItemRow[]): PublicMenuItemContract[] {
  const nodes = new Map<string, PublicMenuItemContract>();

  rows.forEach((row) => {
    const children = parseMenuChildren(row.children_json);
    nodes.set(row.id, {
      id: row.id || "",
      label: row.label || "",
      href: row.href || "",
      enabled: row.enabled === 1,
      ...(children.length ? { children } : {})
    });
  });

  const roots: PublicMenuItemContract[] = [];
  rows.forEach((row) => {
    const node = nodes.get(row.id);

    if (!node) {
      return;
    }

    const parent = row.parent_id ? nodes.get(row.parent_id) : undefined;

    if (!parent) {
      roots.push(node);
      return;
    }

    parent.children = [...(parent.children ?? []), node];
  });

  return roots;
}

export function createPublicMetadata(rows: PublicMetadataRows): PublicMetadataContract {
  const media: PublicMediaAssetContract[] = rows.media.map(mapMediaAssetRowToPublicMediaAsset);
  const carouselSlides: PublicCarouselSlideContract[] = rows.carouselSlides.map((row) => ({
    id: row.id || "",
    title: row.title || "",
    subtitle: row.subtitle || "",
    chip: row.chip || "",
    imageUrl: row.image_url || "",
    imageAlt: row.image_alt || "",
    buttonLabel: row.button_label || "",
    href: row.href || "",
    imageFit: normalizeCarouselImageFit(row.image_fit),
    focalPointX: normalizeFocalPoint(row.focal_point_x),
    focalPointY: normalizeFocalPoint(row.focal_point_y),
    mobileImageUrl: String(row.mobile_image_url ?? "").trim(),
    backgroundColor: normalizeBackgroundColor(row.background_color),
    openInNewTab: row.open_in_new_tab === 1,
    enabled: row.enabled === 1,
    order: Math.max(0, Number(row.sort_order) || 0),
    ...(row.start_at ? { startAt: row.start_at } : {}),
    ...(row.end_at ? { endAt: row.end_at } : {}),
    updatedAt: row.updated_at || ""
  }));
  const externalServices: PublicExternalServiceContract[] = rows.externalServices.map((row) => ({
    id: row.id || "",
    title: row.title || "",
    description: row.description || "",
    href: row.href || "",
    tone: row.tone || "general",
    iconKey: row.icon_key || "link",
    enabled: row.enabled === 1,
    order: Math.max(0, Number(row.sort_order) || 0),
    updatedAt: row.updated_at || ""
  }));
  const events = rows.events.map(mapEventRowToPublicEventItem);

  return {
    siteSettings: parseSettings(rows.siteSettings?.settings_json, emptySiteSettings),
    homepageSettings: parseSettings(rows.homepageSettings?.settings_json, emptyHomepageSettings),
    displaySettings: parseSettings(rows.displaySettings?.settings_json, emptyDisplaySettings),
    menu: mapMenuRows(rows.menu),
    media,
    carouselSlides,
    externalServices,
    events
  };
}

export function createEmptyPublicMetadata(): PublicMetadataContract {
  return createPublicMetadata({
    siteSettings: null,
    homepageSettings: null,
    displaySettings: null,
    menu: [],
    media: [],
    carouselSlides: [],
    externalServices: [],
    events: []
  });
}

export function filterPublicMedia(
  media: PublicMediaAssetContract[],
  content: Array<{ featuredMediaId?: string; mediaIds?: string[] }>
) {
  const ids = new Set<string>();

  content.forEach((item) => {
    if (item.featuredMediaId) {
      ids.add(item.featuredMediaId);
    }

    item.mediaIds?.forEach((id) => ids.add(id));
  });

  return media.filter((item) => ids.has(item.id));
}
