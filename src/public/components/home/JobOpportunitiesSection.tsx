import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import type { PublicContentCardItem } from "../../../types";
import EmptyState from "../../../shared/components/EmptyState";
import PublicResponsiveImage from "../../../shared/media/PublicResponsiveImage";
import SemanticStatusChip from "../../../design-system/components/SemanticStatusChip";
import { formatDisplayDate } from "../../../utils/dateDisplay";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { usePublicHomeSnapshot } from "../../hooks/usePublicHomeSnapshot";
import { HomeSectionHeading } from "./HomeSectionHeading";
import { resolveJobOpportunityPreview } from "./jobOpportunityPreview";

const HOME_JOB_DISPLAY_LIMIT = 4;
const JOB_ARCHIVE_HREF = `/announcements?category=${encodeURIComponent("รับสมัครงาน")}`;

function getLatestJobItems(items: PublicContentCardItem[]) {
  return [...items]
    .sort((left, right) => {
      const leftTime = Date.parse(left.publishAt || "");
      const rightTime = Date.parse(right.publishAt || "");
      const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
      const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;

      return safeRightTime - safeLeftTime || right.id.localeCompare(left.id);
    })
    .slice(0, HOME_JOB_DISPLAY_LIMIT);
}

export function JobOpportunitiesSection({ items }: { items: PublicContentCardItem[] }) {
  const homeQuery = usePublicHomeSnapshot();
  const mediaAssets = homeQuery.data?.media ?? [];
  const visibleItems = getLatestJobItems(items);

  return (
    <Box component="section" sx={{ mt: { xs: 2.5, md: 4 } }}>
      <HomeSectionHeading
        label="สมัครงาน / จัดหาอาชีพ"
        title="ข่าวสมัครงานและจัดหาอาชีพ"
        description="ประกาศรับสมัครงาน พนักงานราชการ ลูกจ้างชั่วคราว ตำแหน่งงานว่าง และข้อมูลด้านการจัดหาอาชีพ"
        action={
          <Button href={normalizeSafeHref(JOB_ARCHIVE_HREF)} endIcon={<ArrowForwardOutlinedIcon />} size="small">
            ดูทั้งหมด
          </Button>
        }
      />
      {visibleItems.length === 0 ? (
        <EmptyState
          title="ยังไม่มีข่าวสมัครงาน/จัดหาอาชีพ"
          description="เมื่อมีประกาศรับสมัครงานหรือข่าวจัดหาอาชีพที่เผยแพร่แล้ว ระบบจะแสดงรายการในส่วนนี้"
        />
      ) : (
        <Grid container spacing={{ xs: 1.5, md: 1.8 }}>
          {visibleItems.map((item) => {
            const preview = resolveJobOpportunityPreview(item, mediaAssets);

            return (
              <Grid size={{ xs: 12, md: 6 }} key={item.id}>
                <Card component="article" sx={{ height: "100%" }}>
                  <CardContent
                    sx={{
                      height: "100%",
                      p: { xs: 1.35, sm: 1.5, md: 1.6 },
                      display: "flex",
                      alignItems: "stretch",
                      gap: { xs: 1.05, sm: 1.25 },
                      "&:last-child": { pb: { xs: 1.35, sm: 1.5, md: 1.6 } }
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        width: { xs: 84, sm: 96 },
                        minWidth: { xs: 84, sm: 96 },
                        height: { xs: 108, sm: 124 },
                        flex: "0 0 auto",
                        overflow: "hidden",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1.5,
                        bgcolor: "background.default"
                      }}
                    >
                      <PublicResponsiveImage
                        source={preview.source}
                        intent="content-card"
                        alt={`ตัวอย่างเอกสาร ${preview.label}`}
                        loadMode="near-viewport"
                        nearViewportMargin="320px 0px"
                        fill
                        sizes="96px"
                        imageSx={{
                          objectFit: preview.kind === "image" ? "cover" : "contain",
                          bgcolor: "background.paper"
                        }}
                        fallback={<DescriptionOutlinedIcon aria-hidden="true" sx={{ fontSize: 34 }} />}
                      />
                      {preview.kind === "pdf" && (
                        <Chip
                          label="PDF"
                          size="small"
                          color="secondary"
                          sx={{
                            position: "absolute",
                            right: 4,
                            bottom: 4,
                            height: 20,
                            fontSize: "0.66rem",
                            fontWeight: 900,
                            "& .MuiChip-label": { px: 0.7 }
                          }}
                        />
                      )}
                    </Box>

                    <Stack spacing={0.65} sx={{ minWidth: 0, flex: 1 }}>
                      <Stack
                        direction="row"
                        spacing={0.65}
                        useFlexGap
                        sx={{
                          alignItems: "center",
                          flexWrap: "wrap"
                        }}
                      >
                        <Chip
                          icon={<WorkOutlineOutlinedIcon />}
                          label={item.category || "รับสมัครงาน"}
                          size="small"
                          color="primary"
                        />
                        <SemanticStatusChip label="เผยแพร่แล้ว" status="published" />
                      </Stack>

                      <Typography
                        variant="h3"
                        sx={{
                          fontSize: { xs: "0.94rem", md: "1rem" },
                          lineHeight: 1.28,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          fontWeight: 800,
                          fontSize: "0.8rem"
                        }}
                      >
                        {formatDisplayDate(item.publishAt)}
                      </Typography>
                      {item.summary && (
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            fontSize: "0.86rem",
                            lineHeight: 1.45,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden"
                          }}
                        >
                          {item.summary}
                        </Typography>
                      )}

                      <Button
                        href={normalizeSafeHref(`/content/${item.slug}`)}
                        endIcon={<ArrowForwardOutlinedIcon />}
                        aria-label={`อ่านประกาศรับสมัครงาน ${item.title}`}
                        size="small"
                        sx={{ alignSelf: "flex-start", mt: "auto", px: 0, minWidth: 0 }}
                      >
                        อ่านประกาศ
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
