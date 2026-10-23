import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import ContentEditorDialog from "../components/ContentEditorDialog";
import { useAuth } from "../../context/authSessionContext";
import { getAdminContentDetail, isAdminStaleRevisionError, saveContentItem } from "../../features/cms-content";
import { saveMediaAsset, type MediaAssetInput, type MediaUploadOptions } from "../../features/cms-media";
import { clearContentDraftRecovery, readContentDraftRecovery } from "../../features/cms-content/draftRecovery";
import { invalidateAdminListQueries } from "../../features/admin-pagination";
import { invalidatePublicCmsData } from "../../services/publicCmsInvalidation";
import type { ContentItem } from "../../types";
import {
  appSwal,
  getSwalErrorText,
  showBlockingLoading,
  showErrorResult,
  showSuccessResult,
  updateBlockingLoading
} from "../../utils/swal";
import { ADMIN_READ_ONLY_NOTICE } from "../utils/rbac";

interface ContentEditorRoutePageProps {
  mode: "create" | "edit";
}

export default function ContentEditorRoutePage({ mode }: ContentEditorRoutePageProps) {
  const navigate = useNavigate();
  const { contentId } = useParams({ strict: false }) as { contentId?: string };
  const queryClient = useQueryClient();
  const { hasCapability, session } = useAuth();
  const ownerUserId = session?.user.id ?? "";
  const canWrite = hasCapability(mode === "create" ? "content.create" : "content.update");
  const canManageMedia = hasCapability("media.manage");
  const [saveError, setSaveError] = useState("");
  const thumbnailWarningRef = useRef(false);

  const recovery = useMemo(() => readContentDraftRecovery(ownerUserId), [ownerUserId]);
  const matchingRecovery =
    recovery?.mode === mode && (mode === "create" ? !recovery.item.id : recovery.item.id === contentId)
      ? recovery
      : null;
  const otherRecovery = recovery && !matchingRecovery;

  const detailQuery = useQuery({
    queryKey: ["admin", "content", "edit-detail", contentId],
    queryFn: () => getAdminContentDetail({ id: contentId }),
    enabled: mode === "edit" && Boolean(contentId) && canWrite && !matchingRecovery,
    retry: false
  });
  const item = matchingRecovery?.item ?? (mode === "edit" ? (detailQuery.data ?? null) : null);
  const saveMutation = useMutation({
    mutationFn: (input: ContentItem) =>
      saveContentItem(input, {
        onProgress: (progress) => {
          if (progress.severity === "warning") {
            thumbnailWarningRef.current = true;
          }
          updateBlockingLoading("กำลังบันทึกเนื้อหา", `${progress.percent}% • ${progress.message}`);
        }
      })
  });
  const mediaMutation = useMutation({
    mutationFn: ({ input, options }: { input: MediaAssetInput; options?: MediaUploadOptions }) =>
      saveMediaAsset(input, options),
    onSuccess: async () => {
      await invalidateAdminListQueries(queryClient, "media");
    }
  });

  function goToList() {
    clearContentDraftRecovery();
    void navigate({ to: "/admin/content" });
  }

  async function handleSave(nextItem: ContentItem) {
    if (!canWrite || saveMutation.isPending) {
      setSaveError(ADMIN_READ_ONLY_NOTICE);
      return;
    }

    showBlockingLoading("กำลังบันทึกเนื้อหา", "10% • กำลังตรวจสอบข้อมูลก่อนบันทึก");
    try {
      setSaveError("");
      thumbnailWarningRef.current = false;
      await saveMutation.mutateAsync(nextItem);
      await Promise.all([invalidateAdminListQueries(queryClient, "content"), invalidatePublicCmsData(queryClient)]);
      clearContentDraftRecovery();
      await appSwal.close();

      if (thumbnailWarningRef.current) {
        await appSwal.fire({
          icon: "warning",
          title: "บันทึกเนื้อหาสำเร็จ แต่ยังไม่มี Thumbnail",
          text: "ไม่สามารถสร้างภาพย่อจาก Facebook ได้ เนื้อหาถูกบันทึกแล้ว",
          confirmButtonText: "ตกลง"
        });
      } else {
        await showSuccessResult("บันทึกเนื้อหาสำเร็จ");
      }
      void navigate({ to: "/admin/content" });
    } catch (error) {
      if (isAdminStaleRevisionError(error)) {
        await invalidateAdminListQueries(queryClient, "content");
        await detailQuery.refetch();
      }
      await appSwal.close();
      setSaveError(getSwalErrorText(error, "กรุณาตรวจสอบรายละเอียดเนื้อหา"));
      await showErrorResult("ไม่สามารถบันทึกเนื้อหาได้", error, "กรุณาตรวจสอบรายละเอียดเนื้อหา");
    }
  }

  async function handleUploadMedia(input: MediaAssetInput, options?: MediaUploadOptions) {
    if (!canManageMedia) {
      throw new Error(ADMIN_READ_ONLY_NOTICE);
    }
    return mediaMutation.mutateAsync({ input, options });
  }

  return (
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <Button
          variant="text"
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={() => {
            if (window.confirm("กลับไปรายการเนื้อหา? การเปลี่ยนแปลงที่ยังไม่บันทึกอาจสูญหาย")) {
              void navigate({ to: "/admin/content" });
            }
          }}
        >
          กลับไปรายการเนื้อหา
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {mode === "create" ? "เพิ่มเนื้อหาใหม่" : "แก้ไขเนื้อหา"}
        </Typography>
      </Stack>

      {!canWrite ? (
        <Alert severity="warning">{ADMIN_READ_ONLY_NOTICE}</Alert>
      ) : otherRecovery ? (
        <Alert severity="warning">
          มีฉบับร่างอื่นที่ยังไม่ได้บันทึก กรุณากลับไปยังรายการเนื้อหาเพื่อกู้คืนหรือละทิ้งฉบับร่างก่อน
        </Alert>
      ) : mode === "edit" && !contentId ? (
        <Alert severity="error">ไม่ได้ระบุรายการเนื้อหาที่ต้องการแก้ไข</Alert>
      ) : mode === "edit" && detailQuery.isPending && !matchingRecovery ? (
        <Stack sx={{ py: 5, alignItems: "center" }}>
          <CircularProgress aria-label="กำลังโหลดเนื้อหา" />
        </Stack>
      ) : mode === "edit" && detailQuery.isError && !matchingRecovery ? (
        <Alert severity="error">
          ไม่สามารถโหลดเนื้อหาได้: {detailQuery.error instanceof Error ? detailQuery.error.message : "กรุณาลองใหม่"}
        </Alert>
      ) : (
        <ContentEditorDialog
          key={`${mode}:${contentId ?? "new"}`}
          presentation="page"
          open
          item={item}
          mode={mode}
          ownerUserId={ownerUserId}
          recovered={Boolean(matchingRecovery)}
          recoveredTagInputValue={matchingRecovery?.tagInputValue ?? ""}
          saving={saveMutation.isPending}
          errorMessage={saveError}
          onClose={goToList}
          onSave={(nextItem) => void handleSave(nextItem)}
          onUploadMedia={canManageMedia ? handleUploadMedia : undefined}
        />
      )}
    </Box>
  );
}
