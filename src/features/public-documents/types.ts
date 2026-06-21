export interface PublicDocumentItem {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName: string;
  mediaId: string;
  publishedAt: string;
  order: number;
  pinned: boolean;
  updatedAt: string;
  revision?: number;
}

export interface PublicDocumentListSnapshot {
  items: PublicDocumentItem[];
  generatedAt: string;
}
