export type PublicReadResource =
  | "public-document-list"
  | "public-home"
  | "content-list"
  | "content-detail"
  | "search"
  | "program"
  | "visitor-stats";

export interface PublicReadRouteContract {
  resource: PublicReadResource;
  method: "GET";
  pathPattern: string;
  phase: "M17";
  responseType:
    | "PublicDocumentListSnapshot"
    | "PublicHomeSnapshot"
    | "PublicContentListSnapshot"
    | "ContentItem"
    | "PublicSearchIndexSnapshot"
    | "PublicProgramListSnapshot"
    | "VisitorStatsSettings";
  implemented: boolean;
}

export interface PublicReadNotImplementedContract {
  error: "Not implemented";
  resource: Exclude<PublicReadResource, "public-document-list">;
  phase: "M17";
}
