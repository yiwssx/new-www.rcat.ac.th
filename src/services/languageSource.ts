import type { PublicLanguageSource } from "../pages/PublicHomePage";
import { getGoogleAppsScriptUrl, projectSettings } from "../config/projectSettings";
import { LanguageSourceItem } from "../types";
import {
  getLanguageSourceItemsFromApi,
  saveLanguageSourceItemsToApi
} from "./googleApi";

const storageKey = projectSettings.storageKeys.publicLanguageSource;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenSource(
  value: unknown,
  path: string,
  output: Record<string, string>
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const nextPath = path ? `${path}.${index}` : String(index);
      flattenSource(item, nextPath, output);
    });
    return;
  }

  if (isObject(value)) {
    Object.entries(value).forEach(([key, item]) => {
      const nextPath = path ? `${path}.${key}` : key;
      flattenSource(item, nextPath, output);
    });
    return;
  }

  output[path] = value === undefined || value === null ? "" : String(value);
}

function setPathValue(target: unknown, path: string, value: string) {
  const segments = path.split(".").filter(Boolean);
  if (!segments.length) {
    return;
  }

  let current: unknown = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    const isArrayIndex = /^\d+$/.test(nextSegment);

    if (!current || (typeof current !== "object" && !Array.isArray(current))) {
      return;
    }

    const container = current as Record<string, unknown> | unknown[];

    if (Array.isArray(container)) {
      const numericSegment = Number(segment);
      if (Number.isNaN(numericSegment)) {
        return;
      }
      if (container[numericSegment] === undefined) {
        container[numericSegment] = isArrayIndex ? [] : {};
      }
      current = container[numericSegment];
      continue;
    }

    if (!(segment in container) || container[segment] === undefined || container[segment] === null) {
      container[segment] = isArrayIndex ? [] : {};
    }
    current = container[segment];
  }

  const lastSegment = segments[segments.length - 1];
  if (!current || (typeof current !== "object" && !Array.isArray(current))) {
    return;
  }

  if (Array.isArray(current)) {
    const numericSegment = Number(lastSegment);
    if (!Number.isNaN(numericSegment)) {
      current[numericSegment] = value;
    }
    return;
  }

  (current as Record<string, unknown>)[lastSegment] = value;
}

function toLanguageItems(source: PublicLanguageSource): LanguageSourceItem[] {
  const thMap: Record<string, string> = {};
  const enMap: Record<string, string> = {};
  flattenSource(source.th, "", thMap);
  flattenSource(source.en, "", enMap);
  const keys = Array.from(new Set([...Object.keys(thMap), ...Object.keys(enMap)])).sort((a, b) =>
    a.localeCompare(b)
  );

  return keys.map((key) => ({
    key,
    th: thMap[key] ?? "",
    en: enMap[key] ?? ""
  }));
}

function fromLanguageItems(
  fallback: PublicLanguageSource,
  items: LanguageSourceItem[]
): PublicLanguageSource {
  const base = JSON.parse(JSON.stringify(fallback)) as PublicLanguageSource;

  items.forEach((item) => {
    if (!item.key) {
      return;
    }

    setPathValue(base.th, item.key, item.th ?? "");
    setPathValue(base.en, item.key, item.en ?? "");
  });

  return base;
}

function parseStoredItems(value: string | null): LanguageSourceItem[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .filter((item) => item && typeof item === "object" && "key" in item)
      .map((item) => {
        const row = item as Partial<LanguageSourceItem>;
        return {
          key: String(row.key || ""),
          th: String(row.th || ""),
          en: String(row.en || "")
        };
      })
      .filter((item) => item.key);
  } catch {
    return null;
  }
}

function persistLanguageItems(items: LanguageSourceItem[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

function usingBackendLanguageSource() {
  return Boolean(getGoogleAppsScriptUrl());
}

export function getPublicLanguageRows(fallback: PublicLanguageSource): LanguageSourceItem[] {
  const stored = parseStoredItems(window.localStorage.getItem(storageKey));
  return stored && stored.length ? stored : toLanguageItems(fallback);
}

export function getPublicLanguageSource(fallback: PublicLanguageSource): PublicLanguageSource {
  return fromLanguageItems(fallback, getPublicLanguageRows(fallback));
}

export async function loadPublicLanguageSource(fallback: PublicLanguageSource): Promise<PublicLanguageSource> {
  if (!usingBackendLanguageSource()) {
    return getPublicLanguageSource(fallback);
  }

  try {
    const items = await getLanguageSourceItemsFromApi();
    const nextItems = items.length ? items : toLanguageItems(fallback);
    persistLanguageItems(nextItems);
    return fromLanguageItems(fallback, nextItems);
  } catch {
    return getPublicLanguageSource(fallback);
  }
}

export async function savePublicLanguageRows(items: LanguageSourceItem[]): Promise<LanguageSourceItem[]> {
  const cleanedItems = items
    .map((item) => ({
      key: String(item.key || "").trim(),
      th: item.th ?? "",
      en: item.en ?? ""
    }))
    .filter((item) => item.key);

  if (usingBackendLanguageSource()) {
    const saved = await saveLanguageSourceItemsToApi(cleanedItems);
    persistLanguageItems(saved);
    return saved;
  }

  persistLanguageItems(cleanedItems);
  return cleanedItems;
}

export async function savePublicLanguageSource(source: PublicLanguageSource) {
  const rows = toLanguageItems(source);
  await savePublicLanguageRows(rows);
}

export function clearPublicLanguageSource() {
  window.localStorage.removeItem(storageKey);
}
