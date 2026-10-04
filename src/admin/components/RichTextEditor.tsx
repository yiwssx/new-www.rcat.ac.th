import { lazy, Suspense } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { RichTextDocument } from "../../utils/contentBlocks";
import type { RichTextExternalInsertRequest } from "./richTextInsert";

const RichTextEditorImpl = lazy(() => import("./RichTextEditorImpl"));

interface RichTextEditorProps {
  value: RichTextDocument;
  onChange: (value: RichTextDocument) => void;
  onInsertBlock?: (request: RichTextExternalInsertRequest) => void;
}

function RichTextEditorFallback() {
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
        กำลังเตรียมตัวแก้ไขเนื้อหา…
      </Typography>
    </Box>
  );
}

export default function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense fallback={<RichTextEditorFallback />}>
      <RichTextEditorImpl {...props} />
    </Suspense>
  );
}
