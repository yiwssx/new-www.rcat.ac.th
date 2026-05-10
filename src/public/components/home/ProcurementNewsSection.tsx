import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import type { ContentItem } from "../../../types";
import EmptyState from "../../../shared/components/EmptyState";
import { formatDisplayDate } from "../../../utils/dateDisplay";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

export function ProcurementNewsSection({ items }: { items: ContentItem[] }) {
  return (
    <Box component="section" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading
        label="จัดซื้อจัดจ้าง"
        title="ข่าวจัดซื้อจัดจ้าง"
        description="ประกาศ แผนจัดซื้อจัดจ้าง ร่างขอบเขตของงาน และผลการพิจารณาที่เกี่ยวข้องกับการจัดซื้อจัดจ้างของสถานศึกษา"
        action={
          <Button href={normalizeSafeHref("/announcements")} endIcon={<ArrowForwardOutlinedIcon />}>
            ดูทั้งหมด
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="ยังไม่มีข่าวจัดซื้อจัดจ้าง"
          description="เมื่อมีประกาศจัดซื้อจัดจ้างที่เผยแพร่แล้ว ระบบจะแสดงรายการในส่วนนี้"
        />
      ) : (
        <Grid container spacing={2.5}>
          {items.map((item) => (
            <Grid size={{ xs: 12, md: 6 }} key={item.id}>
              <Card
                component="article"
                sx={{
                  height: "100%",
                  border: "1px solid rgba(31, 90, 44, 0.12)",
                  boxShadow: "0 12px 28px rgba(31, 90, 44, 0.07)"
                }}
              >
                <CardContent
                  sx={{
                    height: "100%",
                    p: 2.25,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.35
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip
                      icon={<RequestQuoteOutlinedIcon />}
                      label={item.category || "จัดซื้อจัดจ้าง"}
                      size="small"
                      color="primary"
                    />
                    <Chip label="เผยแพร่แล้ว" size="small" color="secondary" variant="outlined" />
                  </Stack>

                  <Stack spacing={0.9} sx={{ flex: 1 }}>
                    <Typography variant="h3" sx={{ fontSize: { xs: "1.04rem", md: "1.1rem" }, lineHeight: 1.32 }}>
                      {item.title}
                    </Typography>
                    <Typography color="text.secondary" variant="body2" fontWeight={800}>
                      {formatDisplayDate(item.publishAt)}
                    </Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.65 }}>
                      {item.summary}
                    </Typography>
                    <Box
                      sx={(theme) => ({
                        mt: "auto",
                        p: 1.15,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.primary.light, 0.62),
                        border: "1px solid rgba(31, 90, 44, 0.1)"
                      })}
                    >
                      <Typography color="primary.dark" variant="body2" fontWeight={900}>
                        ดูรายละเอียดเพิ่มเติมในประกาศฉบับเต็ม
                      </Typography>
                    </Box>
                  </Stack>

                  <Button
                    href={normalizeSafeHref(`/content/${item.slug}`)}
                    endIcon={<ArrowForwardOutlinedIcon />}
                    aria-label={`อ่านประกาศจัดซื้อจัดจ้าง ${item.title}`}
                    sx={{ alignSelf: "flex-start", px: 0 }}
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
