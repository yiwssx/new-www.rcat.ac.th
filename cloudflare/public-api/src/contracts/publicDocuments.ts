export interface PublicDocumentItemContract {
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
}

export interface PublicDocumentListSnapshotContract {
  items: PublicDocumentItemContract[];
  generatedAt: string;
}
