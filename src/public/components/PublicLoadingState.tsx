import type { ReactNode } from "react";
import { Box, Card, CardContent, Chip, LinearProgress, Skeleton, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { designTokens } from "../../design-system/tokens";

export type PublicLoadingVariant = "listing" | "card-grid" | "search-results" | "content-detail" | "home" | "simple";

interface PublicLoadingStateProps {
  variant?: PublicLoadingVariant;
}

const variantMinHeight: Partial<Record<PublicLoadingVariant, { xs: number; md: number }>> = {
  "card-grid": { xs: 2_350, md: 1_250 },
  "search-results": { xs: 3_000, md: 1_900 },
  "content-detail": { xs: 1_350, md: 1_050 },
  home: { xs: 2_200, md: 1_500 },
  simple: { xs: 1_250, md: 950 }
};

function LoadingLine({ width = "100%", height = 18 }: { width?: string | number; height?: number }) {
  return (
    <Skeleton
      aria-hidden="true"
      animation={false}
      variant="rounded"
      width={width}
      height={height}
      sx={{ bgcolor: "action.hover" }}
    />
  );
}

function LoadingCard({ height }: { height: number | { xs: number; md: number } }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        height,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: `${designTokens.radius.medium}px`,
        bgcolor: "background.paper",
        p: 2
      }}
    >
      <Stack spacing={1.2}>
        <LoadingLine width="35%" height={18} />
        <LoadingLine width="88%" height={24} />
        <LoadingLine width="100%" />
        <LoadingLine width="76%" />
      </Stack>
    </Box>
  );
}

const listingLoadingCopy = {
  title: "หัวข้อข่าวตัวอย่าง",
  summary: "Loading content reserves the full summary area until the latest page data is ready.",
  tags: "#fixture #layout",
  owner: "Layout placeholder",
  date: "31 กรกฎาคม 2569"
} as const;

function ListingLoadingText({ children, width, height = 16 }: { children: ReactNode; width: string; height?: number }) {
  return (
    <>
      <Box component="span" sx={{ visibility: "hidden" }}>
        {children}
      </Box>
      <Skeleton
        animation={false}
        variant="rounded"
        width={width}
        height={height}
        sx={{
          bgcolor: "action.hover",
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)"
        }}
      />
    </>
  );
}

function ListingLoadingChip({ label, variant }: { label: string; variant?: "filled" | "outlined" }) {
  return (
    <Chip
      label={
        <Box component="span" sx={{ visibility: "hidden" }}>
          {label}
        </Box>
      }
      size="small"
      variant={variant}
      sx={{
        bgcolor: "action.hover",
        borderColor: "action.hover"
      }}
    />
  );
}

