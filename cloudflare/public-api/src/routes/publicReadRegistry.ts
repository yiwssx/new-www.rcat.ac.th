import type { PublicReadResource, PublicReadRouteContract } from "../contracts/publicRead";

export const PUBLIC_READ_ROUTE_REGISTRY = [
  {
    resource: "public-document-list",
    method: "GET",
    pathPattern: "/api/public/documents",
    phase: "M17",
    responseType: "PublicDocumentListSnapshot",
    implemented: true
  },
  {
    resource: "public-home",
    method: "GET",
    pathPattern: "/api/public/home",
    phase: "M17",
    responseType: "PublicHomeSnapshot",
    implemented: false
  },
  {
    resource: "content-list",
    method: "GET",
    pathPattern: "/api/public/content",
    phase: "M17",
    responseType: "PublicContentListSnapshot",
    implemented: false
  },
  {
    resource: "content-detail",
    method: "GET",
    pathPattern: "/api/public/content/:slug",
    phase: "M17",
    responseType: "ContentItem",
    implemented: false
  },
  {
    resource: "search",
    method: "GET",
    pathPattern: "/api/public/search",
    phase: "M17",
    responseType: "PublicSearchIndexSnapshot",
    implemented: false
  },
  {
    resource: "program",
    method: "GET",
    pathPattern: "/api/public/programs",
    phase: "M17",
    responseType: "PublicProgramListSnapshot",
    implemented: false
  },
  {
    resource: "visitor-stats",
    method: "GET",
    pathPattern: "/api/public/visitor-stats",
    phase: "M17",
    responseType: "VisitorStatsSettings",
    implemented: false
  }
] as const satisfies readonly PublicReadRouteContract[];

export function getM17SkeletonResource(pathname: string): Exclude<PublicReadResource, "public-document-list"> | null {
  if (pathname === "/api/public/home") {
    return "public-home";
  }

  if (pathname === "/api/public/content") {
    return "content-list";
  }

  if (pathname.startsWith("/api/public/content/") && pathname.length > "/api/public/content/".length) {
    return "content-detail";
  }

  if (pathname === "/api/public/search") {
    return "search";
  }

  if (pathname === "/api/public/programs") {
    return "program";
  }

  if (pathname === "/api/public/visitor-stats") {
    return "visitor-stats";
  }

  return null;
}
