import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { OrganizationUnitListRow, OrganizationUnitWrite } from "../../features/organization-admin/api";
import {
  availableOrganizationParents,
  editorDefaults,
  ORGANIZATION_KIND_LABELS,
  ORGANIZATION_STATUS_LABELS,
  organizationEditorSchema,
  toOrganizationUnitWrite,
  type OrganizationEditorForm
} from "../pages/organizationEditorModel";

interface Props {
  open: boolean;
  initial: OrganizationUnitListRow | null;
  units: readonly OrganizationUnitListRow[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (input: OrganizationUnitWrite) => Promise<void>;
}

export default function OrganizationUnitEditorDialog({ open, initial, units, busy, error, onClose, onSave }: Props) {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty }
  } = useForm<OrganizationEditorForm>({
    resolver: zodResolver(organizationEditorSchema),
    defaultValues: editorDefaults(initial),
    mode: "onBlur"
  });
  useEffect(() => {
    if (open) reset(editorDefaults(initial));
  }, [initial, open, reset]);
  const canSelectParent = availableOrganizationParents(units, initial?.content_id ?? null);
  const status = useWatch({ control, name: "status" });
  const save = handleSubmit(async (form) => {
    await onSave(toOrganizationUnitWrite(form));
  });

  const textField = (key: "title" | "slug" | "summary", label: string, multiline = false) => (
    <Controller
      name={key}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          label={label}
          fullWidth
          disabled={busy}
          required={key !== "summary"}
          multiline={multiline}
          minRows={multiline ? 2 : undefined}
          error={Boolean(errors[key])}
          helperText={
            errors[key]?.message ??
            (key === "slug" ? "ใช้ตัวอักษรไทย/อังกฤษ ตัวเลข และขีดกลาง โดยห้ามซ้ำกับหน้าอื่น" : "")
          }
        />
      )}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      fullWidth
      maxWidth="md"
      aria-labelledby="organization-editor-title"
    >
      <DialogTitle id="organization-editor-title">{initial ? "แก้ไขหน่วยงาน" : "เพิ่มหน่วยงาน"}</DialogTitle>
      <Box component="form" onSubmit={(event) => void save(event)} noValidate>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && (
              <Alert severity="error" role="alert">
                {error}
              </Alert>
            )}
            {textField("title", "ชื่อหน่วยงาน")}
            {textField("slug", "Slug")}
            {textField("summary", "คำอธิบาย", true)}
            <Controller
              name="unitKind"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="ประเภทหน่วยงาน"
                  disabled={busy}
                  error={Boolean(errors.unitKind)}
                  helperText={errors.unitKind?.message}
                >
                  {Object.entries(ORGANIZATION_KIND_LABELS).map(([kind, label]) => (
                    <MenuItem key={kind} value={kind}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="parentContentId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="หน่วยงานแม่"
                  disabled={busy}
                  error={Boolean(errors.parentContentId)}
                  helperText={errors.parentContentId?.message ?? "ปล่อยว่างสำหรับหน่วยงานระดับบนสุด"}
                >
                  <MenuItem value="">ระดับบนสุด (ไม่มีหน่วยงานแม่)</MenuItem>
                  {canSelectParent.map((unit) => (
                    <MenuItem key={unit.content_id} value={unit.content_id}>
                      {unit.title}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="sortOrder"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  fullWidth
                  label="ลำดับแสดงผล"
                  disabled={busy}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  error={Boolean(errors.sortOrder)}
                  helperText={errors.sortOrder?.message ?? "จำนวนเต็มตั้งแต่ 0 ขึ้นไป"}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              )}
            />
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="สถานะการเผยแพร่"
                  fullWidth
                  disabled={busy}
                  error={Boolean(errors.status)}
                  helperText={errors.status?.message}
                >
                  {Object.entries(ORGANIZATION_STATUS_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            {(status === "scheduled" || status === "published") && (
              <Typography variant="body2" color="text.secondary">
                การเผยแพร่สู่หน้า Public และระบบประมวลผลรายการกำหนดเวลา จะเชื่อมครบใน Phase 7–8
              </Typography>
            )}
            <Controller
              name="publishAt"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="datetime-local"
                  fullWidth
                  label="เริ่มเผยแพร่ (เวลาไทย)"
                  disabled={busy}
                  required={status === "scheduled"}
                  error={Boolean(errors.publishAt)}
                  helperText={errors.publishAt?.message ?? "เลือกวันที่ตามเวลาประเทศไทย"}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
            />
            <Controller
              name="unpublishAt"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="datetime-local"
                  fullWidth
                  label="สิ้นสุดการเผยแพร่ (เวลาไทย)"
                  disabled={busy}
                  error={Boolean(errors.unpublishAt)}
                  helperText={errors.unpublishAt?.message ?? "ไม่ระบุหากไม่ต้องการกำหนดวันสิ้นสุด"}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1, p: 2 }}>
          <Button onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button type="submit" variant="contained" disabled={busy || (Boolean(initial) && !isDirty)}>
            {busy ? "กำลังบันทึก…" : "บันทึกหน่วยงาน"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
