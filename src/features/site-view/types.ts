export interface SiteViewInput {
  visitorId: string;
  path: string;
  timestamp: string;
  referrerOrigin?: string;
  pageTitle?: string;
}

export interface ContentViewResponse {
  id: string;
  slug: string;
  viewCount: number;
  lastViewedAt: string;
}
