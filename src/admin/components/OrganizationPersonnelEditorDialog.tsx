import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { OrganizationPersonnelRow, OrganizationPersonnelWrite } from "../../features/organization-admin/api";
import RichTextMediaPickerDialog from "./RichTextMediaPickerDialog";

export const personnelEditorSchema = z
  .object({
    displayName: z.string().trim().min(1, "กรุณาระบุชื่อบุคลากร").max(200),
    personnelType: z.string().trim().max(120),
    employmentPosition: z.string().trim().max(200),
    photoMediaId: z.string().nullable(),
    publicEmail: z.string().trim().max(254),
    publicPhone: z.string().trim().max(40),
    showPublicEmail: z.boolean(),
    showPublicPhone: z.boolean(),
    active: z.boolean()
  })
  .superRefine((value, ctx) => {
    if (value.publicEmail && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value.publicEmail)) {
      ctx.addIssue({ code: "custom", path: ["publicEmail"], message: "รูปแบบอีเมลไม่ถูกต้อง" });
    }
    if (value.showPublicEmail && !value.publicEmail) {
      ctx.addIssue({ code: "custom", path: ["publicEmail"], message: "กรุณาระบุอีเมลก่อนอนุญาตให้เผยแพร่" });
    }
    if (value.showPublicPhone && !value.publicPhone) {
      ctx.addIssue({ code: "custom", path: ["publicPhone"], message: "กรุณาระบุโทรศัพท์ก่อนอนุญาตให้เผยแพร่" });
    }
  });

export type PersonnelEditorForm = z.infer<typeof personnelEditorSchema>;

export function personnelEditorDefaults(row: OrganizationPersonnelRow | null): PersonnelEditorForm {
  return {
    displayName: row?.display_name ?? "",
    personnelType: row?.personnel_type ?? "",
    employmentPosition: row?.employment_position ?? "",
    photoMediaId: row?.photo_media_id ?? null,
    publicEmail: row?.public_email ?? "",
    publicPhone: row?.public_phone ?? "",
    showPublicEmail: row?.show_public_email === 1,
    showPublicPhone: row?.show_public_phone === 1,
    active: row ? row.active === 1 : true
  };
}

export function toPersonnelWrite(form: PersonnelEditorForm): OrganizationPersonnelWrite {
  return personnelEditorSchema.parse(form);
}

interface Props {
  open: boolean;
  initial: OrganizationPersonnelRow | null;
  busy: boolean;
  error: string;
  canBrowseMedia: boolean;
  onClose: () => void;
  onSave: (value: OrganizationPersonnelWrite) => Promise<void>;
}

export default function OrganizationPersonnelEditorDialog({
  open,
  initial,
  busy,
  error,
  canBrowseMedia,
  onClose,
  onSave
}: Props) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const [selectedPhotoName, setSelectedPhotoName] = useState("");
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isDirty }
  } = useForm<PersonnelEditorForm>({
    resolver: zodResolver(personnelEditorSchema),
    defaultValues: personnelEditorDefaults(initial),
    mode: "onBlur"
  });

  useEffect(() => {
    if (open) {
      reset(personnelEditorDefaults(initial));
    }
  }, [open, initial, reset]);

  const submit = handleSubmit(async (form) => {
    await onSave(toPersonnelWrite(form));
  });

  const input = (
    name: "displayName" | "personnelType" | "employmentPosition" | "publicEmail" | "publicPhone",
    label: string
  ) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <TextField
          {...field}
          label={label}
          fullWidth
          disabled={busy}
          required={name === "displayName"}
          error={Boolean(errors[name])}
          helperText={errors[name]?.message}
        />
      )}
    />
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) onClose();
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby="personnel-editor-title"
      >
        <DialogTitle id="personnel-editor-title">{initial ? "แก้ไขบุคลากร" : "เพิ่มบุคลากร"}</DialogTitle>
        <Box component="form" noValidate onSubmit={(event) => void submit(event)}>
          <DialogContent dividers>
            <Stack spacing={2}>
              {error && (
                <Alert severity="error" role="alert">
                  {error}
                </Alert>
              )}
              {input("displayName", "ชื่อ-นามสกุล")}
              {input("personnelType", "ประเภทบุคลากร")}
              {input("employmentPosition", "ตำแหน่งงาน/วิชาการ")}
              <Controller
                name="photoMediaId"
                control={control}
                render={({ field }) => (
                  <Stack spacing={1}>
                    <Typography variant="body2">รูปประจำตัวจากคลังสื่อ</Typography>
                    <Typography variant="caption" sx={{ overflowWrap: "anywhere" }} color="text.secondary">
                      {selectedPhotoName || (field.value ? `Media ID: ${field.value}` : "ยังไม่ได้เลือกรูปภาพ")}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                      <Button
                        type="button"
                        variant="outlined"
                        disabled={busy || !canBrowseMedia}
                        onClick={() => setMediaOpen(true)}
                      >
                        เลือกรูปภาพ
                      </Button>
                      <Button
                        type="button"
                        disabled={busy || !field.value}
                        onClick={() => {
                          field.onChange(null);
                          setSelectedPhotoName("");
                        }}
                      >
                        นำรูปออก
                      </Button>
                    </Stack>
                    {!canBrowseMedia && (
                      <Alert severity="info">ต้องมีสิทธิ์อ่าน Media Library เพื่อเลือกรูปภาพ (ไม่ต้องอัปโหลดซ้ำ)</Alert>
                    )}
                  </Stack>
                )}
              />
              {input("publicEmail", "อีเมล")}
              <Controller
                name="showPublicEmail"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox checked={field.value} onChange={(_, value) => field.onChange(value)} disabled={busy} />
                    }
                    label="อนุญาตให้เผยแพร่อีเมลบนเว็บไซต์"
                  />
                )}
              />
              {input("publicPhone", "หมายเลขโทรศัพท์")}
              <Controller
                name="showPublicPhone"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox checked={field.value} onChange={(_, value) => field.onChange(value)} disabled={busy} />
                    }
                    label="อนุญาตให้เผยแพร่โทรศัพท์บนเว็บไซต์"
                  />
                )}
              />
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox checked={field.value} onChange={(_, value) => field.onChange(value)} disabled={busy} />
                    }
                    label="บุคลากรอยู่ในสถานะปฏิบัติงาน"
                  />
                )}
              />
              <Alert severity="info">
                ข้อมูลติดต่อเป็นข้อมูลภายในโดยค่าเริ่มต้น และจะปรากฏต่อสาธารณะเมื่อเลือกอนุญาตเท่านั้น
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={onClose} disabled={busy}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="contained" disabled={busy || (Boolean(initial) && !isDirty)}>
              {busy ? "กำลังบันทึก…" : "บันทึกบุคลากร"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      {canBrowseMedia && mediaOpen && (
        <RichTextMediaPickerDialog
          open={mediaOpen}
          kind="image"
          onClose={() => setMediaOpen(false)}
          onSelect={(asset) => {
            setValue("photoMediaId", asset.id, { shouldDirty: true, shouldValidate: true });
            setSelectedPhotoName(asset.name);
            setMediaOpen(false);
          }}
        />
      )}
    </>
  );
}
