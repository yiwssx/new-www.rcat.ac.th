import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
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
  type OrganizationAssignmentRow,
  type OrganizationPositionRow,
  type OrganizationUnitListRow
} from "../../features/organization-admin";

interface Props {
  assignment: OrganizationAssignmentRow;
  sourcePosition: OrganizationPositionRow | undefined;
  sourceUnit: OrganizationUnitListRow | null;
  units: readonly OrganizationUnitListRow[];
  busy: boolean;
  onClose: () => void;
  onTransfer: (position: OrganizationPositionRow, unit: OrganizationUnitListRow) => Promise<void>;
}

export default function OrganizationAssignmentTransferDialog({
  assignment,
  sourcePosition,
  sourceUnit,
  units,
  busy,
  onClose,
  onTransfer
}: Props) {
  const [unitId, setUnitId] = useState(sourceUnit?.content_id ?? "");
  const [positionId, setPositionId] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const search = useQuery({
    queryKey: ["admin-organization", "transfer-unit-search", unitSearch.trim()],
    enabled: unitSearch.trim().length > 0,
    queryFn: () => getOrganizationCollection("units", 25, 0, { includeTotal: true, search: unitSearch.trim() })
  });
  const targetQuery = useInfiniteQuery({
    queryKey: ["admin-organization", "transfer-destinations", unitId],
    enabled: Boolean(unitId),
    initialPageParam: 0,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      getOrganizationCollection("positions", 100, pageParam, { includeTotal: true, unitContentId: unitId }),
    getNextPageParam: (lastPage: { nextOffset: number | null }) => lastPage.nextOffset ?? undefined
  });
  const availableUnits = useMemo(() => {
    const items = new Map(units.map((unit) => [unit.content_id, unit]));
    for (const unit of search.data?.items ?? []) items.set(unit.content_id, unit);
    if (sourceUnit) items.set(sourceUnit.content_id, sourceUnit);
    return [...items.values()];
  }, [units, search.data, sourceUnit]);
  const targets = useMemo(
    () => (targetQuery.data?.pages.flatMap((page) => page.items) ?? []) as OrganizationPositionRow[],
    [targetQuery.data]
  );
  const position = targets.find((item) => item.id === positionId);
  const unit = availableUnits.find((item) => item.content_id === unitId);
  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="organization-transfer-title">
      <DialogTitle id="organization-transfer-title">ย้ายบุคลากรข้ามตำแหน่งหรือหน่วยงาน</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            การย้ายเปลี่ยนเฉพาะการมอบหมายนี้ ไม่ลบบุคลากรหรือการมอบหมายรายการอื่น
          </Alert>
          <Typography variant="body2">
            ต้นทาง: {sourceUnit?.title ?? "หน่วยงานปัจจุบัน"} / {sourcePosition?.title ?? assignment.position_id}
          </Typography>
          <TextField
            label="ค้นหาหน่วยงานปลายทาง"
            size="small"
            value={unitSearch}
            onChange={(event) => setUnitSearch(event.target.value)}
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 160 } }}
            helperText="ค้นหาหน่วยงานที่ยังไม่ได้โหลดในรายการ"
          />
          {search.isError && <Alert severity="error">ค้นหาหน่วยงานปลายทางไม่สำเร็จ</Alert>}
          <TextField
            label="หน่วยงานปลายทาง"
            select
            fullWidth
            value={unitId}
            disabled={busy}
            onChange={(event) => {
              setUnitId(event.target.value);
              setPositionId("");
            }}
          >
            {availableUnits.map((item) => (
              <MenuItem key={item.content_id} value={item.content_id}>
                {item.title}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="ตำแหน่งปลายทาง"
            select
            fullWidth
            disabled={busy || targetQuery.isPending || targetQuery.isError}
            value={positionId}
            onChange={(event) => setPositionId(event.target.value)}
          >
            {targets
              .filter((target) => target.id !== assignment.position_id)
              .map((target) => (
                <MenuItem key={target.id} value={target.id}>
                  {target.title}
                </MenuItem>
              ))}
          </TextField>
          {targetQuery.isError && <Alert severity="error">โหลดตำแหน่งปลายทางไม่สำเร็จ</Alert>}
          {targetQuery.hasNextPage && (
            <Button
              variant="outlined"
              disabled={targetQuery.isFetchingNextPage || busy}
              onClick={() => void targetQuery.fetchNextPage()}
            >
              โหลดตำแหน่งเพิ่มเติม
            </Button>
          )}
          {position && unit && (
            <Alert severity="warning">
              ปลายทาง: {unit.title} / {position.title} — ระบบจะเรียงต่อท้ายตำแหน่งปลายทางจากข้อมูลบนเซิร์ฟเวอร์
              และขอให้ยืนยันอีกครั้งก่อนบันทึก
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>ยกเลิก</Button>
        <Button
          variant="contained"
          disabled={busy || !position || !unit || targetQuery.isError}
          onClick={() => {
            if (position && unit) void onTransfer(position, unit);
          }}
        >
          ตรวจสอบและยืนยันการย้าย
        </Button>
      </DialogActions>
    </Dialog>
  );
}
