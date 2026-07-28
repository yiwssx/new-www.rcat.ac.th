import { Box, LinearProgress, Skeleton, Stack } from "@mui/material";
import Grid from "@mui/material/Grid2";

export type PublicLoadingVariant = "listing" | "card-grid" | "search-results" | "content-detail" | "home" | "simple";

interface PublicLoadingStateProps {
  variant?: PublicLoadingVariant;
}

const variantMinHeight: Record<PublicLoadingVariant, { xs: number; md: number }> = {
  listing: { xs: 3_500, md: 1_700 },
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
      sx={{ bgcolor: "rgba(31, 90, 44, 0.09)" }}
    />
  );
}

function LoadingCard({ height }: { height: number | { xs: number; md: number } }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        height,
        border: "1px solid rgba(31, 90, 44, 0.1)",
        borderRadius: 2,
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

function ListingLoadingLayout() {
  return (
    <Stack spacing={3}>
      <LoadingCard height={250} />
      <Grid container spacing={2.5}>
        {Array.from({ length: 12 }, (_, index) => (
          <Grid key={index} size={{ xs: 12, md: 4 }}>
            <LoadingCard height={{ xs: 240, md: 320 }} />
          </Grid>
        ))}
      </Grid>
    </Stack>
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
      <Skeleton
        aria-hidden="true"
        animation={false}
        variant="rounded"
        height={300}
        sx={{ bgcolor: "rgba(31, 90, 44, 0.1)" }}
      />
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
        sx={{ bgcolor: "rgba(31, 90, 44, 0.1)" }}
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
            animation: "none !important",
            transition: "none !important"
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
