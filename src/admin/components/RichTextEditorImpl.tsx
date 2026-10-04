import { lazy, Suspense, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { RichTextDocument } from "../../utils/contentBlocks";
import type { RichTextExternalInsertRequest } from "./richTextInsert";
import RichTextEditorCore, { type PendingAdvancedCommand } from "./RichTextEditorCore";

const RichTextEditorOptionalMode = lazy(() => import("./RichTextEditorOptionalMode"));

interface RichTextEditorProps {
  value: RichTextDocument;
  onChange: (value: RichTextDocument) => void;
  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;
}

function richTextNodeNeedsAdvancedMode(node: unknown): boolean {
  if (!node || typeof node !== "object") {
    return false;
  }

  const record = node as { type?: unknown; attrs?: unknown; marks?: unknown; content?: unknown };
  if (
    [
      "blockquote",
      "bulletList",
      "orderedList",
      "listItem",
      "table",
      "tableRow",
      "tableHeader",
      "tableCell",
      "horizontalRule"
    ].includes(String(record.type ?? ""))
  ) {
    return true;
  }

  if (record.attrs && typeof record.attrs === "object" && "textAlign" in record.attrs && record.attrs.textAlign) {
    return true;
  }

  if (
    Array.isArray(record.marks) &&
    record.marks.some((mark) => {
      if (!mark || typeof mark !== "object") {
        return false;
      }
      const type = String((mark as { type?: unknown }).type ?? "");
      return ["underline", "strike", "link", "textStyle", "highlight"].includes(type);
    })
  ) {
    return true;
  }

  return Array.isArray(record.content) && record.content.some(richTextNodeNeedsAdvancedMode);
}

export function richTextDocumentNeedsAdvancedMode(document: RichTextDocument) {
  return richTextNodeNeedsAdvancedMode(document);
}

function OptionalModeFallback() {
  return (
    <Box
      sx={{
        minHeight: 280,
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5
      }}
    >
      <Typography variant="body2" color="text.secondary">
        กำลังเตรียมเครื่องมือจัดรูปแบบเพิ่มเติม…
      </Typography>
    </Box>
  );
}

export default function RichTextEditorImpl(props: RichTextEditorProps) {
  const [advancedModeRequested, setAdvancedModeRequested] = useState(() =>
    richTextDocumentNeedsAdvancedMode(props.value)
  );
  const [pendingAdvancedCommand, setPendingAdvancedCommand] = useState<PendingAdvancedCommand | null>(null);
  const advancedModeEnabled = advancedModeRequested || richTextDocumentNeedsAdvancedMode(props.value);

  if (advancedModeEnabled) {
    return (
      <Suspense fallback={<OptionalModeFallback />}>
        <RichTextEditorOptionalMode
          {...props}
          pendingAdvancedCommand={pendingAdvancedCommand}
          onAdvancedCommandApplied={() => setPendingAdvancedCommand(null)}
        />
      </Suspense>
    );
  }

  return (
    <RichTextEditorCore
      {...props}
      onRequestAdvancedSupport={(request) => {
        setPendingAdvancedCommand(request);
        setAdvancedModeRequested(true);
      }}
    />
  );
}
