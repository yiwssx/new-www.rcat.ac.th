import type { Env } from "../env";
import { requireD1Database } from "./documentsRepository";
import {
  CAROUSEL_SLIDE_ROW_COLUMNS,
  DISPLAY_SETTINGS_ROW_COLUMNS,
  EVENT_ROW_COLUMNS,
  EXTERNAL_SERVICE_ROW_COLUMNS,
  HOMEPAGE_SETTINGS_ROW_COLUMNS,
  MEDIA_ASSET_ROW_COLUMNS,
  MENU_ITEM_ROW_COLUMNS,
  SITE_SETTINGS_ROW_COLUMNS,
  type CarouselSlideRow,
  type DisplaySettingsRow,
  type EventRow,
  type ExternalServiceRow,
  type HomepageSettingsRow,
  type MediaAssetRow,
  type MenuItemRow,
  type SiteSettingsRow
} from "./schema";

export interface PublicMetadataRows {
  siteSettings: SiteSettingsRow | null;
  homepageSettings: HomepageSettingsRow | null;
  displaySettings: DisplaySettingsRow | null;
  menu: MenuItemRow[];
  media: MediaAssetRow[];
  carouselSlides: CarouselSlideRow[];
  externalServices: ExternalServiceRow[];
  events: EventRow[];
}

async function readSingleton<T>(env: Env, table: string, columns: readonly string[]): Promise<T | null> {
  const result = await requireD1Database(env)
    .prepare(`SELECT ${columns.join(", ")} FROM ${table} ORDER BY updated_at DESC LIMIT 1`)
    .all<T>();

  return result.results?.[0] ?? null;
}

async function readRows<T>(env: Env, query: string, bindings: unknown[] = []): Promise<T[]> {
  const statement = requireD1Database(env).prepare(query);
  const result = await (bindings.length ? statement.bind(...bindings) : statement).all<T>();

  return result.results ?? [];
}

export async function readPublicMetadataRows(env: Env): Promise<PublicMetadataRows> {
  const [siteSettings, homepageSettings, displaySettings, menu, media, carouselSlides, externalServices, events] =
    await Promise.all([
      readSingleton<SiteSettingsRow>(env, "site_settings", SITE_SETTINGS_ROW_COLUMNS),
      readSingleton<HomepageSettingsRow>(env, "homepage_settings", HOMEPAGE_SETTINGS_ROW_COLUMNS),
      readSingleton<DisplaySettingsRow>(env, "display_settings", DISPLAY_SETTINGS_ROW_COLUMNS),
      readRows<MenuItemRow>(
        env,
        `SELECT ${MENU_ITEM_ROW_COLUMNS.join(", ")} FROM menu_items WHERE enabled = ? ORDER BY sort_order ASC`,
        [1]
      ),
      readRows<MediaAssetRow>(
        env,
        `SELECT ${MEDIA_ASSET_ROW_COLUMNS.join(", ")} FROM media_assets ORDER BY updated_at DESC`
      ),
      readRows<CarouselSlideRow>(
        env,
        `SELECT ${CAROUSEL_SLIDE_ROW_COLUMNS.join(", ")} FROM carousel_slides WHERE enabled = ? ORDER BY sort_order ASC`,
        [1]
      ),
      readRows<ExternalServiceRow>(
        env,
        `SELECT ${EXTERNAL_SERVICE_ROW_COLUMNS.join(", ")} FROM external_services WHERE enabled = ? ORDER BY sort_order ASC`,
        [1]
      ),
      readRows<EventRow>(
        env,
        `SELECT ${EVENT_ROW_COLUMNS.join(", ")}
         FROM events
         WHERE visibility = ?
           AND status = ?
         ORDER BY date DESC, updated_at DESC`,
        ["public", "confirmed"]
      )
    ]);

  return {
    siteSettings,
    homepageSettings,
    displaySettings,
    menu,
    media,
    carouselSlides,
    externalServices,
    events
  };
}
