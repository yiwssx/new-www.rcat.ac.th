import type {
  PublicCarouselSlideContract,
  PublicDisplaySettingsContract,
  PublicEventContract,
  PublicExternalServiceContract,
  PublicHomepageSettingsContract,
  PublicMediaAssetContract,
  PublicMenuItemContract,
  PublicMetadataContract,
  PublicSiteSettingsContract
} from "../contracts/publicMetadata";
import type { PublicMetadataRows } from "../db/publicMetadataRepository";
import type { MenuItemRow } from "../db/schema";

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
  messengerEnabled: false
};

const emptyHomepageSettings: PublicHomepageSettingsContract = {
  carousel: {
    autoplayEnabled: false,
    autoplayIntervalSeconds: 5
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

function parseSettings<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return structuredClone(fallback);
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? ({ ...structuredClone(fallback), ...parsed } as T) : structuredClone(fallback);
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
  const media: PublicMediaAssetContract[] = rows.media.map((row) => ({
    id: row.id || "",
    name: row.name || "",
    type: row.type || "document",
    size: row.size || "",
    owner: "",
    driveUrl: row.drive_url || "",
    ...(row.file_id ? { fileId: row.file_id } : {}),
    ...(row.mime_type ? { mimeType: row.mime_type } : {}),
    ...(row.preview_url ? { previewUrl: row.preview_url } : {}),
    ...(row.embed_url ? { embedUrl: row.embed_url } : {}),
    updatedAt: row.updated_at || ""
  }));
  const carouselSlides: PublicCarouselSlideContract[] = rows.carouselSlides.map((row) => ({
    id: row.id || "",
    title: row.title || "",
    subtitle: row.subtitle || "",
    chip: row.chip || "",
    imageUrl: row.image_url || "",
    imageAlt: row.image_alt || "",
    buttonLabel: row.button_label || "",
    href: row.href || "",
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
  const events: PublicEventContract[] = rows.events.map((row) => ({
    id: row.id || "",
    title: row.title || "",
    date: row.date || "",
    ...(row.end_date ? { endDate: row.end_date } : {}),
    audience: row.audience || "",
    status: "confirmed",
    ...(row.location ? { location: row.location } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.category ? { category: row.category } : {}),
    visibility: "public",
    updatedAt: row.updated_at || ""
  }));

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
