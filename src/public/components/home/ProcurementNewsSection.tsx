import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import type { PublicContentCardItem } from "../../../types";
import EmptyState from "../../../shared/components/EmptyState";
import { designTokens } from "../../../design-system/tokens";
import SemanticStatusChip from "../../../design-system/components/SemanticStatusChip";
import { formatDisplayDate } from "../../../utils/dateDisplay";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

export function ProcurementNewsSection({ items }: { items: PublicContentCardItem[] }) {
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
                  height: "100%"
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
                  <Stack
                    direction="row"
                    spacing={1}
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

                  <Stack spacing={0.9} sx={{ flex: 1 }}>
                    <Typography variant="h3" sx={{ fontSize: { xs: "1.04rem", md: "1.1rem" }, lineHeight: 1.32 }}>
                      {item.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 800
                      }}
                    >
                      {formatDisplayDate(item.publishAt)}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        lineHeight: 1.65
                      }}
                    >
                      {item.summary}
                    </Typography>
                    <Box
                      sx={(theme) => ({
                        mt: "auto",
                        p: 1.15,
                        borderRadius: `${designTokens.radius.medium}px`,
                        bgcolor: alpha(theme.palette.primary.light, 0.62),
                        border: "1px solid",
                        borderColor: "divider"
                      })}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: "primary.dark",
                          fontWeight: 900
                        }}
                      >
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