function ListingLoadingCard({ featured = false }: { featured?: boolean }) {
  return (
    <Card aria-hidden="true" className="h-full">
      <CardContent sx={{ p: featured ? 3 : 2.4 }}>
        <Stack direction={featured ? { xs: "column", md: "row" } : "row"} spacing={2}>
          <Box
            sx={{
              position: "relative",
              width: featured ? { xs: "100%", md: 180 } : 70,
              minWidth: featured ? { md: 180 } : 70,
              height: featured ? 150 : 70
            }}
          >
            <Skeleton animation={false} variant="rounded" width="100%" height="100%" sx={{ bgcolor: "action.hover" }} />
          </Box>
          <Box className="min-w-0 flex-1">
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
              <ListingLoadingChip label="ข่าว" />
              <ListingLoadingChip label="เผยแพร่แล้ว" variant="outlined" />
              <ListingLoadingChip label="Layout" variant="outlined" />
            </Stack>
            <Typography
              variant="h3"
              sx={{ color: "transparent", fontSize: featured ? "1.45rem" : "1.05rem", position: "relative" }}
            >
              <ListingLoadingText width={featured ? "42%" : "72%"} height={featured ? 22 : 18}>
                {listingLoadingCopy.title}
              </ListingLoadingText>
            </Typography>
            <Typography className="content-summary mt-2" sx={{ color: "transparent", position: "relative" }}>
              <ListingLoadingText width="94%">{listingLoadingCopy.summary}</ListingLoadingText>
            </Typography>
            <Typography variant="caption" className="mt-2 block" sx={{ color: "transparent", position: "relative" }}>
              <ListingLoadingText width="38%" height={12}>
                {listingLoadingCopy.tags}
              </ListingLoadingText>
            </Typography>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={0.5}
              sx={{ justifyContent: "space-between", mt: 2 }}
            >
              <Typography variant="body2" sx={{ color: "transparent", position: "relative" }}>
                <ListingLoadingText width="72%" height={13}>
                  {listingLoadingCopy.owner}
                </ListingLoadingText>
              </Typography>
              <Typography variant="body2" sx={{ color: "transparent", position: "relative" }}>
                <ListingLoadingText width="68%" height={13}>
                  {listingLoadingCopy.date}
                </ListingLoadingText>
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function ListingLoadingLayout() {
  return (
    <>
      <ListingLoadingCard featured />
      <Stack direction="row" spacing={1.2} sx={{ alignItems: "center", mt: 4, mb: 2 }}>
        <Skeleton animation={false} variant="circular" width={24} height={24} sx={{ bgcolor: "action.hover" }} />
        <Typography variant="h2" sx={{ color: "transparent", fontSize: "1.65rem", position: "relative" }}>
          <ListingLoadingText width="72%" height={24}>
            ข่าวทั้งหมด
          </ListingLoadingText>
        </Typography>
      </Stack>
      <Grid container spacing={2.5}>
        {Array.from({ length: 12 }, (_, index) => (
          <Grid key={index} size={{ xs: 12, md: 6 }}>
            <ListingLoadingCard />
          </Grid>
        ))}
      </Grid>
      <Stack spacing={1.4} sx={{ alignItems: "center", mt: 3 }}>
        <Typography variant="body2" sx={{ color: "transparent", position: "relative" }}>
          <ListingLoadingText width="100%" height={14}>
            แสดง 1–12 จากทั้งหมด 13 รายการ
          </ListingLoadingText>
        </Typography>
      </Stack>
    </>
  );
}

function CardGridLoadingLayout() {
  return (
    <Grid container spacing={2.5}>
      {Array.from({ length: 10 }, (_, index) => (
        <Grid key={index} size={{ xs: 12, md: 6 }}>
          <LoadingCard height={215} />
        </Grid>
      ))}
    </Grid>
  );
}

function SearchLoadingLayout() {
  return (
    <Stack spacing={2.2}>
      <LoadingCard height={88} />
      <LoadingLine width="38%" height={30} />
      <Grid container spacing={2.2}>
        {Array.from({ length: 12 }, (_, index) => (
          <Grid key={index} size={{ xs: 12, md: 6 }}>
            <LoadingCard height={{ xs: 190, md: 250 }} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

function ContentDetailLoadingLayout() {
  return (
    <Stack spacing={2.4}>
      <LoadingLine width="64%" height={48} />
      <LoadingLine width="42%" height={22} />
      <Skeleton aria-hidden="true" animation={false} variant="rounded" height={300} sx={{ bgcolor: "action.hover" }} />
      <LoadingLine />
      <LoadingLine />
      <LoadingLine width="92%" />
      <LoadingLine />
      <LoadingLine width="76%" />
    </Stack>
  );
}

function HomeLoadingLayout() {
  return (
    <Stack spacing={3}>
      <Skeleton
        aria-hidden="true"
        animation={false}
        variant="rectangular"
        height={380}
        sx={{ bgcolor: "action.hover" }}
      />
      <Grid container spacing={2.5}>
        {Array.from({ length: 4 }, (_, index) => (
          <Grid key={index} size={{ xs: 12, md: 6 }}>
            <LoadingCard height={220} />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

function SimpleLoadingLayout() {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, md: 5 }}>
        <LoadingCard height={320} />
      </Grid>
      <Grid size={{ xs: 12, md: 7 }}>
        <LoadingCard height={420} />
      </Grid>
    </Grid>
  );
}

export function PublicBackgroundProgress({ active }: { active: boolean }) {
  return (
    <Box data-cls-region="background-progress" aria-hidden={active ? undefined : "true"} sx={{ height: 3, mb: 3 }}>
      {active ? <LinearProgress aria-label="กำลังปรับปรุงข้อมูล" sx={{ height: "100%" }} /> : null}
    </Box>
  );
}

export default function PublicLoadingState({ variant = "listing" }: PublicLoadingStateProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label="Preparing page"
      data-cls-region="public-loading"
      data-public-loading-variant={variant}
      sx={{
        width: "100%",
        minHeight: variantMinHeight[variant],
        py: { xs: 1.5, md: 2 },
        "@media (prefers-reduced-motion: reduce)": {
          "& *": {
            animation: "none",
            transition: "none"
          }
        }
      }}
    >
      <LinearProgress aria-hidden="true" sx={{ height: 3, mb: 3 }} />
      {variant === "listing" ? <ListingLoadingLayout /> : null}
      {variant === "card-grid" ? <CardGridLoadingLayout /> : null}
      {variant === "search-results" ? <SearchLoadingLayout /> : null}
      {variant === "content-detail" ? <ContentDetailLoadingLayout /> : null}
      {variant === "home" ? <HomeLoadingLayout /> : null}
      {variant === "simple" ? <SimpleLoadingLayout /> : null}
    </Box>
  );
}
