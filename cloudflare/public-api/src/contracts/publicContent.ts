export interface PublicContentItemContract {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  publishedAt: string;
  updatedAt: string;
}

export interface PublicContentListSnapshotContract {
  items: PublicContentItemContract[];
  generatedAt: string;
}

export interface PublicContentDetailSnapshotContract {
  item: PublicContentItemContract;
  generatedAt: string;
}
