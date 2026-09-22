import type { MediaAsset } from "../../types";
import { ContentBlock, createContentBlock } from "../../utils/contentBlocks";

export type RichTextMediaInsertKind = "image" | "video" | "pdf" | "file";

export type RichTextExternalInsertRequest =
  | {
      type: RichTextMediaInsertKind;
      asset: MediaAsset;
    }
  | {
      type: "facebookPost" | "button";
    };

export function createBlockFromRichTextInsert(request: RichTextExternalInsertRequest): ContentBlock {
  if (request.type === "image" || request.type === "video" || request.type === "pdf") {
    const block = createContentBlock(request.type);

    if (block.type === request.type) {
      return {
        ...block,
        mediaId: request.asset.id,
        caption: request.asset.name
      };
    }
  }

  if (request.type === "file") {
    const block = createContentBlock("link");

    if (block.type === "link") {
      return {
        ...block,
        source: "media",
        label: request.asset.name,
        mediaId: request.asset.id,
        href: ""
      };
    }
  }

  return createContentBlock(request.type);
}

export function insertContentBlockAfter(blocks: ContentBlock[], afterBlockId: string, block: ContentBlock) {
  const index = blocks.findIndex((item) => item.id === afterBlockId);

  if (index < 0) {
    return [...blocks, block];
  }

  return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
}
