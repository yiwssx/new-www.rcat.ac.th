import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { MediaAsset, MediaType } from "../../types";
import {
  ADMIN_MEDIA_PAGE_SIZE_OPTIONS,
  useAdminMediaListQuery,
  useDebouncedValue
} from "../../features/admin-pagination";
import { isPdfMediaAsset } from "../../shared/media/pdfMedia";
import AdminPagination from "./AdminPagination";
import type { RichTextMediaInsertKind } from "./richTextInsert";

interface RichTextMediaPickerDialogProps {
  open: boolean;
  kind: RichTextMediaInsertKind;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
}

const labels: Record<RichTextMediaInsertKind, string> = {
  image: "เลือกรูปภาพ",
  video: "เลือกวิดีโอ",
  pdf: "เลือก PDF",
  file: "เลือกไฟล์แนบ"
};

function queryTypeForKind(kind: RichTextMediaInsertKind): MediaType | "all" {
  if (kind === "image" || kind === "video") {
    return kind;
  }

  if (kind === "pdf") {
    return "document";
  }

  return "all";
}

function matchesKind(asset: MediaAsset, kind: RichTextMediaInsertKind) {
  if (kind === "image") {
    return asset.type === "image";
  }

  if (kind === "video") {
    return asset.type === "video";
  }

  if (kind === "pdf") {
    return isPdfMediaAsset(asset);
  }

  return asset.type === "document" || asset.type === "sheet";
}

export default function RichTextMediaPickerDialog({ open, kind, onClose, onSelect }: RichTextMediaPickerDialogProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPage(1);
    setSearch("");
  }, [kind, open]);

  const mediaQuery = useAdminMediaListQuery({
    page,
    pageSize,
    q: debouncedSearch,
    type: queryTypeForKind(kind),
    sortBy: "updatedAt",
    sortDirection: "desc"
  });

  const items = useMemo(
    () => (mediaQuery.data?.items ?? []).filter((asset) => matchesKind(asset, kind)),
    [kind, mediaQuery.data?.items]
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{labels[kind]}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="ค้นหาคลังสื่อ"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="ค้นหาจากชื่อไฟล์หรือชื่อสื่อ"
            fullWidth
            autoFocus
          />

          {mediaQuery.isError && (
            <Alert severity="error">ไม่สามารถโหลดคลังสื่อได้ กรุณาปิดหน้าต่างนี้แล้วลองใหม่</Alert>
          )}

          {mediaQuery.isLoading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", py: 4, justifyContent: "center" }}>
              <CircularProgress size={22} />
              <Typography color="text.secondary">กำลังโหลดคลังสื่อ…</Typography>
            </Stack>
          ) : items.length ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                gap: 1
              }}
            >
              {items.map((asset) => (
                <Button
                  key={asset.id}
                  type="button"
                  variant="outlined"
                  onClick={() => onSelect(asset)}
                  sx={{
                    justifyContent: "flex-start",
                    alignItems: "stretch",
                    textAlign: "left",
                    textTransform: "none",
                    p: 1.25,
                    minWidth: 0
                  }}
                >
                  <Stack spacing={0.5} sx={{ minWidth: 0, width: "100%" }}>
                    <Typography
                      sx={{
                        fontWeight: 800,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {asset.name}
                    </Typography>
                    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                      <Chip label={asset.type} size="small" />
                      {!!asset.size && <Chip label={asset.size} size="small" variant="outlined" />}
                      {isPdfMediaAsset(asset) && <Chip label="PDF" size="small" color="primary" variant="outlined" />}
                    </Stack>
                  </Stack>
                </Button>
              ))}
            </Box>
          ) : (
            <Alert severity="info">ไม่พบสื่อที่ตรงกับประเภทและคำค้นในหน้านี้</Alert>
          )}

          {mediaQuery.data?.pagination && (
            <AdminPagination
              pagination={mediaQuery.data.pagination}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              pageSizeOptions={ADMIN_MEDIA_PAGE_SIZE_OPTIONS}
              disabled={mediaQuery.isLoading}
              isFetching={mediaQuery.isFetching}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={onClose}>
          ปิด
        </Button>
      </DialogActions>
    </Dialog>
  );
}
