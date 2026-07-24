import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography
} from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";

export interface RecoveryCodesPanelProps {
  codes: readonly string[];
  onAcknowledge: () => Promise<void> | void;
  priorCodesInvalid?: boolean;
}

export default function RecoveryCodesPanel({
  codes,
  onAcknowledge,
  priorCodesInvalid = false
}: RecoveryCodesPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const text = codes.join("\n");

  async function copyAll() {
    await navigator.clipboard?.writeText(text);
  }

  function download() {
    const blob = new Blob([`${text}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rcat-cms-recovery-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function finish() {
    setFinishing(true);

    try {
      await onAcknowledge();
    } finally {
      setFinishing(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h3">รหัสกู้คืน</Typography>
      <Alert severity="warning">
        บันทึกรหัสเหล่านี้ไว้ในที่ปลอดภัย รหัสจะแสดงเพียงครั้งเดียวและการโหลดหน้าใหม่จะทำให้สำเนานี้หายไป
      </Alert>
      {priorCodesInvalid && <Alert severity="info">รหัสกู้คืนชุดเดิมไม่สามารถใช้งานได้อีกต่อไป</Alert>}
      <List aria-label="รหัสกู้คืน" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
        {codes.map((code) => (
          <ListItem key={code}>
            <ListItemText primary={code} primaryTypographyProps={{ fontFamily: "monospace" }} />
          </ListItem>
        ))}
      </List>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button startIcon={<ContentCopyOutlinedIcon />} onClick={() => void copyAll()}>
          คัดลอกทั้งหมด
        </Button>
        <Button startIcon={<DownloadOutlinedIcon />} onClick={download}>
          ดาวน์โหลดไฟล์ข้อความ
        </Button>
      </Stack>
      <FormControlLabel
        control={<Checkbox checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />}
        label="ฉันได้เก็บรหัสกู้คืนไว้แล้ว"
      />
      <Button variant="contained" disabled={!acknowledged || finishing} onClick={() => void finish()}>
        {finishing ? "กำลังดำเนินการ" : "ดำเนินการต่อ"}
      </Button>
    </Stack>
  );
}
