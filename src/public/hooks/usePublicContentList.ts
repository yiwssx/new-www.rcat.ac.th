import { useQuery } from "@tanstack/react-query";
import { publicContentListQueryOptions, type PublicContentListPageInput } from "../../features/public-content";
import type { PublicContentListKind } from "../../types";

interface UsePublicContentListOptions {
  pageInput?: PublicContentListPageInput;
}

function normalizePageInput(pageInput: PublicContentListPageInput | undefined) {
  if (!pageInput) {
    return undefined;
  }

  return {
    page: Math.max(1, Math.floor(pageInput.page)),
    pageSize: pageInput.pageSize === undefined ? undefined : Math.min(100, Math.max(1, Math.floor(pageInput.pageSize)))
  };
}

export function usePublicContentList(
  kind: PublicContentListKind,
  pageItemsInput?: PublicContentListPageInput,
  options: UsePublicContentListOptions = {}
) {
  return useQuery(
    publicContentListQueryOptions(
      kind,
      { consumeAbortSignal: false },
      normalizePageInput(pageItemsInput),
      normalizePageInput(options.pageInput)
    )
  );
}
