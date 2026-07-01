import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SETTINGS_PATH = path.join(ROOT_DIR, "src", "config", "project-settings.json");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SITEMAP_PATH = path.join(PUBLIC_DIR, "sitemap.xml");
const ROBOTS_PATH = path.join(PUBLIC_DIR, "robots.txt");
const STATIC_ROUTES = ["/", "/news", "/announcements", "/departments", "/blog", "/contact"];
const PUBLIC_CONTENT_KINDS = ["news", "announcements", "blog"];

function parseEnvFile(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce((env, line) => {
      const separatorIndex = line.indexOf("=");

      if (separatorIndex <= 0) {
        return env;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");

      env[key] = value;
      return env;
    }, {});
}

async function loadLocalEnv() {
  const mode = process.env.NODE_ENV || "production";
  const files = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
  const env = {};

  for (const file of files) {
    const envPath = path.join(ROOT_DIR, file);

    if (!existsSync(envPath)) {
      continue;
    }

    Object.assign(env, parseEnvFile(await readFile(envPath, "utf8")));
  }

  return env;
}

function getEnvValue(localEnv, key) {
  return process.env[key]?.trim() || localEnv[key]?.trim() || "";
}

function trimTrailingSlash(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function hasProtocol(value) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value);
}

function isLocalSiteUrl(value) {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)(:\d+)?$/i.test(value);
}

export function normalizeSiteUrl(value, fallback = "https://example.edu") {
  const siteUrl = trimTrailingSlash(value);

  if (!siteUrl) {
    return normalizeSiteUrl(fallback);
  }

  if (isLocalSiteUrl(siteUrl) && fallback) {
    return normalizeSiteUrl(fallback);
  }

  if (hasProtocol(siteUrl)) {
    return siteUrl;
  }

  return `https://${siteUrl}`;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function routeToUrl(siteUrl, route) {
  if (route === "/") {
    return `${siteUrl}/`;
  }

  return `${siteUrl}/${route.replace(/^\/+/, "")}`;
}

function slugToRouteSegment(slug) {
  return normalizeSlug(slug)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isPublishedContent(item) {
  return Boolean(item?.slug) && item.status === "published";
}

export function buildSitemapUrls({ siteUrl, content = [] }) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const routes = new Set(STATIC_ROUTES);

  for (const item of content) {
    if (!isPublishedContent(item)) {
      continue;
    }

    const slug = slugToRouteSegment(item.slug);

    if (!slug) {
      continue;
    }

    routes.add(`/content/${slug}`);
    routes.add(`/${slug}`);
  }

  return Array.from(routes).map((route) => routeToUrl(normalizedSiteUrl, route));
}

export function createSitemapXml(urls, { lastmod = new Date().toISOString().slice(0, 10) } = {}) {
  const entries = Array.from(new Set(urls))
    .map(
      (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

export function createRobotsTxt(siteUrl) {
  return `User-agent: *
Allow: /

Sitemap: ${normalizeSiteUrl(siteUrl)}/sitemap.xml
`;
}

async function readProjectSettings() {
  return JSON.parse(await readFile(SETTINGS_PATH, "utf8"));
}

function buildCloudflarePublicApiUrl(baseUrl, path) {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);

  if (!normalizedBaseUrl) {
    return "";
  }

  return `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchCloudflarePublicContent(baseUrl) {
  if (!baseUrl) {
    return undefined;
  }

  const snapshots = await Promise.all(
    PUBLIC_CONTENT_KINDS.map(async (kind) => {
      const url = new URL(buildCloudflarePublicApiUrl(baseUrl, "/api/public/content"));
      url.searchParams.set("kind", kind);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Cloudflare content ${kind} request failed with ${response.status}`);
      }

      const data = await response.json();

      if (data?.error || (data?.statusCode && data.statusCode >= 400)) {
        throw new Error(data.error || `Cloudflare content ${kind} request failed with ${data.statusCode}`);
      }

      return data;
    })
  );

  return snapshots.flatMap((snapshot) => [
    ...(Array.isArray(snapshot?.items) ? snapshot.items : []),
    ...(Array.isArray(snapshot?.pageItems) ? snapshot.pageItems : [])
  ]);
}

async function main() {
  const [settings, localEnv] = await Promise.all([readProjectSettings(), loadLocalEnv()]);
  const siteUrl = normalizeSiteUrl(getEnvValue(localEnv, "VITE_PUBLIC_SITE_URL"), settings.site?.publicSiteUrl);
  const cloudflarePublicApiUrl = getEnvValue(localEnv, "VITE_CLOUDFLARE_PUBLIC_API_URL");
  let content = [];

  try {
    content = (await fetchCloudflarePublicContent(cloudflarePublicApiUrl)) ?? [];
  } catch (error) {
    console.warn(`Sitemap generator used static routes only: ${error.message}`);
  }

  const urls = buildSitemapUrls({ siteUrl, content });
  const xml = createSitemapXml(urls);

  await mkdir(PUBLIC_DIR, { recursive: true });
  await Promise.all([writeFile(SITEMAP_PATH, xml, "utf8"), writeFile(ROBOTS_PATH, createRobotsTxt(siteUrl), "utf8")]);
  console.log(`Generated public/sitemap.xml with ${urls.length} URL(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
