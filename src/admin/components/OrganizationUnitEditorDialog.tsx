import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  getOrganizationCollection,
  getOrganizationDetail,
  type OrganizationUnitListRow,
  type OrganizationUnitWrite
} from "../../features/organization-admin/api";
import { nextOrganizationSortOrder } from "./organizationBuilderModel";
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
    setValue,
    formState: { errors, isDirty }
  } = useForm<OrganizationEditorForm>({
    resolver: zodResolver(organizationEditorSchema),
    defaultValues: editorDefaults(initial),
    mode: "onBlur"
  });
  const [parentSearch, setParentSearch] = useState("");
  const [parentSearchDebounced, setParentSearchDebounced] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setParentSearchDebounced(parentSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [parentSearch]);
  const parentSearchQuery = useQuery({
    queryKey: ["admin-organization", "units", "parent-search", parentSearchDebounced],
    enabled: open && parentSearchDebounced.length > 0,
    queryFn: () => getOrganizationCollection("units", 25, 0, { includeTotal: true, search: parentSearchDebounced })
  });
  const missingParentId = initial?.parent_content_id && !units.some((unit) => unit.content_id === initial.parent_content_id)
    ? initial.parent_content_id
    : null;
  const missingParentQuery = useQuery({
    queryKey: ["admin-organization", "units", "parent-detail", missingParentId],
    enabled: open && Boolean(missingParentId),
    queryFn: () => getOrganizationDetail("units", missingParentId ?? "")
  });
  const nextRootOrder = nextOrganizationSortOrder(
    units.filter((unit) => unit.parent_content_id === null),
    (unit) => unit.sort_order
  );
  useEffect(() => {
    if (open) reset({ ...editorDefaults(initial), sortOrder: initial?.sort_order ?? nextRootOrder });
  }, [initial, nextRootOrder, open, reset]);
  const canSelectParent = useMemo(() => {
    const allowedLocal = availableOrganizationParents(units, initial?.content_id ?? null);
    const blockedLocal = new Set(units.filter((unit) => !allowedLocal.some((item) => item.content_id === unit.content_id)).map((unit) => unit.content_id));
    const candidates = new Map(allowedLocal.map((unit) => [unit.content_id, unit]));
    for (const candidate of parentSearchQuery.data?.items ?? []) {
      if (candidate.content_id !== initial?.content_id && !blockedLocal.has(candidate.content_id)) {
        candidates.set(candidate.content_id, candidate);
      }
    }
    return [...candidates.values()];
  }, [units, initial?.content_id, parentSearchQuery.data]);
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
              name="chartMode"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  fullWidth
                  label="รูปแบบผังบุคลากร"
                  disabled={busy}
                  helperText="เลือกแยกต่อหน่วยงานได้ โดยไม่เปลี่ยนข้อมูลบุคลากรเดิม"
                >
                  <MenuItem value="cards">แบบเดิม — รายการตำแหน่ง</MenuItem>
                  <MenuItem value="rows">แบบ A — ผังภาพบุคลากรตามระดับและแถว</MenuItem>
                  <MenuItem value="tree">แบบ B — ผังสายบังคับบัญชาพร้อมเส้นเชื่อม</MenuItem>
                </TextField>
              )}
            />
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
            <TextField
              label="ค้นหาหน่วยงานแม่"
              size="small"
              fullWidth
              disabled={busy}
              value={parentSearch}
              onChange={(event) => setParentSearch(event.target.value)}
              helperText="ค้นหาหน่วยงานในระบบทั้งหมด ไม่จำกัดเฉพาะหน้าที่โหลดอยู่"
              slotProps={{ htmlInput: { maxLength: 160 } }}
            />
            {parentSearch && parentSearch !== parentSearchDebounced && (
              <Typography role="status" variant="caption">กำลังเตรียมค้นหาหน่วยงานแม่…</Typography>
            )}
            {parentSearchQuery.isFetching && parentSearchDebounced && (
              <Typography role="status" variant="caption">กำลังค้นหาหน่วยงานแม่…</Typography>
            )}
            {parentSearchQuery.isError && parentSearchDebounced && (
              <Alert severity="error">ค้นหาหน่วยงานแม่ไม่สำเร็จ กรุณาลองใหม่</Alert>
            )}
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
                  onChange={(event) => {
                    field.onChange(event);
                    if (!initial) {
                      const nextParent = event.target.value || null;
                      setValue(
                        "sortOrder",
                        nextOrganizationSortOrder(
                          units.filter((unit) => unit.parent_content_id === nextParent),
                          (unit) => unit.sort_order
                        ),
                        { shouldDirty: true }
                      );
                    }
                  }}
                  error={Boolean(errors.parentContentId)}
                  helperText={errors.parentContentId?.message ?? "ปล่อยว่างสำหรับหน่วยงานระดับบนสุด"}
                >
                  <MenuItem value="">ระดับบนสุด (ไม่มีหน่วยงานแม่)</MenuItem>
                  {missingParentId && !canSelectParent.some((unit) => unit.content_id === missingParentId) && (
                    <MenuItem value={missingParentId}>
                      {missingParentQuery.data?.item.title ?? "หน่วยงานเดิม: " + missingParentId}
                    </MenuItem>
                  )}
                  {canSelectParent.map((unit) => (
                    <MenuItem key={unit.content_id} value={unit.content_id}>
                      {unit.title}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Box component="details" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
              <Box component="summary" sx={{ cursor: "pointer", fontWeight: 600 }}>
                ตั้งค่าลำดับด้วยตัวเลข (ขั้นสูง)
              </Box>
              <Controller
                name="sortOrder"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="number"
                    fullWidth
                    sx={{ mt: 2 }}
                    label="ลำดับแสดงผล"
                    disabled={busy}
                    onChange={(event) => field.onChange(Number(event.target.value))}
                    error={Boolean(errors.sortOrder)}
                    helperText={
                      errors.sortOrder?.message ??
                      "ระบบเติมลำดับถัดไปให้อัตโนมัติ (เริ่มบันทึกที่ 0 แต่แสดงอันดับเริ่มที่ 1)"
                    }
                    slotProps={{ htmlInput: { min: 0, step: 1 } }}
                  />
                )}
              />
            </Box>
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
