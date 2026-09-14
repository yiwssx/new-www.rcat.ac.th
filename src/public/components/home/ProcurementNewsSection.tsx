import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import type { PublicContentCardItem } from "../../../types";
import EmptyState from "../../../shared/components/EmptyState";
import SemanticStatusChip from "../../../design-system/components/SemanticStatusChip";
import { formatDisplayDate } from "../../../utils/dateDisplay";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

const HOME_PROCUREMENT_DISPLAY_LIMIT = 4;

function getLatestProcurementItems(items: PublicContentCardItem[]) {
  return [...items]
    .sort((left, right) => {
      const leftTime = Date.parse(left.publishAt || "");
      const rightTime = Date.parse(right.publishAt || "");
      const safeLeftTime = Number.isFinite(leftTime) ? leftTime : 0;
      const safeRightTime = Number.isFinite(rightTime) ? rightTime : 0;

      return safeRightTime - safeLeftTime || right.id.localeCompare(left.id);
    })
    .slice(0, HOME_PROCUREMENT_DISPLAY_LIMIT);
}

export function ProcurementNewsSection({ items }: { items: PublicContentCardItem[] }) {
  const visibleItems = getLatestProcurementItems(items);

  return (
    <Box component="section" sx={{ mt: { xs: 2.5, md: 4 } }}>
      <HomeSectionHeading
        label="จัดซื้อจัดจ้าง"
        title="ข่าวจัดซื้อจัดจ้าง"
        description="ประกาศ แผนจัดซื้อจัดจ้าง ร่างขอบเขตของงาน และผลการพิจารณาที่เกี่ยวข้องกับการจัดซื้อจัดจ้างของสถานศึกษา"
        action={
          <Button href={normalizeSafeHref("/announcements")} endIcon={<ArrowForwardOutlinedIcon />} size="small">
            ดูทั้งหมด
          </Button>
        }
      />
      {visibleItems.length === 0 ? (
        <EmptyState
          title="ยังไม่มีข่าวจัดซื้อจัดจ้าง"
          description="เมื่อมีประกาศจัดซื้อจัดจ้างที่เผยแพร่แล้ว ระบบจะแสดงรายการในส่วนนี้"
        />
      ) : (
        <Grid container spacing={{ xs: 1.5, md: 1.8 }}>
          {visibleItems.map((item) => (
            <Grid size={{ xs: 12, md: 6 }} key={item.id}>
              <Card component="article" sx={{ height: "100%" }}>
                <CardContent
                  sx={{
                    height: "100%",
                    p: { xs: 1.5, md: 1.75 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.9,
                    "&:last-child": { pb: { xs: 1.5, md: 1.75 } }
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    sx={{
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    <Chip
                      icon={<RequestQuoteOutlinedIcon />}
                      label={item.category || "จัดซื้อจัดจ้าง"}
                      size="small"
                      color="primary"
                    />
                    <SemanticStatusChip label="เผยแพร่แล้ว" status="published" />
                  </Stack>

                  <Stack spacing={0.55} sx={{ flex: 1 }}>
                    <Typography
                      variant="h3"
                      sx={{
                        fontSize: { xs: "0.97rem", md: "1.03rem" },
                        lineHeight: 1.3
                      }}
                    >
                      {item.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 800,
                        fontSize: "0.82rem"
                      }}
                    >
                      {formatDisplayDate(item.publishAt)}
                    </Typography>
                    {item.summary && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          lineHeight: 1.55,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}
                      >
                        {item.summary}
                      </Typography>
                    )}
                  </Stack>

                  <Button
                    href={normalizeSafeHref(`/content/${item.slug}`)}
                    endIcon={<ArrowForwardOutlinedIcon />}
                    aria-label={`อ่านประกาศจัดซื้อจัดจ้าง ${item.title}`}
                    size="small"
                    sx={{ alignSelf: "flex-start", px: 0, minWidth: 0 }}
                  >
                    อ่านประกาศ
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
