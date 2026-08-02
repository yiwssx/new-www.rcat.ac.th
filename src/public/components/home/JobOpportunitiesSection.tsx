import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import type { ContentItem } from "../../../types";
import EmptyState from "../../../shared/components/EmptyState";
import { designTokens } from "../../../design-system/tokens";
import SemanticStatusChip from "../../../design-system/components/SemanticStatusChip";
import { formatDisplayDate } from "../../../utils/dateDisplay";
import { normalizeSafeHref } from "../../../utils/safeUrl";
import { HomeSectionHeading } from "./HomeSectionHeading";

export function JobOpportunitiesSection({ items }: { items: ContentItem[] }) {
  return (
    <Box component="section" sx={{ mt: { xs: 4, md: 5.5 } }}>
      <HomeSectionHeading
        label="สมัครงาน / หางาน"
        title="ข่าวสมัครงานและโอกาสทางอาชีพ"
        description="ประกาศรับสมัครงาน ข่าวตำแหน่งงานว่าง โอกาสฝึกงาน และข้อมูลแนะแนวอาชีพสำหรับนักเรียน นักศึกษา ศิษย์เก่า และผู้สนใจ"
        action={
          <Button href={normalizeSafeHref("/announcements")} endIcon={<ArrowForwardOutlinedIcon />}>
            ดูทั้งหมด
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          title="ยังไม่มีข่าวสมัครงาน/หางาน"
          description="เมื่อมีประกาศรับสมัครงาน ตำแหน่งงานว่าง หรือข่าวแนะแนวอาชีพที่เผยแพร่แล้ว ระบบจะแสดงรายการในส่วนนี้"
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
                      icon={<WorkOutlineOutlinedIcon />}
                      label={item.category || "สมัครงาน / หางาน"}
                      size="small"
                      color="primary"
                    />
                    <SemanticStatusChip label="เผยแพร่แล้ว" status="published" />
                  </Stack>

                  <Typography variant="h3" sx={{ fontSize: { xs: "1.04rem", md: "1.1rem" }, lineHeight: 1.32 }}>
                    {item.title}
                  </Typography>

                  <Stack spacing={0.75}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 800
                      }}
                    >
                      {formatDisplayDate(item.publishAt)}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.7}
                      sx={{
                        alignItems: "center"
                      }}
                    >
                      <BusinessCenterOutlinedIcon sx={{ color: "primary.dark", fontSize: 19 }} />
                      <Typography
                        variant="body2"
                        sx={{
                          color: "primary.dark",
                          fontWeight: 900
                        }}
                      >
                        {item.owner || "งานแนะแนวอาชีพและจัดหางาน"}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                        lineHeight: 1.65
                      }}
                    >
                      {item.summary}
                    </Typography>
                  </Stack>

                  <Box
                    sx={(theme) => ({
                      mt: "auto",
                      p: 1.15,
                      borderRadius: `${designTokens.radius.medium}px`,
                      bgcolor: alpha(theme.palette.secondary.light, 0.45),
                      border: "1px solid",
                      borderColor: "secondary.main"
                    })}
                  >
                    <Stack
                      direction="row"
                      spacing={0.8}
                      sx={{
                        alignItems: "flex-start"
                      }}
                    >
                      <SchoolOutlinedIcon sx={{ color: "secondary.dark", fontSize: 20, mt: 0.1 }} />
                      <Typography
                        variant="body2"
                        sx={{
                          color: "primary.dark",
                          fontWeight: 800
                        }}
                      >
                        อ่านคุณสมบัติและรายละเอียดเพิ่มเติมในประกาศฉบับเต็ม
                      </Typography>
                    </Stack>
                  </Box>

                  <Button
                    href={normalizeSafeHref(`/content/${item.slug}`)}
                    endIcon={<ArrowForwardOutlinedIcon />}
                    aria-label={`อ่านข่าวสมัครงาน ${item.title}`}
                    sx={{ alignSelf: "flex-start", px: 0 }}
                  >
                    อ่านรายละเอียด
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
