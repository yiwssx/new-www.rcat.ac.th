import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CompareArrowsOutlinedIcon from "@mui/icons-material/CompareArrowsOutlined";
import { useQuery } from "@tanstack/react-query";
import { getAdminCmsSnapshotFromCloudflare } from "../../features/admin-write/cloudflareApi";
import { getContentRevisions, type ContentRevision } from "../../features/cms-governance/client";
import { compareRevisionBody, compareRevisionFields } from "../../features/cms-governance/revisionDiff";
import ContentBlocksRenderer from "../../shared/components/ContentBlocksRenderer";
import { parseContentBodyToBlocks } from "../../utils/contentBlocks";
import { formatDisplayDateTime } from "../../utils/dateDisplay";

const CONTENT_OPTIONS_QUERY = ["cms-revision-compare", "content-options"] as const;

function findRevision(items: ContentRevision[], revision: number | null) {
  return items.find((item) => item.revision === revision) ?? null;
}

function revisionLabel(revision: ContentRevision) {
  const timestamp = formatDisplayDateTime(revision.createdAt) || revision.createdAt;
  return revision.reason === "current"
    ? `v${revision.revision} · ปัจจุบัน · ${timestamp}`
    : `v${revision.revision} · ${timestamp}`;
}

export default function RevisionComparePanel() {
  const [selectedId, setSelectedId] = useState("");
  const [beforeRevision, setBeforeRevision] = useState<number | null>(null);
  const [afterRevision, setAfterRevision] = useState<number | null>(null);

  const contentQuery = useQuery({
    queryKey: CONTENT_OPTIONS_QUERY,
    queryFn: getAdminCmsSnapshotFromCloudflare,
    staleTime: 30_000
  });
  const contentOptions = useMemo(
    () => [...(contentQuery.data?.content ?? [])].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [contentQuery.data?.content]
  );
  const selected = contentOptions.find((item) => item.id === selectedId) ?? null;

  const revisionsQuery = useQuery({
    queryKey: ["cms-revision-compare", selectedId],
    queryFn: () => getContentRevisions(selectedId),
    enabled: Boolean(selectedId),
    staleTime: 5_000
  });
  const revisions = useMemo(() => {
    const historical = (revisionsQuery.data?.items ?? []).filter((item) => Boolean(item.snapshot));
    if (!selected || !revisionsQuery.data) return historical;
    const currentRevision = Number(selected.revision ?? revisionsQuery.data.currentRevision ?? 0);
    const current: ContentRevision = {
      id: `current-${selected.id}-${currentRevision}`,
      contentId: selected.id,
      revision: currentRevision,
      reason: "current",
      actor: "current",
      createdAt: selected.updatedAt,
      snapshot: selected
    };
    return [current, ...historical.filter((item) => item.revision !== currentRevision)];
  }, [revisionsQuery.data, selected]);

  useEffect(() => {
    if (revisions.length < 2) {
      setBeforeRevision(revisions[0]?.revision ?? null);
      setAfterRevision(null);
      return;
    }
    setBeforeRevision(revisions[1].revision);
    setAfterRevision(revisions[0].revision);
  }, [revisions]);

  const before = findRevision(revisions, beforeRevision);
  const after = findRevision(revisions, afterRevision);
  const fieldChanges = compareRevisionFields(before?.snapshot ?? null, after?.snapshot ?? null);
  const bodyChanges = compareRevisionBody(before?.snapshot?.body, after?.snapshot?.body);
  const changedBodyLines = bodyChanges.filter((line) => line.type !== "context");
  const media = contentQuery.data?.media ?? [];

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CompareArrowsOutlinedIcon color="primary" />
              <Typography variant="h2" sx={{ fontSize: "1.35rem" }}>
                เปรียบเทียบเวอร์ชัน
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              เลือกเนื้อหาและสองเวอร์ชันเพื่อดู metadata ที่เปลี่ยน พร้อมตัวอย่างเนื้อหาก่อนและหลังแบบวางเทียบกัน
            </Typography>
          </Box>

          <Autocomplete
            options={contentOptions}
            value={selected}
            onChange={(_, value) => setSelectedId(value?.id || "")}
            getOptionLabel={(option) => option.title}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="เลือกเนื้อหา" placeholder="ค้นหาชื่อเนื้อหา" />}
          />

          {revisionsQuery.isLoading && selectedId && <Typography>กำลังโหลดประวัติเวอร์ชัน…</Typography>}
          {revisionsQuery.isError && <Alert severity="error">ไม่สามารถโหลดประวัติเวอร์ชันได้</Alert>}
          {selectedId && !revisionsQuery.isLoading && revisions.length < 2 && (
            <Alert severity="info">ยังไม่มีเวอร์ชันก่อนหน้าเพียงพอสำหรับการเปรียบเทียบ</Alert>
          )}

          {revisions.length >= 2 && (
            <>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel id="before-revision-label">เวอร์ชันก่อน</InputLabel>
                    <Select
                      labelId="before-revision-label"
                      label="เวอร์ชันก่อน"
                      value={beforeRevision ?? ""}
                      onChange={(event) => setBeforeRevision(Number(event.target.value))}
                    >
                      {revisions.map((revision) => (
                        <MenuItem key={revision.id} value={revision.revision}>
                          {revisionLabel(revision)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel id="after-revision-label">เวอร์ชันหลัง</InputLabel>
                    <Select
                      labelId="after-revision-label"
                      label="เวอร์ชันหลัง"
                      value={afterRevision ?? ""}
                      onChange={(event) => setAfterRevision(Number(event.target.value))}
                    >
                      {revisions.map((revision) => (
                        <MenuItem key={revision.id} value={revision.revision}>
                          {revisionLabel(revision)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {beforeRevision === afterRevision && <Alert severity="warning">กรุณาเลือกคนละเวอร์ชัน</Alert>}

              {before && after && beforeRevision !== afterRevision && (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                    <Chip label={`เปลี่ยน metadata ${fieldChanges.length} จุด`} />
                    <Chip label={`เปลี่ยน body ${changedBodyLines.length} บรรทัด`} variant="outlined" />
                  </Stack>

                  {!fieldChanges.length && !bodyChanges.length && (
                    <Alert severity="success">สองเวอร์ชันนี้ไม่มีความแตกต่าง</Alert>
                  )}

                  {fieldChanges.length > 0 && (
                    <Stack divider={<Divider flexItem />} spacing={0}>
                      {fieldChanges.map((change) => (
                        <Grid container spacing={1.5} key={change.key} sx={{ py: 1.25 }}>
                          <Grid size={{ xs: 12, md: 2 }}>
                            <Typography sx={{ fontWeight: 800 }}>{change.label}</Typography>
                          </Grid>
                          <Grid size={{ xs: 12, md: 5 }}>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              ก่อน
                            </Typography>
                            <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                              {change.before || "—"}
                            </Typography>
                          </Grid>
                          <Grid size={{ xs: 12, md: 5 }}>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                              หลัง
                            </Typography>
                            <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                              {change.after || "—"}
                            </Typography>
                          </Grid>
                        </Grid>
                      ))}
                    </Stack>
                  )}

                  <Divider />
                  <Typography sx={{ fontWeight: 900 }}>ตัวอย่างเนื้อหาแบบ Side-by-side</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, lg: 6 }}>
                      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2, height: "100%" }}>
                        <Typography variant="overline">ก่อน · v{before.revision}</Typography>
                        <ContentBlocksRenderer
                          blocks={parseContentBodyToBlocks(before.snapshot?.body)}
                          mediaAssets={media}
                        />
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 6 }}>
                      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2, height: "100%" }}>
                        <Typography variant="overline">หลัง · v{after.revision}</Typography>
                        <ContentBlocksRenderer
                          blocks={parseContentBodyToBlocks(after.snapshot?.body)}
                          mediaAssets={media}
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
