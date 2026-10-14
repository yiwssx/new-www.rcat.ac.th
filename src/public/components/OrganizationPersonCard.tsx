import { useState } from "react";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PublicOrganizationAssignment, PublicOrganizationPosition } from "../../features/public-organization";
import type { MediaAsset } from "../../types";
import PublicResponsiveImage from "../../shared/media/PublicResponsiveImage";

interface Props {
  position: PublicOrganizationPosition;
  assignment: PublicOrganizationAssignment | null;
  media: Map<string, MediaAsset>;
  showEducationQualifications: boolean;
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/gu, " ").normalize("NFC").toLocaleLowerCase("th");
}

/** Keep the current unit's functional role first. Do not show redundant job-title lines. */
export function distinctEmploymentTitle(positionTitle: string, employmentPosition: string) {
  const role = normalizeLabel(positionTitle);
  const job = normalizeLabel(employmentPosition);
  return job && role !== job ? employmentPosition.trim() : "";
}

export default function OrganizationPersonCard({ position, assignment, media, showEducationQualifications }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const person = assignment?.person;
  const portrait = person?.photoMediaId ? media.get(person.photoMediaId) : undefined;
  const secondaryTitle = person ? distinctEmploymentTitle(position.title, person.employmentPosition) : "";
  const duty = assignment?.dutyDetail?.trim() ?? "";
  const distinctDuty =
    duty &&
    normalizeLabel(duty) !== normalizeLabel(position.title) &&
    normalizeLabel(duty) !== normalizeLabel(person?.employmentPosition ?? "")
      ? duty
      : "";

  return (
    <>
      <Card variant="outlined" sx={{ width: 236, flexShrink: 0, borderRadius: 2, height: "100%" }}>
        <CardContent sx={{ textAlign: "center", p: 1.75, "&:last-child": { pb: 1.75 } }}>
          {person ? (
            <Stack spacing={1} sx={{ alignItems: "center" }}>
              <Box
                data-org-photo-ratio="3:4"
                sx={{
                  width: 120,
                  height: 160,
                  borderRadius: 1.5,
                  overflow: "hidden",
                  bgcolor: "action.hover",
                  display: "grid",
                  placeItems: "center"
                }}
              >
                {portrait?.type === "image" ? (
                  <PublicResponsiveImage
                    fill
                    intent="content-body"
                    source={portrait}
                    alt={`ภาพของ${person.displayName}`}
                    width={120}
                    height={160}
                    aspectRatio="3 / 4"
                    imageSx={{ objectFit: "cover", objectPosition: "center top" }}
                  />
                ) : (
                  <BadgeOutlinedIcon color="disabled" sx={{ fontSize: 50 }} aria-hidden="true" />
                )}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                {person.displayName}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                {position.title}
              </Typography>
              {secondaryTitle && (
                <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {secondaryTitle}
                </Typography>
              )}
              <Button variant="text" size="small" onClick={() => setDetailsOpen(true)} aria-label={`ดูรายละเอียด ${person.displayName}`}>
                ดูรายละเอียด
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ alignItems: "center", py: 2 }}>
              <BadgeOutlinedIcon color="disabled" sx={{ fontSize: 50 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{position.title}</Typography>
              <Typography variant="body2" color="text.secondary">ยังไม่มีผู้ดำรงตำแหน่ง</Typography>
            </Stack>
          )}
        </CardContent>
      </Card>
      {person && (
        <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} fullWidth maxWidth="xs"
          aria-labelledby={`org-person-details-${assignment.id}`}>
          <DialogTitle id={`org-person-details-${assignment.id}`}>{person.displayName}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={1.5}>
              <Typography><strong>ตำแหน่งในองค์กร:</strong> {position.title}</Typography>
              {person.employmentPosition && (
                <Typography><strong>ตำแหน่งงาน:</strong> {person.employmentPosition}</Typography>
              )}
              {person.personnelType && (
                <Typography><strong>ประเภทบุคลากร:</strong> {person.personnelType}</Typography>
              )}
              {distinctDuty && <Typography><strong>หน้าที่รับผิดชอบ:</strong> {distinctDuty}</Typography>}
              {showEducationQualifications && person.educationQualifications && (
                <Typography sx={{ whiteSpace: "pre-line" }}>
                  <strong>วุฒิการศึกษา:</strong> {person.educationQualifications}
                </Typography>
              )}
              {person.publicEmail && <Typography><strong>อีเมล:</strong> {person.publicEmail}</Typography>}
              {person.publicPhone && <Typography><strong>โทรศัพท์:</strong> {person.publicPhone}</Typography>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsOpen(false)}>ปิด</Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
