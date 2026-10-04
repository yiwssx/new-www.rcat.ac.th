import { lazy, Suspense } from "react";
import type { MediaAsset } from "../../types";
import type { RichTextMediaInsertKind } from "./richTextInsert";

const RichTextMediaPickerDialogImpl = lazy(() => import("./RichTextMediaPickerDialogImpl"));

interface RichTextMediaPickerDialogProps {
  open: boolean;
  kind: RichTextMediaInsertKind;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
}

export default function RichTextMediaPickerDialog(props: RichTextMediaPickerDialogProps) {
  return (
    <Suspense fallback={null}>
      <RichTextMediaPickerDialogImpl {...props} />
    </Suspense>
  );
}
